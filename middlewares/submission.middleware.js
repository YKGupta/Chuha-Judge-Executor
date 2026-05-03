import { ObjectId } from "mongodb";
import { db } from "../database/connect.js";

const SubmissionMiddleware = async (req, res, next) => {
    try
    {
        if (!ObjectId.isValid(req.params.submissionId))
            return res.status(400).json({
                success: false,
                data: null,
                error: { 
                    message: "Invalid submissionId", 
                    code: "INVALID_ID" 
                }
            });

        const submissionId = new ObjectId(req.params.submissionId);
        const submission = await db.collection('Submissions').findOneAndUpdate({ _id: submissionId, status: "pending" }, {
            $set: {
                status: "running",
                updatedAt: new Date()
            }
        }, {
            returnDocument: "before"
        });

        if(!submission.value)
            return res.sendStatus(204);

        req.submission = submission.value;
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