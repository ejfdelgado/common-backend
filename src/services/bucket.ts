import { Response } from 'express';
import { Storage } from "@google-cloud/storage";
import { ApiResponse, AuthenticatedRequest } from '../types';
import { General } from '../tools/General';

const storage = new Storage();

export class BucketsSrv {

    static async saveFile(req: AuthenticatedRequest, res: Response) {
        let bucket_name: string | undefined = General.readParam(req, "bucket_name", undefined, false);
        let file_path: string = General.readParam(req, "file_path", undefined, true);
        let make_public: string = General.readParam(req, "make_public", "0", false);

        const file = req.file;

        if (!bucket_name) {
            bucket_name = process.env.BUCKET_NAME;
        }

        if (!bucket_name || !file_path || !file) {
            return res.status(400).json({ error: 'bucket_name, file_path and file are required' });
        }

        const bucketRef = storage.bucket(bucket_name);
        const gcsFile = bucketRef.file(file_path);

        const stream = gcsFile.createWriteStream({
            resumable: false,
            contentType: file.mimetype ? file.mimetype : "application/octet-stream",
            metadata: {
                cacheControl: 'public, max-age=31536000',
            },
        });

        stream.on('error', (err) => {
            console.error(err);
            res.status(500).json({ error: 'Upload failed' });
        });

        stream.on('finish', async () => {
            if (make_public === "1") {
                await gcsFile.makePublic();
            }
            res.status(200).json({
                message: 'Upload successful',
                bucket_name,
                file_path,
            });
        });

        stream.end(file.buffer);
    }

    static async fileExists(bucketName: string, filePath: string) {
        const file = storage.bucket(bucketName).file(filePath);
        const [exists] = await file.exists();
        return exists;
    }

    static async deleteFile(req: AuthenticatedRequest, res: Response) {
        let bucket_name: string | undefined = General.readParam(req, "bucket_name", undefined, false);
        const file_path: string = General.readParam(req, "file_path", undefined, false);

        if (!bucket_name) {
            bucket_name = process.env.BUCKET_NAME;
        }

        if (!bucket_name || !file_path) {
            return res.status(400).json({ error: 'bucket_name and file_path are required' });
        }
        const file = storage.bucket(bucket_name).file(file_path);

        if (!(await BucketsSrv.fileExists(bucket_name, file_path))) {
            return res.status(204).json({ error: 'file not found' });
        }

        await file.delete();

        const response: ApiResponse = { message: "ok", success: true, timestamp: new Date(), };
        return res.status(200).json(response);
    }

    static async readFile(req: AuthenticatedRequest, res: Response) {
        let bucket_name: string | undefined = General.readParam(req, "bucket_name", undefined, false);
        const file_path: string = General.readParam(req, "file_path", undefined, false);
        const inline: string = General.readParam(req, "inline", "1", false);

        if (!bucket_name) {
            bucket_name = process.env.BUCKET_NAME;
        }

        if (!bucket_name || !file_path) {
            return res.status(400).json({ error: 'bucket_name and file_path are required' });
        }

        if (!(await BucketsSrv.fileExists(bucket_name, file_path))) {
            return res.status(204).json({ error: 'file not found' });
        }

        const bucketRef = storage.bucket(bucket_name);
        const file = bucketRef.file(file_path);

        // Get file metadata for content type
        const [metadata] = await file.getMetadata();

        res.status(200).setHeader("Content-Type", metadata.contentType || "application/octet-stream");
        if (inline == "1") {
            res.setHeader("Content-Disposition", `inline; filename="${file_path.split('/').pop()}"`);
        }

        // Pipe the read stream to the response
        file.createReadStream().pipe(res).on("error", (err) => {
            console.error(err);
            res.status(500).send("Error leyendo el archivo.");
        });
    }
}