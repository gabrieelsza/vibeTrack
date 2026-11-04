import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorMiddleware } from './middlewares/error.middleware';
import apiRoutes from './routes';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/v1', apiRoutes);

app.use(errorMiddleware);
