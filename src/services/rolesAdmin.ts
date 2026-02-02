import admin from 'firebase-admin';
import { Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { General } from '../tools/General';

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
            if (offset) {
                const result = await admin.auth().listUsers(limit, offset);
                response.data.list = result.users;
                response.data.offset = result.pageToken;
            } else {
                const result = await admin.auth().listUsers(limit);
                response.data.list = result.users;
                response.data.offset = result.pageToken;
            }
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
}