import { Response, Request, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { AuthenticatedRequest } from "../types";
import axios from "axios";
import { General } from "../tools/General";

export async function requestTokenId(req: Request, res: Response) {
    let code: string | undefined = General.readParam(req, "code", undefined, false);
    //let scope: string | undefined = General.readParam(req, "scope", undefined, false);
    let redirect_uri: string | undefined = General.readParam(req, "redirect_uri", undefined, false);
    const params: any = {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
    };
    const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams(params),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );

    const {
        id_token,
        access_token,
        refresh_token
    } = tokenResponse.data;
    return res.status(200).json({
        id_token,
        access_token,
        refresh_token,
    });
}

/**
 * Google OAuth JWT Middleware for Express
 * Validates Google ID tokens and attaches payload to request.tokenPayload
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.clientId - Google OAuth client ID (required)
 * @param {string[]} options.allowedAudiences - Array of allowed audience values
 * @param {boolean} options.credentialsRequired - Whether JWT is required (default: true)
 * @param {Array} options.ignorePaths - Paths to skip validation
 * @param {string} options.issuer - Custom issuer (default: Google OAuth issuers)
 * @returns {Function} Express middleware
 */
export function createGoogleJwtMiddleware(options: any = {}) {
    const {
        clientId,
        allowedAudiences = [],
        credentialsRequired = true,
        ignorePaths = [],
        issuer = 'https://accounts.google.com',
        customGetToken = defaultGetToken,
        cacheMaxAge = 3600000, // 1 hour cache for JWKS
        cache = true
    } = options;

    if (!clientId) {
        throw new Error('Google OAuth clientId is required');
    }

    // Combine clientId with any additional allowed audiences
    const audiences = [clientId, ...allowedAudiences].filter(Boolean);

    // Setup JWKS client for Google's public keys
    const client = jwksClient({
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
        cache: cache,
        cacheMaxEntries: 5,
        cacheMaxAge: cacheMaxAge,
        rateLimit: true,
        jwksRequestsPerMinute: 10
    });

    // Google's valid issuers
    const validIssuers = [
        'https://accounts.google.com',
        'accounts.google.com'
    ];

    if (issuer && !validIssuers.includes(issuer)) {
        validIssuers.push(issuer);
    }

    /**
     * Get signing key from JWKS
     */
    function getKey(header: any, callback: any) {
        client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
        });
    }

    /**
     * Verify and decode Google ID token
     */
    async function verifyGoogleToken(token: string) {
        const options: any = {
            algorithms: ['RS256'],
            audience: audiences,
            issuer: validIssuers,
            clockTolerance: 30,
            complete: true // Get full token with header
        };
        return new Promise((resolve, reject) => {
            jwt.verify(
                token,
                getKey,
                options,
                (err: any, decoded: any) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(decoded);
                }
            );
        });
    }

    /**
     * Alternative: Verify token by calling Google's tokeninfo endpoint
     * Useful for debugging or as fallback
     */
    async function verifyViaTokenInfo(token: string, type: string = "id_token") {
        try {
            const response = await axios.get(
                `https://oauth2.googleapis.com/tokeninfo?${type}=${token}`
            );

            const payload = response.data;

            // Validate audience
            if (!audiences.includes(payload.aud)) {
                throw new Error('Invalid audience');
            }

            // Validate issuer
            if (type == "id_token") {
                if (!validIssuers.includes(payload.iss)) {
                    throw new Error('Invalid issuer');
                }
            }

            // Validate expiration
            const now = Math.floor(Date.now() / 1000);
            if (parseInt(payload.exp) < now) {
                throw new Error('Token expired');
            }

            return {
                header: { alg: 'RS256', kid: 'from-tokeninfo' },
                payload: payload,
                signature: ''
            };
        } catch (error: any) {
            throw new Error(`Token info verification failed: ${error.message}`);
        }
    }

    return async function googleJwtMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        // Check if path should be ignored
        if (shouldIgnorePath(req.path, ignorePaths)) {
            return next();
        }

        function handleJwtError(error: any, res: Response, credentialsRequired: boolean) {
            const errorResponse: any = {
                error: 'Invalid Google authentication token',
                code: 'INVALID_GOOGLE_TOKEN'
            };

            switch (error.name) {
                case 'TokenExpiredError':
                    errorResponse.details = 'Google token has expired';
                    errorResponse.code = 'GOOGLE_TOKEN_EXPIRED';
                    return res.status(401).json(errorResponse);

                case 'NotBeforeError':
                    errorResponse.details = 'Google token not yet valid';
                    errorResponse.code = 'GOOGLE_TOKEN_NOT_ACTIVE';
                    return res.status(401).json(errorResponse);

                case 'JsonWebTokenError':
                    if (error.message.includes('audience')) {
                        errorResponse.details = 'Token audience does not match client ID';
                        errorResponse.code = 'INVALID_AUDIENCE';
                    } else if (error.message.includes('issuer')) {
                        errorResponse.details = 'Invalid token issuer';
                        errorResponse.code = 'INVALID_ISSUER';
                    }
                    return res.status(401).json(errorResponse);

                default:
                    if (credentialsRequired) {
                        return res.status(401).json(errorResponse);
                    }
                    // If not required, continue
                    return next();
            }
        }

        try {
            // Extract token from request
            const token = customGetToken(req);

            if (!token) {
                if (credentialsRequired) {
                    return res.status(401).json({
                        error: 'No authentication token provided',
                        code: 'NO_TOKEN'
                    });
                }
                delete req.tokenPayload;
                delete req.token;
                return next();
            }

            let decoded: any;
            let verificationMethod = 'jwks';

            try {
                // First try JWKS verification
                decoded = await verifyGoogleToken(token);
            } catch (jwksError: any) {
                console.warn('JWKS verification failed, trying tokeninfo:', jwksError.message);

                // Fallback to tokeninfo endpoint
                try {
                    decoded = await verifyViaTokenInfo(token, "id_token");
                    verificationMethod = 'tokeninfo';
                } catch (tokeninfoError: any) {
                    // Combine errors
                    throw new Error(
                        `Both verification methods failed:\n` +
                        `JWKS: ${jwksError.message}\n` +
                        `TokenInfo: ${tokeninfoError.message}`
                    );
                }
            }

            // Attach decoded payload to request
            req.tokenPayload = decoded.payload;
            req.token = token;
            req.tokenVerificationMethod = verificationMethod;

            // Add additional useful fields
            req.user = {
                id: decoded.payload.sub,
                email: decoded.payload.email,
                emailVerified: decoded.payload.email_verified,
                name: decoded.payload.name,
                picture: decoded.payload.picture,
                locale: decoded.payload.locale,
                hd: decoded.payload.hd // Google Workspace domain
            };

            next();
        } catch (error: any) {
            if (error instanceof jwt.JsonWebTokenError || error.name === 'TokenExpiredError') {
                return handleJwtError(error, res, credentialsRequired);
            }

            console.error('Google JWT validation error:', error);

            if (credentialsRequired) {
                return res.status(401).json({
                    error: 'Invalid authentication token',
                    code: 'INVALID_TOKEN',
                    details: error.message
                });
            }

            delete req.tokenPayload;
            delete req.token;
            next();
        }
    };
}

