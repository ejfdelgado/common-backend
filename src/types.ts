import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

export interface ApiResponse {
    success: boolean;
    message: string;
    data?: any;
    timestamp: Date;
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    emailVerified?: boolean;
    name: string;
    picture?: string;
    locale?: string;
    hd?: string // Google Workspace domain
}

export interface AuthenticatedRequest extends Request {
    token?: string;
    tokenPayload?: JwtPayload;
    tokenVerificationMethod?: string;
    user?: AuthenticatedUser;
}