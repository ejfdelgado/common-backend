import { Response, NextFunction } from 'express';
import { firebaseAdmin } from '../firebase-admin';
import { AuthenticatedRequest } from '../types';

export async function firebaseAuthMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = header.substring('Bearer '.length);

    try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        req.user = decoded;
    } catch (error) {
        // Invalid / expired token → treat as anonymous
        req.user = null;
    }

    next();
}
