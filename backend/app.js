import express from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/projects.routes.js';
import aiRoutes from './routes/ai.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config'; // Good practice for local development

connect();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN, // Use the environment variable from Render
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use('/ai', aiRoutes)

app.get('/', (req, res) => {
    res.send('Hello World!');
});

export default app;
