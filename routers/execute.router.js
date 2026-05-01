import { Router } from "express";
import { ExecuteHandler } from "../controllers/execute.controller.js";

const ExecuteRouter = Router();

ExecuteRouter.post('/', ExecuteHandler);

export default ExecuteRouter;