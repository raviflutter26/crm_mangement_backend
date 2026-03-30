import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Routes
import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organization.routes';
import userRoutes from './routes/user.routes';
import departmentRoutes from './routes/department.routes';
import invitationRoutes from './routes/invitation.routes';
import statutoryRoutes from './routes/statutory.routes';
import masterRoutes from './routes/master.routes';

dotenv.config();

const app = express();

// ============== MIDDLEWARE ==============
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Global Rate Limiter
app.use('/api', apiLimiter);

// ============== ROUTES ==============
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/statutory', statutoryRoutes);
app.use('/api/master', masterRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Error Handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`
  🚀 Multi-Tenant HRMS API
  ────────────────────────
  Port:        ${PORT}
  Environment: ${process.env.NODE_ENV}
  Tenant Mode: Active (Hierarchical RBAC)
        `);
    });
};

startServer();

export default app;
