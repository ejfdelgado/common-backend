// middleware/auth.ts
import { Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { AuthenticatedRequest } from "../types/types";

export function keycloakJwtMiddleware(
    keycloakUrl: string,
    realm: string,
    options?: { publicPaths?: RegExp[] }
) {
    const client = jwksClient({
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000,
    });

    function getKey(header: any, callback: any) {
        client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
        });
    }

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (options && options?.publicPaths) {
            for (let i = 0; i < options.publicPaths.length; i++) {
                const regExp = options.publicPaths[i];
                if (regExp.test(req.path)) {
                    return next();
                }
            }
        }

        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or invalid Authorization header" });
        }

        const token = authHeader.substring(7);
        req.token = token;

        jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: "Invalid or expired token" });
            }

            req.tokenPayload = {
                ...(decoded as JwtPayload),
                extractedAt: new Date().toISOString(),
            };

            next();
        });
    };
}