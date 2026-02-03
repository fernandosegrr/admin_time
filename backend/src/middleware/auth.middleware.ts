import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server.js';

export interface AuthRequest extends Request {
    userId?: string;
    user?: {
        id: string;
        email: string;
        name: string;
    };
}

export const authMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET || 'default-secret';

        const decoded = jwt.verify(token, jwtSecret) as { userId: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.userId = user.id;
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export const optionalAuth = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const jwtSecret = process.env.JWT_SECRET || 'default-secret';

            const decoded = jwt.verify(token, jwtSecret) as { userId: string };

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, email: true, name: true }
            });

            if (user) {
                req.userId = user.id;
                req.user = user;
            }
        }
        next();
    } catch {
        next();
    }
};
