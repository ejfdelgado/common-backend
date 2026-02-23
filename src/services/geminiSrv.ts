import { Request, Response } from 'express';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { GenerateContentResponse, GoogleGenAI, Schema, ToolUnion, Type, type GenerateContentConfig } from "@google/genai";
import { InesperadoException, NoAutorizadoException } from '../errors';
import JSEncrypt from 'jsencrypt';
import { makeJsonToEncriptedTextResponse } from '../tools/General';

export class GeminiSrv {

    static async generateContent(history: any[], config: GenerateContentConfig, author: string): Promise<GenerateContentResponse> {
        const ENV_KEY = `GEMINI_${author}`;
        const KEY_VAL = process.env[ENV_KEY];
        if (!KEY_VAL) {
            throw new NoAutorizadoException("Not configured");
        }
        const client = new GoogleGenAI({ apiKey: KEY_VAL });
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


    static mapTools(tools: any[]): ToolUnion[] {
        return tools.map((tool: any) => {
            const required: string[] = [];
            const properties: Record<string, Schema> = {};
            tool.args.forEach((arg: any) => {
                properties[arg.name] = {
                    type: arg.type,
                    description: arg.desc,
                };
                if (arg.required === true) {
                    required.push(arg.name);
                }
            });
            return {
                functionDeclarations: [{
                    name: tool.name,
                    description: tool.desc,
                    parameters: {
                        type: Type.OBJECT,
                        properties: properties,
                        required: required,
                    },
                }],
            };
        });
    }

    static async generate(req: Request, res: Response) {
        const { history, config, pass, author, tools } = req.body;
        const castedConfig: GenerateContentConfig = config;
        const mapedTools = GeminiSrv.mapTools(tools);
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
        castedConfig.tools = mapedTools;
        const answer = await GeminiSrv.generateContent(history, castedConfig, author);

        const calls = answer.functionCalls;
        if (calls) {
            /*
            [
                {
                    "name": "notify_user_provide_contact_info",
                    "args": {
                        "user_contact_info": "edgar.jose.fernando.delgado@gmail.com"
                    }
                }
            ]
            */
        }

        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: answer,
            timestamp: new Date()
        };
        makeJsonToEncriptedTextResponse(response, res, (decriptedKey + "a").split('').reverse().join(''));
    }
}