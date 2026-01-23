import { Request, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { escapeHtml, General, getBucketFilePath, getSquarePath, getThumbnailPath } from '../tools/General';
import { MyStore } from './firestore';
import { MyTemplate } from 'ejfdelgado-common-ts';
import fs from 'fs';
import path from 'path';

const templateEngine = new MyTemplate();



export function truncateString(max: number, val?: string) {
    if (!val) {
        return val;
    }
    if (val.length > max) {
        return val.substring(0, max) + "...";
    } else {
        return val;
    }
}

export class TemplatesSrv {

    static async socialShare(req: Request, res: Response) {
        let collection: string | undefined = General.readParam(req, "col", undefined, true);
        let id: string | undefined = General.readParam(req, "id", undefined, true);
        const pathIn: string = General.readParam(req, "path", undefined, true);

        if (!collection || !id) {
            throw new Error("error");
        }
        const doc = await MyStore.readById(collection, id);
        const { title, description, author_picture, image } = doc;
        let imageThumnail = image;
        if (imageThumnail) {
            imageThumnail = getSquarePath(imageThumnail);
        }
        let photo = imageThumnail ? imageThumnail : author_picture;
        photo = getBucketFilePath(photo);

        // Render html
        const queryParams = `?col=${collection}&id=${id}`;
        const url = `${process.env.REDIRECT_DOMAIN}/index.html#${pathIn}${queryParams}`;

        const data = {
            photo,
            title: truncateString(50, escapeHtml(title)),
            description: truncateString(120, escapeHtml(description)),
            url,
        };

        const filePath = path.join(__dirname, '../assets/html/social.html');
        const content = fs.readFileSync(filePath, 'utf8');
        const rendered = templateEngine.render(content, data);

        res.status(200).send(rendered);
    }
}