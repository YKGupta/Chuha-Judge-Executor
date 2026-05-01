import 'dotenv/config';
import express from 'express';
import Logger from './middlewares/logger.middleware.js';
import ExecuteRouter from './routers/execute.router.js';

const app = express();

app.use(express.json());

app.use(Logger);

app.use('/api/execute', ExecuteRouter);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on ${process.env.HOST}:${process.env.PORT}`)
});