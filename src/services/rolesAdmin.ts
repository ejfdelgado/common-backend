import admin from 'firebase-admin';
import { Response } from 'express';
import { ApiResponse, AuthenticatedRequest, AuthenticatedUser } from '../types/types';
import { General } from '../tools/General';
import { MyStore } from './firestore';
import { NoAutorizadoException } from '../errors';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

const oauthClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
);

export class RolesAdminSrv {

    static async pageUsers(req: AuthenticatedRequest, res: Response) {
        const offset = General.readParam(req, "offset", undefined, false);
        const limit = parseInt(General.readParam(req, "limit", 10, true));
        const email = General.readParam(req, "email", null, false);
        const phone = General.readParam(req, "phone", null, false);

        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: {
                list: [],
                offset: null,
            },
            timestamp: new Date()
        };

        if (email) {
            const userRecord = await admin.auth().getUserByEmail(email);
            if (userRecord) {
                response.data.list.push(userRecord);
            }
        } else if (phone) {
            const userRecord = await admin.auth().getUserByPhoneNumber(phone);
            if (userRecord) {
                response.data.list.push(userRecord);
            }
        } else {
            let result: any = null;
            if (offset) {
                result = await admin.auth().listUsers(limit, offset);
            } else {
                result = await admin.auth().listUsers(limit);
            }
            response.data.list = result.users;
            response.data.offset = result.pageToken;
        }
        res.status(200).json(response);
    }

    static async listRoles(req: AuthenticatedRequest, res: Response) {
        const uid = General.readParam(req, "uid", null, true);
        const userRecord = await admin.auth().getUser(uid);
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: userRecord.customClaims || {},
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async myRoles(req: AuthenticatedRequest, res: Response) {
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: {},
            timestamp: new Date()
        };
        if (req.user) {
            const uid = req.user.uid;
            const userRecord = await admin.auth().getUser(uid);
            response.data = userRecord.customClaims || {};
        }
        res.status(200).json(response);
    }

    static async addRole(req: AuthenticatedRequest, res: Response) {
        const uid = General.readParam(req, "uid", null, true);
        const role = General.readParam(req, "role", null, true);

        const user = await admin.auth().getUser(uid);
        let currentClaims = user.customClaims || {};
        if (!currentClaims[role]) {
            currentClaims[role] = true;//Usually true, but could be a level (e.g., 'premium').
            await admin.auth().setCustomUserClaims(uid, currentClaims);
        }
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: true,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async removeRole(req: AuthenticatedRequest, res: Response) {
        const uid = General.readParam(req, "uid", null, true);
        const role = General.readParam(req, "role", null, true);

        const user = await admin.auth().getUser(uid);
        let currentClaims = user.customClaims || {};
        if (currentClaims[role]) {
            delete currentClaims[role];
            await admin.auth().setCustomUserClaims(uid, currentClaims);
        }
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: true,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async setRoles(req: AuthenticatedRequest, res: Response) {
        const uid = General.readParam(req, "uid", null, true);
        const roles = General.readParam(req, "roles", null, true);

        const currentClaims: { [key: string]: boolean } = {};
        roles.forEach((rol: string) => {
            currentClaims[rol] = true;
        })
        await admin.auth().setCustomUserClaims(uid, currentClaims);
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: true,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async writeUsersAllowed(req: AuthenticatedRequest, res: Response) {
        const collection = General.readParam(req, "collection", "", true);
        const id = General.readParam(req, "id", "", true);
        const owners = General.readParam(req, "owners", [], true);
        const oldDoc = await MyStore.readById(collection, id);
        if (!(oldDoc.owners instanceof Array)) {
            oldDoc.owners = [];
        }
        if (!req.user?.uid || oldDoc.owners.indexOf(req.user.uid) < 0) {
            throw new NoAutorizadoException("Not owner");
        }
        if (owners.indexOf(req.user?.uid) < 0) {
            // All the time the user will be in
            owners.push(req.user?.uid);
        }
        MyStore.updateById(collection, id, { owners })
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: true,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async getUsersAllowed(req: AuthenticatedRequest, res: Response) {
        const collection = General.readParam(req, "collection", "", true);
        const id = General.readParam(req, "id", "", true);
        const oldDoc = await MyStore.readById(collection, id);
        if (!(oldDoc.owners instanceof Array)) {
            oldDoc.owners = [];
        }
        // Check current user is in
        if (!req.user?.uid || oldDoc.owners.indexOf(req.user.uid) < 0) {
            throw new NoAutorizadoException("Not owner");
        }
        const uids = oldDoc.owners;
        const users = [];
        for (let i = 0; i < uids.length; i++) {
            const uid = uids[i];
            const user = await admin.auth().getUser(uid);
            users.push({
                uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
            });
        }
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: users,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async calendarConnect(req: AuthenticatedRequest, res: Response) {
        const currentUrl = General.readParam(req, "currentUrl", "", true);
        const scopeArray = General.readParam(req, "scopes", [], true);
        const user = req.user;
        if (!user) {
            throw new NoAutorizadoException("");
        }

        const scopes = [];

        if (scopeArray.indexOf("calendar") >= 0) {
            scopes.push('https://www.googleapis.com/auth/calendar.events');
        }
        if (scopeArray.indexOf("gmail") >= 0) {
            scopes.push('https://www.googleapis.com/auth/gmail.send');
            scopes.push('https://www.googleapis.com/auth/gmail.modify');
        }

        const state = Buffer
            .from(JSON.stringify({ uid: user.uid, currentUrl }))
            .toString("base64");

        const url = oauthClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes,
            state: state,
        });

        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: { url },
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async calendarConnectCallback(req: AuthenticatedRequest, res: Response) {
        const code = General.readParam(req, "code", "", true);
        const stateOriginal = General.readParam(req, "state", "", true);

        const state = JSON.parse(
            Buffer.from(stateOriginal, "base64").toString(),
        );

        const { tokens } = await oauthClient.getToken(code);

        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            return res.status(400).send("No refresh token returned");
        }

        await MyStore.updateOrCreateById("personal", state.uid, { refreshToken });

        // Redirect to
        res.redirect(state.currentUrl);
    }

    static async getOfflineAuth(calendarUser?: AuthenticatedUser | null) {
        if (!calendarUser || !calendarUser.uid) {
            throw new NoAutorizadoException("Calendar user not configured");
        }

        // Get the refreshToken
        const personal = await MyStore.readById("personal", calendarUser.uid);

        if (!personal) {
            throw new NoAutorizadoException("User did not grant permissions");
        }

        const { refreshToken } = personal;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: refreshToken });
        return {
            auth,
        };
    }
}