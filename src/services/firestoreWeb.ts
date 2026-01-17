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
        const conf: any = General.readParam(req, "conf", undefined, true);

        delete data.created;
        delete data.author;

        let id: string | undefined = data.id;
        let dbResponse: any = null;

        function autoCreation() {
            data.created = now;
            data.updated = now;
            if (req.user?.email) {
                data.author = req.user?.email;
                if (conf?.autoAuthor) {
                    if (req.user?.picture) {
                        data.author_picture = req.user?.picture
                    }
                    if (req.user?.name) {
                        data.author_name = req.user?.name
                    }
                }
            }

        };

        if (typeof id == "string") {
            // Maybe a creation
            const exists = await MyStore.exist(collection, id);
            if (!exists) {
                autoCreation();
            } else {
                data.updated = now;
            }
            dbResponse = await MyStore.updateOrCreateById(collection, id, data);
        } else {
            // Sure a creation
            autoCreation();
            dbResponse = await MyStore.create(collection, data);
            id = dbResponse.id;
        }

        response.data = { id };

        res.status(200).json(response);
    }

    static async delete(req: AuthenticatedRequest, res: Response) {
        const response: ApiResponse = {
            success: true,
            message: '',
            timestamp: new Date()
        };
        const collection = General.readParam(req, "collection", undefined, true);
        const id = General.readParam(req, "id", undefined, true);
        await MyStore.deleteById(collection, id);
        res.status(200).json(response);
    }
}