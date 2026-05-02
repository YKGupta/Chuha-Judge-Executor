import Docker from 'dockerode';
import tar from 'tar-stream';
import fs from 'fs';
import { PassThrough } from 'stream';
import runtimes from '../runtimes/index.js';

const docker = new Docker({
    socketPath: process.env.DOCKER_SOCKER_PATH
});

const ExecuteHandler = async (req, res) => {
    let container;
    try
    {
        const submission = req.submission;

        const runtime = runtimes[submission.language];

        if(!runtime)
            throw new Error("Unsupported language");

        container = await docker.createContainer({
            Image: runtime.image,
            Cmd: runtime.command,
            WorkingDir: '/app',
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            HostConfig: {
                Memory: 256 * 1024 * 1024,
                NanoCpus: 1_000_000_000,
                NetworkMode: "none",
                PidsLimit: 64
            }
        });

        const pack = tar.pack();
        pack.entry(
            {
                name: runtime.fileName
            },
            submission.code
        );
        pack.finalize();

        await container.putArchive(pack, {
            path: '/app'
        });

        const stream = await container.attach({
            stream: true,
            stdout: true,
            stderr: true
        });

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();

        docker.modem.demuxStream(stream, stdoutStream, stderrStream);

        let stdout = "", stderr = "";
        stdoutStream.on('data', chunk => {
            stdout += chunk.toString();
        });
        stderrStream.on('data', chunk => {
            stderr += chunk.toString();
        });

        await container.start();

        const timeout = setTimeout(() => {
            container.kill().catch(() => {});
        }, 2000);

        await container.wait();
        clearTimeout(timeout);
        
        return res.json({
            success: true,
            data: {
                stdout,
                stderr
            },
            error: null
        });
    }
    catch(e)
    {
        return res.status(500).json({
            success: false,
            data: null,
            error: {
                message: e.message || "Internal Server Error",
                code: "INTERNAL_SERVER_ERROR"
            }
        });
    }
    finally
    {
        if(container)
            await container.remove({ force: true }).catch(() => {});
    }
};

export { ExecuteHandler };