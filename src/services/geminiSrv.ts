import { Request, Response } from 'express';
import { ApiResponse, AssistantStateType, AuthenticatedRequest, ToolDataType } from '../types';
import { Content, GenerateContentResponse, GoogleGenAI, Schema, ToolUnion, Type, type GenerateContentConfig } from "@google/genai";
import { InesperadoException, NoAutorizadoException } from '../errors';
import JSEncrypt from 'jsencrypt';
import { makeJsonToEncriptedTextResponse } from '../tools/General';
import { EmailHandler } from './email';
import { marked } from 'marked';
import { SupabaseSrv } from './supabase';
import { MyTuples, SimpleObj } from 'ejfdelgado-common-ts';
import { MyStore } from './firestore';
import { randomUUID } from 'crypto';
import { BucketsSrv } from './bucket';

const renderer: any = {
    link({ href, raw, text, tokens, type }: any) {
        return `<a href="${href}" title="${text ?? ''}" target="_blank">${text}</a>`;
        return "";
    }
};

marked.use({ renderer });

export function removeAccents(text: string): string {
    return text
        .normalize('NFD')                 // Separates characters from their accents
        .replace(/[\u0300-\u036f]/g, ''); // Removes the accent marks (combining marks)
};

export function normalizeName(name: string) {
    return removeAccents(name.toLowerCase()).replace(/[^a-z]/g, "_");
}

