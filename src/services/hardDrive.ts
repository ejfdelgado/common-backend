import { ApiResponse, AuthenticatedRequest } from '../types';
import { General } from '../tools/General';
import { Response } from 'express';
import fs from "fs";
import path from 'path';
import { guessMimeType } from '../tools/MimeTypeMap';

export class HardDriveSrv {
    static async createSubfoldersForFile(filePath: string) {
        // Extract directory path from file path
        const dirPath = path.dirname(filePath);

        try {
            // Create directories recursively (mkdir -p style)
            const options: fs.MakeDirectoryOptions = {};
            options.recursive = true;
            fs.mkdirSync(dirPath, options);
            console.log(`Directories created: ${dirPath}`);
            return dirPath;
        } catch (error) {
            console.error(`Error creating directories for ${filePath}:`, error);
            throw error;
        }
    }
    static async saveFile(req: AuthenticatedRequest, res: Response) {
        let file_path: string = General.readParam(req, "file_path", undefined, true);
        const file = req.file;

        if (!file_path || !file) {
            return res.status(400).json({ error: 'file_path and file are required' });
        }
        const folder = process.env.LOCAL_FOLDER ? process.env.LOCAL_FOLDER : "/tmp";
        const filePath = path.join(folder, file_path);
        await HardDriveSrv.createSubfoldersForFile(filePath);
        const stream = fs.createWriteStream(filePath);
        stream.on('error', (err) => {
            console.error(err);
            res.status(500).json({ error: 'Upload failed' });
        });

        stream.on('finish', async () => {
            res.status(200).json({
                message: 'Upload successful',
                file_path,
            });
        });

        stream.end(file.buffer);
    }

    static async fileExists(path: string) {
        try {
            fs.accessSync(path);
            return true;
        } catch {
            return false;
        }
    }

    static async readFile(req: AuthenticatedRequest, res: Response) {
        const file_path: string = General.readParam(req, "file_path", undefined, false);
        const inline: string = General.readParam(req, "inline", "1", false);

        if (!file_path) {
            return res.status(400).json({ error: 'file_path are required' });
        }
        const folder = process.env.LOCAL_FOLDER ? process.env.LOCAL_FOLDER : "/tmp";
        const filePath = path.join(folder, file_path);

        if (!(await HardDriveSrv.fileExists(filePath))) {
            return res.status(204).json({ error: 'file not found' });
        }

        const readStream = fs.createReadStream(filePath);

        res.status(200).setHeader("Content-Type", guessMimeType(filePath) || "application/octet-stream");
        if (inline == "1") {
            res.setHeader("Content-Disposition", `inline; filename="${file_path.split('/').pop()}"`);
        }

        readStream.pipe(res).on("error", (err) => {
            console.error(err);
            res.status(500).send("Error leyendo el archivo.");
        });
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

        if (!(await HardDriveSrv.fileExists(file_path))) {
            return res.status(204).json({ error: 'file not found' });
        }

        fs.unlinkSync(file_path);

        const response: ApiResponse = { message: "ok", success: true, timestamp: new Date(), };
        return res.status(200).json(response);
    }
}