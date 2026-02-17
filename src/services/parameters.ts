import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { General, makeJsonToBinaryResponse } from '../tools/General';
import NodeRSA, { EncryptionScheme } from "node-rsa";

export interface RsaKeyPair {
    publicKey: string;
    privateKey: string;
};

const SCHEMES: EncryptionScheme[] = ["pkcs1", "pkcs1"];
const KEY_TYPES = ["public", "private"];
const scheme_default: EncryptionScheme = SCHEMES[0];

export class ParametersSrv {
    static read(req: Request, res: Response) {
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: {
                secret: "This is my secret",
            },
            timestamp: new Date()
        };
        makeJsonToBinaryResponse(response, res);
    }

    static generateKeyPair(req: Request, res: Response) {
        let tamanio = parseInt(General.readParam(req, "size", "2048", false));
        const key = new NodeRSA({ b: tamanio });
        key.setOptions({ encryptionScheme: scheme_default });
        const respose = {
            public: key.exportKey("public"),
            private: key.exportKey("private"),
        };
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: respose,
            timestamp: new Date()
        };
        res.status(201).json(response);
    }

    static getPublicKey(req: Request, res: Response) {
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: process.env.LOCAL_PUBLIC_KEY,
            timestamp: new Date()
        };
        res.status(201).json(response);
    }
}