export function gescriptionOrNone(desc?: string) {
    if (typeof desc != "string") {
        return undefined;
    }
    let d = desc.trim();
    if (d.length > 0) {
        return d.trim();
    }
}

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
                const standarName = normalizeName(arg.name);
                properties[standarName] = {
                    type: arg.type,
                    description: gescriptionOrNone(arg.desc),
                };
                if (arg.required === true) {
                    required.push(standarName);
                }
            });
            return {
                functionDeclarations: [{
                    name: normalizeName(tool.name),
                    description: gescriptionOrNone(tool.desc),
                    parameters: {
                        type: Type.OBJECT,
                        properties: properties,
                        required: required,
                    },
                }],
            };
        });
    }

    static replaceArguments(template: string, args: any[]) {
        let rendered = template;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            const pattern = `\\$\\s*\\{\\s*${arg.name}\\s*\\}`;
            rendered = rendered.replace(new RegExp(pattern, "ig"), arg.val);
        }
        return rendered;
    }

    static async searchArticle(tool: any, history: any[], assistantId: string, userQuery: string) {
        const { error, keywords } = tool;
        const success: boolean = true;
        let message = "";

        const searched: string[] = tool.args.map((arg: any) => arg.val);

        const completeSearch = keywords + " " + [...searched].join(" ");

        const matches = await SupabaseSrv.searchArticleInternal(assistantId, completeSearch, 1);

        if (matches.length == 0) {
            message = GeminiSrv.replaceArguments(error, tool.args);
            // No need to wait, maybe...
            MyStore.create(`knowledge/${assistantId}/history`, {
                checked: false,
                type: "not_found",
                searchText: completeSearch,
                userQuery,
                desc: tool.name,
                created: Date.now(),
            });
        } else {
            message = GeminiSrv.replaceArguments(matches[0].desc, tool.args);
        }

        return {
            name: tool.name,
            message,
            success,
            articles: matches,
        };
    }

    static async sendEmail(
        tool: ToolDataType,
        history: any[],
        state: AssistantStateType,
        author: string,
        assistantId: string,
        template: string = "mails/chat_history_orig.html",
    ) {
        // Simplify last message:
        if (history.length > 0 && history[history.length - 1].parts.length > 0) {
            let lastMessage = history[history.length - 1].parts[0].text;
            if (typeof lastMessage == "string") {
                lastMessage = lastMessage.replace(/^.*\[USER QUESTION\]\n/igs, "");
                history[history.length - 1].parts[0].text = lastMessage;
            }
        }
        let success = true;
        let message = GeminiSrv.replaceArguments(tool.ok ? tool.ok : "Ok default message.", tool.args);
        try {
            // Iterate history to use MD when needed
            history.forEach((message) => {
                if (message.role == 'model') {
                    if (message.parts[0].text) {
                        message.parts[0].text = marked.parse(message.parts[0].text);
                    }
                }
            });
            const tuples = MyTuples.getTuples(state);
            const keys = Object.keys(tuples);
            const stateList: any[] = [];
            keys.forEach((k) => {
                stateList.push({ key: k, val: JSON.stringify(SimpleObj.getValue(state, k)) })
            });

            let customTemplate = template;
            if (typeof tool.template == "string" && tool.template.trim().length > 0) {
                customTemplate = tool.template.trim();
            }

            const response = await EmailHandler.sendInternal({
                params: { tool, history, state, stateList },
                subject: `Assistant - ${tool.name}`,
                template: customTemplate,
                to: tool.to,
            }, true, undefined, false, false);

            const reportId = randomUUID();
            const { contenidoFinal, result } = response;

            const promises: Promise<any>[] = [];
            promises.push(result);

            // Upload to bucket on path author/assistantId
            const ahora = new Date();
            const year = ahora.getFullYear();
            const month = ahora.getMonth() + 1;
            const path = `alterego/${author}/${assistantId}/reports/${year}/${month}/${reportId}.html`;

            // Insert on history
            promises.push(MyStore.create(`knowledge/${assistantId}/history`, {
                checked: false,
                type: tool.type,//email always
                desc: tool.name,
                created: Date.now(),
                reportId: path,
            }));

            promises.push(BucketsSrv.uploadStringAsText(path, contenidoFinal, "text/html"));

            await Promise.all(promises);
        } catch (err) {
            console.log(err);
            success = false;
            message = GeminiSrv.replaceArguments(tool.error ? tool.error : "Error default message.", tool.args);
        }

        return {
            name: tool.name,
            message,
            success,
        };
    }

    static async generate(req: Request, res: Response) {
        const { history, config, pass, author, tools, extra, state } = req.body;
        const historyNoNull: any[] = history instanceof Array ? history : [];
        //console.log(JSON.stringify(state, null, 4));
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

        let retrievedFacts: string[] = [];
        const embedMatches = await SupabaseSrv.searchEmbeedInternal(extra.assistantId, extra.q, extra.distance, extra.top);
        const searchedResult = embedMatches.map((el: any) => {
            return {
                metadata: el.metadata,
                distance: el.distance,
            };
        });
        retrievedFacts = searchedResult.map((el: any) => {
            if (el.metadata.type == "question") {
                return el.metadata.answerFormat ? el.metadata.answerFormat : el.metadata.txtFormat;
            } else {
                return el.metadata.txtFormat;
            }
        });
        const contextBlock = retrievedFacts.length > 0
            ? `[CONTEXT DATA]\n${retrievedFacts.join("\n")}\n\n[USER QUESTION]\n`
            : "";

        const userMessage: Content = {
            role: "user",
            parts: [{ text: contextBlock + extra.q }]
        };
        const simpleMessage: Content = {
            role: "user",
            parts: [{ text: extra.q }]
        };

        const usedHistory = [...historyNoNull, userMessage];
        const reportHistory = [...historyNoNull, simpleMessage];

        castedConfig.tools = mapedTools;
        const answer = await GeminiSrv.generateContent(usedHistory, castedConfig, author);

        const getToolByName = (name: string) => {
            return tools.find((tool: any) => normalizeName(tool.name) == name);
        };

        const calls = answer.functionCalls;
        const toolsStatus: any[] = [];
        if (calls) {
            for (let j = 0; j < calls.length; j++) {
                const call = calls[j];
                if (call.name) {
                    const tool = getToolByName(call.name);
                    if (tool) {
                        tool.args.forEach((arg: any) => {
                            const normalizedName = normalizeName(arg.name);
                            if (call.args) {
                                const val = call.args[normalizedName];
                                arg.val = val;
                            }
                        });
                        if (tool.type == "mail") {
                            toolsStatus.push(await GeminiSrv.sendEmail(tool, reportHistory, state, author, extra.assistantId));
                        } else if (tool.type == "article") {
                            toolsStatus.push(await GeminiSrv.searchArticle(tool, reportHistory, extra.assistantId, extra.q));
                        }
                    }
                }
            }
        }

        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: {
                result: answer,
                toolsStatus,
                searchedResult,
            },
            timestamp: new Date()
        };
        makeJsonToEncriptedTextResponse(response, res, (decriptedKey + "a").split('').reverse().join(''));
    }
}