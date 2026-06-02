import { Request, Response } from 'express';
import { ApiResponse } from '../types/types';
import { General, makeJsonToBinaryResponse } from '../tools/General';
import NodeRSA, { EncryptionScheme } from "node-rsa";
import JSEncrypt from 'jsencrypt';
import { AES, enc } from 'crypto-js';

export interface RsaKeyPair {
    publicKey: string;
    privateKey: string;
};

const SCHEMES: EncryptionScheme[] = ["pkcs1"];
const scheme_default: EncryptionScheme = SCHEMES[0];


export function encryptBuffer(
    passphrase: string,
    publicKey: string,
    data: string,
) {
    publicKey = publicKey.replace('\n', '');
    const engine = new JSEncrypt();
    engine.setPublicKey(publicKey);
    const encriptedPassphrase = engine.encrypt(passphrase);
    if (!encriptedPassphrase) {
        throw new Error("can't encrypt");
    }
    const aesEncrypted = AES.encrypt(data, passphrase);
    const encryptedMessage = aesEncrypted.toString();
    return {
        encriptedPassphrase,
        encryptedMessage,
    };
}


export function decryptBuffer(
    passphrase: string,
    publickKey: string,
    data: string,
) {
    publickKey = publickKey.replace('\n', '');
    const engine = new JSEncrypt();
    engine.setPublicKey(publickKey);
    const encriptedPassphrase = engine.encrypt(passphrase);
    if (!encriptedPassphrase) {
        throw new Error("can't encrypt");
    }
    const decrypted = AES.decrypt(
        data,
        passphrase
    ).toString(enc.Utf8);

    return decrypted;
}

export class ParametersSrv {

    static async encrypt(req: Request, res: Response) {
        const pass = General.readParam(req, "pass", "", true);
        const data = General.readParam(req, "data", "", true);
        if (!process.env.LOCAL_PUBLIC_KEY || !process.env.LOCAL_PRIVATE_KEY) {
            throw new Error("Miss configuration");
        }
        const {
            encriptedPassphrase,
            encryptedMessage,
        } = encryptBuffer(
            pass,
            process.env.LOCAL_PUBLIC_KEY,
            data,
        );

        const decripted = decryptBuffer(
            pass,
            process.env.LOCAL_PUBLIC_KEY,
            encryptedMessage,
        );

        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: { pass, data, encryptedMessage, decripted, encriptedPassphrase },
            timestamp: new Date()
        };
        res.status(201).json(response);
    }

    static decrypt(req: Request, res: Response) {
        const pass = General.readParam(req, "pass", "", true);
        const data = General.readParam(req, "data", "", true);
        if (!process.env.LOCAL_PUBLIC_KEY || !process.env.LOCAL_PRIVATE_KEY) {
            throw new Error("Miss configuration");
        }
        const decripted = decryptBuffer(
            pass,
            process.env.LOCAL_PUBLIC_KEY,
            data,
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