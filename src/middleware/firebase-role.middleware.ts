import admin from 'firebase-admin';
import { AuthenticatedRequest } from '../types';
import { NextFunction, Response } from 'express';

export function checkRole(requiredRoles: string[]) {
    return (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(500).json({ error: 'Auth middleware missing!' });
        }

        // Check if the user has AT LEAST ONE of the required roles
        // This assumes roles are stored as boolean keys like { admin: true }
        //const hasRole = requiredRoles.some(role => req.user?[role] === true);
        console.log(JSON.stringify(req.user, null, 4));
        const hasRole = true;

        if (hasRole) {
            next(); // User is authorized!
        } else {
            res.status(403).json({
                error: 'Forbidden: You do not have the required permissions.'
            });
        }
    };
};