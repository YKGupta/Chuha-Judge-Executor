const SubmissionMiddleware = async (req, res, next) => {
    try
    {
        const submissionId = req.params.submissionId;
        const r = await fetch(`${process.env.SUBMISSION_API_URL}/${submissionId}`, {
            headers: {
                "x-api-key": process.env.SUBMISSION_API_KEY
            }
        });
        const submission = await r.json();
        if(!r.ok)
            throw new Error("Submission API Error");
        req.submission = submission.data;
        next();
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
};

export default SubmissionMiddleware;