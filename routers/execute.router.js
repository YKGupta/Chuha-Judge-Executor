import { Router } from "express";
import SubmissionMiddleware from "../middlewares/submission.middleware.js";
import { ExecuteHandler } from "../controllers/execute.controller.js";

const ExecuteRouter = Router();

ExecuteRouter.post('/:submissionId', SubmissionMiddleware, ExecuteHandler);

export default ExecuteRouter;