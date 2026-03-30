import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

/**
 * General API Rate Limiter
 * 100 requests per minute per user/IP
 */
export const apiLimiter = rateLimit({
    store: new RedisStore({
        // @ts-expect-error - ioredis type mismatch in library
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    windowMs: 60 * 1000, 
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Auth Rate Limiter (Login/Invite)
 * 5 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
    store: new RedisStore({
        // @ts-expect-error - ioredis type mismatch in library
        sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
