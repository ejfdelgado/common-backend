import { AuthenticatedRequest } from '../types';
import { General } from '../tools/General';
import { Response } from 'express';
import fs from "fs";
import path from 'path';

export class FileSrv {
    static async createSubfoldersForFile(filePath: string) {
        // Extract directory path from file path
        const dirPath = path.dirname(filePath);

        try {
            // Create directories recursively (mkdir -p style)
            const options: fs.MakeDirectoryOptions = {};
            options.recursive = true;
            await fs.mkdir(dirPath, options, () => { });
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
        await FileSrv.createSubfoldersForFile(filePath);
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

    static async readFile(req: AuthenticatedRequest, res: Response) {
        let file_path: string = General.readParam(req, "file_path", undefined, false);

        if (!file_path) {
            return res.status(400).json({ error: 'file_path are required' });
        }
        const folder = process.env.LOCAL_FOLDER ? process.env.LOCAL_FOLDER : "/tmp";
        const filePath = path.join(folder, file_path);
        const readStream = fs.createReadStream(filePath);

        readStream.pipe(res).on("error", (err) => {
            console.error(err);
            res.status(500).send("Error leyendo el archivo.");
        });
    }
}