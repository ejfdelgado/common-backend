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

export type ToolFieldType = "mail" | "article" | "fact" | "basic" | "calendar_search" | "calendar_write_guest";

export interface ToolDataType extends SimpleDataType {
    type: ToolFieldType,
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
    calendarUser?: AuthenticatedUser | null,
    calendarKeyword?: string;
    calendarMinHoursGap?: number;
    calendarMaxGuests?: number;
    calendarMaxEvents?: number;
    factsMaxMatches?: number;
    factsMinDistance?: number;
    gmailUser?: AuthenticatedUser | null,
    message?: string | InnerToolResponseType;
    action?: string;
};

export type SearchLangsType = "en" | "es" | "multi";

export interface AssistantDataType extends BasicDataType {
    image: string;
    top: number;
    distance: number;
    language: SearchLangsType;
    instruct: string;
    startConversation?: string;
    knowledge_path?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
    linkedin?: string;
    whatsapp?: any;
    whatsapp_msg?: string;
    emoji?: string;
    maxHistory: number;
    useFacts?: boolean;
}

export interface InnerToolResponseType {
    success: boolean;
    data: any,
    error: null | string;
}

export interface ToolResponseType {
    name: string;
    type: ToolFieldType;
    message: string | InnerToolResponseType;
    hidden?: boolean;
    success?: boolean;
    events?: CalendarEventType[] | null;
}

export interface ArticleDataType extends SimpleDataType {
    type: string;
    keywords: string;
    metadata?: any;
};

export interface CalendarEventType {
    "id": string;
    "htmlLink": string;
    "summary": string;
    "start": {
        "dateTime": string;//2026-03-12T14:30:00-05:00
        "timeZone": string;
    };
}