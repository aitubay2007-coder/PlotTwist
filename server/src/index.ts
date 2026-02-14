import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { predictionRoutes } from './routes/predictions';
import { clanRoutes } from './routes/clans';
import { challengeRoutes } from './routes/challenges';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/clans', clanRoutes);
app.use('/api/challenges', challengeRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`PlotTwist server running on port ${PORT}`);
});

export default app;
