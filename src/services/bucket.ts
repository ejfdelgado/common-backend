import { Response } from 'express';
import { FileMetadata, Storage, File as GFile } from "@google-cloud/storage";
import { ApiResponse, AuthenticatedRequest, AuthenticatedUser } from '../types/types';
import { General } from '../tools/General';
import { InesperadoException, NoAutorizadoException } from '../errors';

const storage = new Storage();

export type BucketActionsType = "read" | "delete" | "write";

export class BucketsSrv {

    static async uploadStringAsText(
        fileName: string,
        content: string,
        mimeType: string = "text/plain",
        bucket_name?: string,
    ): Promise<void> {
        if (!bucket_name) {
            bucket_name = process.env.BUCKET_NAME;
        }
        if (!bucket_name) {
            throw new InesperadoException("No default bucket");
        }
        const bucket = storage.bucket(bucket_name);
        const file = bucket.file(fileName);

        await file.save(content, {
            contentType: mimeType,
            resumable: false,
            metadata: {
                cacheControl: 'no-cache',
            },
        });
    }

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

        if ((await BucketsSrv.fileExists(bucket_name, file_path))) {
            const [metadata] = await gcsFile.getMetadata();
            await BucketsSrv.checkFilePermissions(metadata, "write", file_path, req.user);
        }

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
        const [metadata] = await file.getMetadata();
        await BucketsSrv.checkFilePermissions(metadata, "delete", file_path, req.user);

        await file.delete();

        const response: ApiResponse = { message: "ok", success: true, timestamp: new Date(), };
        return res.status(200).json(response);
    }

    static async checkFilePermissions(
        metadata: FileMetadata,
        action: BucketActionsType,
        path: string,
        user?: AuthenticatedUser | null,
    ) {
        const customMetadata = metadata.metadata;
        // Surprise, the roles are mixed in the root of the user!! why?!
        //console.log(JSON.stringify(user, null, 4));
        const requiredRoles: string[] = [];
        if (customMetadata) {
            const { roles } = customMetadata;
            if (typeof roles == "string") {
                const rolList = roles.split(/,;/).map(e => e.trim().toLocaleLowerCase());
                requiredRoles.push(...rolList);
            }
        }
        if (path.startsWith("superadmin")) {
            requiredRoles.push("superadmin");
        }
        if (requiredRoles.length > 0) {
            if (!user) {
                throw new NoAutorizadoException("Not allowed");
            }
            const notFulfilledRoles = requiredRoles.filter(r => (user as any)[r] !== true);
            if (notFulfilledRoles.length > 0) {
                throw new NoAutorizadoException("Not allowed");
            }
        }
    }

    static async file2text(file: GFile) {
        const [contents] = await file.download();
        const text = contents.toString('utf-8');
        return text;
    }

    static async file2textLargeFile(file: GFile) {
        return new Promise<string>((resolve, reject) => {
            let data = '';

            file.createReadStream()
                .on('data', chunk => {
                    data += chunk.toString();
                })
                .on('end', () => {
                    resolve(data);
                })
                .on('error', err => {
                    reject(err);
                });
        });
    }

    static async readFileRaw(file_path: string, bucket_name?: string, req?: AuthenticatedRequest): Promise<{ file: GFile, metadata: FileMetadata } | null> {
        if (!bucket_name) {
            if (!process.env.BUCKET_NAME) {
                throw new InesperadoException("Missconfiguration");
            }
            bucket_name = process.env.BUCKET_NAME;
        }
        if (!bucket_name || !file_path) {
            throw new InesperadoException('bucket_name and file_path are required');
        }
        if (!(await BucketsSrv.fileExists(bucket_name, file_path))) {
            return null;
        }
        const bucketRef = storage.bucket(bucket_name);
        const file = bucketRef.file(file_path);
        // Get file metadata for content type
        const [metadata] = await file.getMetadata();
        if (req) {
            await BucketsSrv.checkFilePermissions(metadata, "read", file_path, req.user);
        }
        return { file, metadata };
    }

    static async readTextFile(file_path: string, bucket_name?: string, req?: AuthenticatedRequest): Promise<string | null> {
        const found = await BucketsSrv.readFileRaw(file_path, bucket_name, req);
        if (!found) {
            return null;
        }
        const { file } = found;
        const txt = await BucketsSrv.file2text(file);
        return txt;
    }

    static async readFile(req: AuthenticatedRequest, res: Response) {
        let bucket_name: string | undefined = General.readParam(req, "bucket_name", undefined, false);
        const file_path: string = General.readParam(req, "file_path", undefined, false);
        const inline: string = General.readParam(req, "inline", "1", false);

        const found = await BucketsSrv.readFileRaw(file_path, bucket_name, req);
        if (!found) {
            return res.status(204).json({ error: 'file not found' });
        }
        const { file, metadata } = found;
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