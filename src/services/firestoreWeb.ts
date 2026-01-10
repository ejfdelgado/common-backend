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
        const collection = General.readParam(req, "collection", undefined, true);
        const data: any = General.readParam(req, "data", undefined, true);

        let id: string | undefined = data.id;
        let dbResponse: any = null;
        if (typeof id == "string") {
            dbResponse = await MyStore.updateOrCreateById(collection, id, data);
        } else {
            dbResponse = await MyStore.create(collection, data);
            id = dbResponse.id;
        }

        response.data = { id };

        res.status(200).json(response);
    }
}