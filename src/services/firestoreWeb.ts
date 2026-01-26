import { ApiResponse, AuthenticatedRequest } from "../types";
import { Response } from 'express';
import { General, innerTextLite } from "../tools/General";
import { MyStore } from "./firestore";
import { MyUtilities } from 'ejfdelgado-common-ts';

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
        let confIn: any = General.readParam(req, "conf", {}, false);

        const conf = Object.assign({
            autoAuthor: true,
            searchFields: [],
        }, confIn);

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

        function filterObject(dataIn: any, searchFields: string[]): { [key: string]: string } {
            const searchValues: { [key: string]: string } = {};
            Object.keys(dataIn)
                .filter(el => searchFields.indexOf(el) >= 0)
                .forEach(key => {
                    const val = dataIn[key];
                    if (typeof val == "string") {
                        searchValues[key] = val;
                    } else if (val instanceof Array) {
                        searchValues[key] = val.join(" ");
                    }
                });
            return searchValues;
        }

        function computeSearchable(data: { [key: string]: string }): string[] {
            const keys = Object.keys(data);
            const completeText = innerTextLite(keys.map(key => data[key]).join(" "));
            const tokens = MyUtilities.partirTexto(completeText);
            return tokens;
        }

        let actualSearchables = filterObject(data, conf.searchFields);

        if (typeof id == "string") {
            // Maybe a creation
            const exists = await MyStore.exist(collection, id);
            if (!exists) {
                autoCreation();
            } else {
                // Exists before, read parameters to compute searchable
                const oldDoc = await MyStore.readById(collection, id);
                const oldSearchables = filterObject(oldDoc, conf.searchFields);
                actualSearchables = Object.assign(oldSearchables, actualSearchables);
                data.updated = now;
            }
            data.search = computeSearchable(actualSearchables);
            dbResponse = await MyStore.updateOrCreateById(collection, id, data);
        } else {
            // Sure a creation
            autoCreation();
            data.search = computeSearchable(actualSearchables);
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