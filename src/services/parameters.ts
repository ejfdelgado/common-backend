import { Request, Response } from 'express';
import { ApiResponse } from '../types/types';
import { General, makeJsonToBinaryResponse } from '../tools/General';
import NodeRSA, { EncryptionScheme } from "node-rsa";
import JSEncrypt from 'jsencrypt';

export interface RsaKeyPair {
    publicKey: string;
    privateKey: string;
};

const SCHEMES: EncryptionScheme[] = ["pkcs1"];
const scheme_default: EncryptionScheme = SCHEMES[0];


export function encryptBuffer(
    data: string,
    keyPem: string,
) {
    keyPem = keyPem.replace('\n', '');
    const decrypt = new JSEncrypt();
    decrypt.setPublicKey(keyPem);
    let encriptedKey = decrypt.encrypt(data);
    return encriptedKey;
}


export function decryptBuffer(
    data: string,
    keyPem: string,
) {
    keyPem = keyPem.replace('\n', '');
    const decrypt = new JSEncrypt();
    decrypt.setPrivateKey(keyPem);
    let decriptedKey = decrypt.decrypt(data);
    console.log(decriptedKey);
    return decriptedKey;
}

export class ParametersSrv {

    static async encrypt(req: Request, res: Response) {
        const pass = General.readParam(req, "pass", "", true);
        const data = General.readParam(req, "data", "", true);
        if (!process.env.LOCAL_PUBLIC_KEY || !process.env.LOCAL_PRIVATE_KEY) {
            throw new Error("Miss configuration");
        }
        const encrypted = encryptBuffer(
            data,
            process.env.LOCAL_PUBLIC_KEY,
        );

        let decripted: string | boolean = "";
        if (encrypted != false) {
            decripted = decryptBuffer(
                encrypted,
                process.env.LOCAL_PRIVATE_KEY,
            );
        }

        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: { pass, data, base64: encrypted, decripted },
            timestamp: new Date()
        };
        res.status(201).json(response);
    }

    static decrypt(req: Request, res: Response) {
        const pass = General.readParam(req, "pass", "", true);
        const data = General.readParam(req, "data", "", true);
        if (!process.env.LOCAL_PRIVATE_KEY) {
            throw new Error("Miss configuration");
        }
        const decripted = decryptBuffer(
            pass,
            process.env.LOCAL_PRIVATE_KEY,
        );
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: { pass, data, decripted },
            timestamp: new Date()
        };
        res.status(201).json(response);
    }

    static read(req: Request, res: Response) {
        const encriptedKey = General.readParam(req, "pass", "", true);
        // Decript the pass with the private key
        let privateKey = process.env.LOCAL_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("Missconfigured");
        }
        privateKey = privateKey.replace('\n', '');
        const decrypt = new JSEncrypt();
        decrypt.setPrivateKey(privateKey);
        let decriptedKey = decrypt.decrypt(encriptedKey);
        if (!decriptedKey || decriptedKey.length != 20) {
            throw new Error("");
        }
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: {
                GEMINI_API_KEY: process.env.GEMINI_API_KEY,
                GEMINI_MODEL: process.env.GEMINI_MODEL,
                GEMINI_PASS: process.env.GEMINI_PASS,
            },
            timestamp: new Date()
        };
        makeJsonToBinaryResponse(response, res, (decriptedKey + "a").split('').reverse().join(''));
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