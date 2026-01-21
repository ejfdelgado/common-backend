import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";
import { DecodedIdToken } from "firebase-admin/lib/auth/token-verifier";

export interface ApiResponse {
    success: boolean;
    message: string;
    data?: any;
    timestamp: Date;
}

export interface AuthenticatedUser extends DecodedIdToken {

}

export interface AuthenticatedRequest extends Request {
    token?: string;
    tokenPayload?: JwtPayload;
    tokenVerificationMethod?: string;
    user?: AuthenticatedUser | null;
}