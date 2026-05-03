import { ObjectId } from "mongodb";
import { db } from "../database/connect.js";

const SubmissionMiddleware = async (req, res, next) => {
    try
    {
        const submissionId = new ObjectId(req.params.submissionId);
        const submission = await db.collection('Submissions').findOne({ _id: submissionId });
        req.submission = submission;
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