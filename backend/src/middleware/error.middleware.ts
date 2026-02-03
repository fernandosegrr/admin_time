import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error:', err);

    // Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: 'Validation error',
            details: err.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message
            }))
        });
    }

    // Custom app errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message
        });
    }

    // Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaError = err as any;
        if (prismaError.code === 'P2002') {
            return res.status(409).json({
                error: 'A record with this value already exists'
            });
        }
        if (prismaError.code === 'P2025') {
            return res.status(404).json({
                error: 'Record not found'
            });
        }
    }

    // Default error
    return res.status(500).json({
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error'
    });
};

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
