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

export interface UpdatedEntityType {
    id: string;
    created: number;
}

export interface SimpleDataType extends UpdatedEntityType {
    updated: number;
}

export interface BasicDataType extends SimpleDataType {
    title: string;
    description: string;
    author: string;
    author_name: string;
    author_picture: string;
}

export interface AssistantStateType {
    model: any;
    state: string | null;
}

export interface ArgumentDataType {
    type: string;
    name: string;
    desc: string;
    required: boolean;
    val?: any;//transient data
    modelPath?: string;
    modelIsArray?: boolean;
}

export interface ToolDataType extends SimpleDataType {
    type: "mail" | "article";
    name: string;
    desc: string;
    to?: string;
    ok?: string;
    error?: string;
    keywords?: string;
    useInState?: string;
    nextState?: string;
    useStates?: boolean;
    affectModel?: boolean;
    template?: string;
    args: ArgumentDataType[];
};