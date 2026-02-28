import { pipeline, env } from '@xenova/transformers';
import { General } from '../tools/General';
import { ApiResponse } from '../types';
import { Request, Response } from 'express';

env.cacheDir = './.model_cache';

/*
Xenova/all-MiniLM-L6-v2
intfloat/multilingual-e5-base
sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
*/


export class EmbedSrv {
    static extractor: any = null;

    static async getExtractor() {
        if (!EmbedSrv.extractor) {
            EmbedSrv.extractor = await pipeline(
                'feature-extraction',
                //'Xenova/all-MiniLM-L6-v2',//384
                //'Xenova/paraphrase-multilingual-MiniLM-L12-v2',//384
                //'Xenova/multilingual-e5-small',//384
                'Xenova/multilingual-e5-large',//1024
                //'intfloat/multilingual-e5-base',//not found
            );
        }
        return EmbedSrv.extractor;
    }

    static async embed(text: string) {
        const model = await EmbedSrv.getExtractor();
        const output = await model(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    static async use(req: Request, res: Response) {
        const q = General.readParam(req, "q", "", true);
        const arr = await EmbedSrv.embed(q);
        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: {
                size: arr.length,
                vector: arr,
            },
            timestamp: new Date()
        };
        res.status(201).json(response);
    }
}

