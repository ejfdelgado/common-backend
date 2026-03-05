import admin from 'firebase-admin';
import { AuthenticatedRequest, AuthenticatedUser } from '../types';
import { NextFunction, Response } from 'express';
import { NoAutorizadoException } from '../errors';

export function isAuthenticated() {
    return async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(500).json({ error: 'Auth required!' });
        }
        next();
    }
}

export async function checkRoleSimple(
    collection: string,
    req: AuthenticatedRequest,
    requiredRoles: string[],
) {
    if (collection == "knowledge") {
        const hasRole = await checkRoleInternal(req.user, ["knowledge_create"]);
        if (!hasRole) {
            throw new NoAutorizadoException("Unmet privileges");
        }
    }
}

export async function checkRoleInternal(
    userRaw: AuthenticatedUser | null | undefined,
    requiredRoles: string[],
): Promise<boolean> {
    if (!userRaw) {
        return false;
    }
    const user = await admin.auth().getUser(userRaw.uid);
    let currentClaims = user.customClaims || {};
    if (process.env.SUPERADMIN_EMAIL == user.email) {
        currentClaims["superadmin"] = true;
    }
    const hasRole = requiredRoles.some(role => role in currentClaims);
    return hasRole;
}

export function checkRole(requiredRoles: string[]) {
    return async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(500).json({ error: 'Auth middleware missing!' });
        }

        const hasRole = await checkRoleInternal(req.user, requiredRoles);

        if (hasRole) {
            next(); // User is authorized!
        } else {
            res.status(403).json({
                error: 'Forbidden: You do not have the required permissions.'
            });
        }
    };
};