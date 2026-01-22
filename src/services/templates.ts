import { Request, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { General } from '../tools/General';
import { MyStore } from './firestore';
import { MyTemplate } from 'ejfdelgado-common-ts';
import fs from 'fs';
import path from 'path';

const templateEngine = new MyTemplate();

export function getThumbnailPath(value: string) {
    return value.replace(/\.[a-z\?=\d]+$/ig, (extension: string) => {
        return "_xs" + extension;
    });
}

export function getBucketFilePath(value: string | null) {
    if (value != null && value.length > 0) {
        return `https://storage.googleapis.com/${process.env.BUCKET_NAME}/${value}`;
    } else {
        return `https://storage.googleapis.com/${process.env.BUCKET_NAME}/social_image.jpg`;
    }
}

function escapeHtml(str: string) {
    if (typeof str !== 'string') return '';

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
            imageThumnail = getThumbnailPath(imageThumnail);
        }
        let photo = imageThumnail ? imageThumnail : author_picture;
        photo = getBucketFilePath(photo);

        // Render html
        const queryParams = `?col=${collection}&id=${id}`;
        const url = `${process.env.REDIRECT_DOMAIN}/index.html#${pathIn}${queryParams}`;

        const data = {
            photo,
            title: escapeHtml(title),
            description: escapeHtml(description),
            url,
        };

        const filePath = path.join(__dirname, '../assets/html/social.html');
        const content = fs.readFileSync(filePath, 'utf8');
        const rendered = templateEngine.render(content, data);

        /*
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: data,
            timestamp: new Date()
        };
        */

        res.status(200).send(rendered);
    }
}