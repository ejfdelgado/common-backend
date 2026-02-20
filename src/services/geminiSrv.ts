import { Request, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { GenerateContentResponse, GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { InesperadoException, NoAutorizadoException } from '../errors';
import JSEncrypt from 'jsencrypt';
import { makeJsonToEncriptedTextResponse } from '../tools/General';

export class GeminiSrv {

    static client_: GoogleGenAI | null = null;

    static getClient(): GoogleGenAI {
        if (!GeminiSrv.client_) {
            GeminiSrv.client_ = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        }
        return GeminiSrv.client_;
    }

    static async generateContent(history: any[], config: GenerateContentConfig): Promise<GenerateContentResponse> {
        const client = GeminiSrv.getClient();
        if (!process.env.GEMINI_MODEL) {
            throw new InesperadoException("Model not found");
        }
        const response = await client.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: history,
            config: config
        });
        return response;
    }

    static async generate(req: Request, res: Response) {
        const { history, config, pass } = req.body;

        // Decript the pass with the private key
        let privateKey = process.env.LOCAL_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("Missconfigured");
        }
        privateKey = privateKey.replace('\n', '');
        const decrypt = new JSEncrypt();
        decrypt.setPrivateKey(privateKey);
        let decriptedKey = decrypt.decrypt(pass);
        if (!decriptedKey || decriptedKey.length != 20) {
            throw new Error("");
        }
        const answer = await GeminiSrv.generateContent(history, config);
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: answer,
            timestamp: new Date()
        };
        makeJsonToEncriptedTextResponse(response, res, (decriptedKey + "a").split('').reverse().join(''));
    }
}