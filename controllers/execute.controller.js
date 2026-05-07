import Docker from 'dockerode';
import tar from 'tar-stream';
import fs from 'fs';
import { PassThrough } from 'stream';
import runtimes from '../runtimes/index.js';
import { db } from '../database/connect.js';
import { ObjectId } from 'mongodb';

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
            Cmd: ["sleep", "infinity"],
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

        await container.start();

        const result = await RunTestcases(container, submission);
        
        if(!result.success)
            throw new Error(result.error.message);

        await UpdateSubmission(submission, result.data);
        
        return res.json({
            success: true,
            data: null,
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

const RunTestcases = async (container, submission) => {
    try
    {
        const t = await FetchTestcases(submission.problemId);
        if(!t.success)
            throw new Error(t.error.message);

        const testcases = t.data;

        const runtime = runtimes[submission.language];

        let maxExecutionTime = 0, maxMemory = 0;

        for(const testcase of testcases)
        {
            const startTime = Date.now();
            const testcaseResult = await RunTestcase(container, testcase, runtime.execCommand);
            
            if(!testcaseResult.success)
                throw new Error(testcaseResult.error.message);

            maxExecutionTime = Math.max(maxExecutionTime, Date.now() - startTime);
            maxMemory = Math.max(maxMemory, testcaseResult.data.memory);

            const verdict = EvaluateTestcase(testcaseResult.data, testcase);

            if(verdict !== "accepted")
                return ({
                    success: true,
                    data: {
                        status: verdict,
                        execution: {
                            time: maxExecutionTime,
                            memory: maxMemory
                        },
                        error: {
                            message: "Testcase Failed",
                            t: JSON.stringify(testcaseResult),
                            stderr: testcaseResult.data.stderr
                        }
                    },
                    error: null
                });
        }

        return ({
            success: true,
            data: {
                status: "accepted",
                execution: {
                    time: maxExecutionTime,
                    memory: maxMemory
                },
                error: null
            },
            error: null
        });
    }
    catch(e)
    {
        return ({
            success: false,
            data: null,
            error: {
                message: e.message || "Internal Execution Error",
                code: "INTERNAL_EXECUTION_ERROR"
            }
        });
    }
}

const RunTestcase = async (container, testcase, execCommand) => {
    try
    {
        let stopPolling = false, maxMemory = 0;
        const pollMemory = async () => {
            while(!stopPolling)
            {
                const stats = await container.stats({ stream: false });
                maxMemory = Math.max(maxMemory, stats.memory_stats.usage || 0);
                await new Promise((resolve, reject) => setTimeout(resolve, 100));
            }
        };

        const poller = pollMemory();

        const exec = await container.exec({
            Cmd: ["timeout", "5s", ...execCommand],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });

        const stream = await exec.start({
            hijack: true,
            stdin: true
        });

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();
        const stdinStream = stream;

        docker.modem.demuxStream(stream, stdoutStream, stderrStream);

        let stdout = "", stderr = "";
        stdoutStream.on('data', chunk => {
            stdout += chunk.toString();
        });
        stderrStream.on('data', chunk => {
            stderr += chunk.toString();
        });

        stdinStream.write(testcase.input + (testcase.input.endsWith("\n") ? "" : "\n"));

        const result = await new Promise((resolve, reject) => {
            stream.on('end', () => {
                resolve({
                    stdout,
                    stderr
                });
            });
            stream.on('error', (e) => {
                reject(e);
            });
        });

        stopPolling = true;
        await poller;
        
        const info = await exec.inspect();

        return ({
            success: true,
            data: {
                stdout,
                stderr,
                memory: maxMemory,
                exitCode: info.ExitCode,
                timedOut: info.ExitCode === 124 || info.ExitCode === 143
            },
            error: null
        });
    }
    catch(e)
    {
        return ({
            success: false,
            data: null,
            error: {
                message: e.message || "Internal Execution Error",
                code: "INTERNAL_EXECUTION_ERROR"
            }
        });
    }
};

const EvaluateTestcase = (result, testcase) => {
    if(result.timedOut)
        return "time_limit_exceeded";
    if(result.exitCode !== 0)
        return "runtime_error";
    if(result.stdout.trim() !== testcase.output.trim())
        return "wrong_answer";
    return "accepted";
};

const UpdateSubmission = async (submission, result) => {
    try
    {
        const submissionId = new ObjectId(submission._id);
        await db.collection('Submissions').findOneAndUpdate({ _id: submissionId, status: "running" }, {
            $set: {
                status: result.status,
                execution: result.execution,
                updatedAt: new Date()
            }
        });
        return ({
            success: true,
            data: null,
            error: null
        });
    }
    catch(e)
    {
        return ({
            success: false,
            data: null,
            error: {
                message: e.message || "Internal Server Error",
                code: "INTERNAL_SERVER_ERROR"
            }
        });
    }
};

const FetchTestcases = async (pid) => {
    try
    {
        const problemId = new ObjectId(pid);
        const testcases = await db.collection('Testcases').find({ problemId }).toArray();
        return ({
            success: true,
            data: testcases,
            error: null
        });
    }
    catch(e)
    {
        return ({
            success: false,
            data: null,
            error: {
                message: e.message || "Internal Server Error",
                code: "INTERNAL_SERVER_ERROR"
            }
        });
    }
};

export { ExecuteHandler };