import admin from 'firebase-admin';
import { AuthenticatedRequest } from '../types';
import { NextFunction, Response } from 'express';

export function checkRole(requiredRoles: string[]) {
    return async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(500).json({ error: 'Auth middleware missing!' });
        }

        const user = await admin.auth().getUser(req.user.uid);
        let currentClaims = user.customClaims || {};
        if (process.env.SUPERADMIN_EMAIL == user.email) {
            currentClaims["superadmin"] = true;
        }
        const hasRole = requiredRoles.some(role => role in currentClaims);

        if (hasRole) {
            next(); // User is authorized!
        } else {
            res.status(403).json({
                error: 'Forbidden: You do not have the required permissions.'
            });
        }
    };
};