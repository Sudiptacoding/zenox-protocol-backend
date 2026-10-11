import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: ['http://localhost:3000', 'https://zenox-protocol.vercel.app'],
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);

// Task Routes Registering
app.use('/api/tasks', taskRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.send('Zenox Protocol Backend API Engine is Running 🚀');
});

// Database কানেক্ট করে এক্সপ্রেস সার্ভার রান করুন
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`📡 Zenox Protocol Server running on port ${PORT}`);
  });
});