const runtimes = {
    python: {
        image: "python:3.14-alpine",
        fileName: "Main.py",
        command: ["python", "/app/Main.py"]
    }
};

export default runtimes;