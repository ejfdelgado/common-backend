import { ApiResponse, AuthenticatedRequest } from "../types";
import { Response } from 'express';
import { General } from "../tools/General";
import { MyStore } from "./firestore";

export class FirestoreWeb {
    static async createUpdate(req: AuthenticatedRequest, res: Response) {
        const response: ApiResponse = {
            success: true,
            message: '',
            timestamp: new Date()
        };
        const now = Date.now();
        const collection = General.readParam(req, "collection", undefined, true);
        const data: any = General.readParam(req, "data", undefined, true);

        let principal: string | undefined = undefined;
        if (req.user?.email) {
            principal = req.user?.email;
        }

        delete data.created;
        delete data.author;

        let id: string | undefined = data.id;
        let dbResponse: any = null;
        if (typeof id == "string") {
            // Maybe a creation
            const exists = await MyStore.exist(collection, id);
            if (!exists) {
                data.created = now;
                data.updated = now;
                if (principal) {
                    data.author = principal;
                }
            } else {
                data.updated = now;
            }
            dbResponse = await MyStore.updateOrCreateById(collection, id, data);
        } else {
            // Sure a creation
            data.created = now;
            data.updated = now;
            if (principal) {
                data.author = principal;
            }
            dbResponse = await MyStore.create(collection, data);
            id = dbResponse.id;
        }

        response.data = { id };

        res.status(200).json(response);
    }
}