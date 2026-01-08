import express, { Response, } from 'express';
import { Storage } from "@google-cloud/storage";
import { AuthenticatedRequest } from '../types';

const storage = new Storage();

export class BucketsSrv {

    static async loadFile(req: AuthenticatedRequest, res: Response) {
        const { pdf_bucket_name, pdf_file_name } = req.body;

        try {
            const bucketRef = storage.bucket(pdf_bucket_name);
            const file = bucketRef.file(pdf_file_name);

            // Get file metadata for content type
            const [metadata] = await file.getMetadata();

            res.status(200).setHeader("Content-Type", metadata.contentType || "application/octet-stream");
            res.setHeader("Content-Disposition", `inline; filename="${pdf_file_name.split('/').pop()}"`);

            // Pipe the read stream to the response
            file.createReadStream().pipe(res).on("error", (err) => {
                console.error(err);
                res.status(500).send("Error leyendo el archivo.");
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error leyendo el archivo");
        }
    }
}