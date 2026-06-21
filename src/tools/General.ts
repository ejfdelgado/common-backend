import { SimpleObj } from 'ejfdelgado-common-ts';
import { ParametrosIncompletosException } from '../errors';
import { Request, Response, NextFunction } from "express";
import { decode } from 'html-entities';
import { encode } from "@msgpack/msgpack";
import { ApiResponse } from '../types/types';
import { AES } from 'crypto-js';

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => any>(
    fn: T
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export function getThumbnailPath(value: string) {
    return value.replace(/\.[a-z\?=\d]+$/ig, (extension: string) => {
        return "_xs" + extension;
    });
}

export function getSquarePath(value: string) {
    return value.replace(/\.[a-z\?=\d]+$/ig, (extension: string) => {
        return "_square" + extension;
    });
}

export function innerTextLite(html: string): string {
    return decode(
        html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
    );
}

export function getBucketFilePath(value: string | null) {
    if (value != null && value.length > 0) {
        return `https://storage.googleapis.com/${process.env.BUCKET_NAME}/${value}`;
    } else {
        return `https://storage.googleapis.com/${process.env.BUCKET_NAME}/social_image.jpg`;
    }
}

export function escapeHtml(str: string) {
    if (typeof str !== 'string') return '';

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

export function makeJsonToBinaryResponse(response: ApiResponse, res: Response, pass: string) {
    const texto = JSON.stringify(response);
    const encriptado = AES.encrypt(texto, pass);
    const encripted = encriptado.toString();
    const encoded: Uint8Array = encode(encripted);
    const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
    res.set('Content-Type', 'application/octet-stream');
    res.send(buffer);
}

export function makeJsonToEncriptedTextResponse(response: ApiResponse, res: Response, pass: string) {
    const texto = JSON.stringify(response);
    const encriptado = AES.encrypt(texto, pass);
    const encripted = encriptado.toString();
    res.set('Content-Type', 'text/plain');
    res.send(encripted);
}

export class General {

    static readParam(req: Request, name: string, pred: any = null, complain: boolean = false) {
        const nameLower = name.toLowerCase();
        const first = SimpleObj.getValue(req.body, name, undefined);
        if (first !== undefined) {
            return first;
        } else if (req.query && name in req.query) {
            return req.query[name];
        } else if (req.query && nameLower in req.query) {
            return req.query[nameLower];
        } else if (req.params && name in req.params) {
            return req.params[name];
        } else if (req.params && nameLower in req.params) {
            return req.params[nameLower];
        }
        if (complain) {
            throw new ParametrosIncompletosException(`Parameter not found but required: ${name}`);
        }
        return pred;
    }
}