/**
 * Default token extraction from various sources
 */
function defaultGetToken(req: AuthenticatedRequest) {
    // 1. Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // 2. Google-specific headers
    if (req.headers['x-google-token']) {
        return req.headers['x-google-token'];
    }

    // 3. Cookies (if using cookie-parser)
    if (req.cookies) {
        if (req.cookies['google_token']) {
            return req.cookies['google_token'];
        }
        if (req.cookies['id_token']) {
            return req.cookies['id_token'];
        }
        if (req.cookies['session']) {
            // Might contain JWT in session cookie
            try {
                const session = JSON.parse(req.cookies['session']);
                return session.idToken || session.accessToken;
            } catch (e) {
                // Not a JSON cookie
            }
        }
    }

    // 4. Query parameter (for OAuth redirects)
    if (req.query && req.query.id_token) {
        return req.query.id_token;
    }

    // 5. Request body (for POST requests)
    if (req.body && req.body.id_token) {
        return req.body.id_token;
    }

    return null;
}

/**
 * Check if path should be ignored
 */
function shouldIgnorePath(path: string, ignorePaths: any[]) {
    return ignorePaths.some(ignorePath => {
        if (ignorePath instanceof RegExp) {
            return ignorePath.test(path);
        }
        return path === ignorePath || path.startsWith(ignorePath);
    });
}

