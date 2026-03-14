import { Request, Response } from 'express';
import { ApiResponse, InnerToolResponseType, ToolResponseType } from '../types/types';
import {
    Content,
    GenerateContentResponse,
    GoogleGenAI,
    Schema,
    ToolUnion,
    Type,
    type GenerateContentConfig,
} from "@google/genai";
import { InesperadoException, NoAutorizadoException } from '../errors';
import JSEncrypt from 'jsencrypt';
import { makeJsonToEncriptedTextResponse } from '../tools/General';
import { marked } from 'marked';
import { SupabaseSrv } from './supabase';
import { calendarSearchEvent } from '../chatTools/calendarSearch';
import { gescriptionOrNone, sendEmail } from '../chatTools/sendEmail';
import { searchArticle } from '../chatTools/searchArticle';
import { modifyGuestToMeeting } from '../chatTools/modifyGuestToMeeting';
import { decode } from '@msgpack/msgpack';
import { normalizeName } from '../tools/fieldTools';
import { searchFact } from '../chatTools/factSearch';

const renderer: any = {
    link({ href, raw, text, tokens, type }: any) {
        return `<a href="${href}" title="${text ?? ''}" target="_blank">${text}</a>`;
    }
};

marked.use({ renderer });



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

    static async generate(req: Request, res: Response) {
        const bodyText: any = decode(req.body.data);
        const body = JSON.parse(bodyText);
        const {
            history,
            config,
            pass,
            author,
            tools,
            extra,
            state,
            useFacts,
        } = body;
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
        let searchedResult: any[] = [];

        if (useFacts === true) {
            const embedMatches = await SupabaseSrv.searchEmbeedInternal(extra.assistantId, extra.q, extra.distance, extra.top);
            searchedResult = embedMatches.map((el: any) => {
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
        }

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
        const toolsStatus: ToolResponseType[] = [];

        castedConfig.tools = mapedTools;
        //console.log(JSON.stringify(mapedTools, null, 4));
        const answers: any[] = [];

        const getToolByName = (name: string) => {
            return tools.find((tool: any) => normalizeName(tool.name) == name);
        };

        const MAX_ITERATIONS = 5;
        let iterationCount = 0;

        do {
            if (iterationCount >= MAX_ITERATIONS) {
                break;
            }
            iterationCount++;
            let answer = await GeminiSrv.generateContent(usedHistory, castedConfig, author);
            answers.push(answer);

            const calls = answer.functionCalls;

            if (calls) {
                if (answer.candidates && answer.candidates.length > 0) {
                    const firstCandidate = answer.candidates[0];
                    if (firstCandidate && firstCandidate.content) {
                        usedHistory.push(firstCandidate.content);
                    }
                }
                for (let j = 0; j < calls.length; j++) {
                    const call = calls[j];
                    if (call.name) {
                        const tool = getToolByName(call.name);
                        let toolResponse: ToolResponseType | null = null;
                        let toolMessage: string | InnerToolResponseType = "ok";
                        if (tool) {
                            tool.args.forEach((arg: any) => {
                                const normalizedName = normalizeName(arg.name);
                                if (call.args) {
                                    const val = call.args[normalizedName];
                                    arg.val = val;
                                }
                            });
                            try {
                                if (tool.type == "mail") {
                                    toolResponse = await sendEmail(tool, reportHistory, state, author, extra.assistantId);
                                } else if (tool.type == "article") {
                                    toolResponse = await searchArticle(tool, reportHistory, extra.assistantId, extra.q);
                                } else if (tool.type == "fact") {
                                    toolResponse = await searchFact(tool, reportHistory, extra.assistantId, extra.q);
                                } else if (tool.type == "calendar_search") {
                                    toolResponse = await calendarSearchEvent(tool, reportHistory, extra.assistantId, extra.q);
                                } else if (tool.type == "calendar_write_guest") {
                                    toolResponse = await modifyGuestToMeeting(tool, reportHistory, extra.assistantId, extra.q);
                                } else {
                                    toolResponse = {
                                        name: call.name,
                                        message: "",
                                    };
                                }
                            } catch (err: any) {
                                toolResponse = {
                                    name: call.name,
                                    message: err.message,
                                    // The errors are not shoed to the user
                                    hidden: true,
                                };
                            }
                            if (toolResponse) {
                                toolsStatus.push(toolResponse);
                                toolMessage = toolResponse.message;
                            }
                            usedHistory.push({
                                role: 'function',
                                parts: [{
                                    functionResponse: {
                                        name: call.name,
                                        response: { result: toolMessage }
                                    }
                                }]
                            });
                        }
                    }
                }
            }
            if (answer.candidates && answer.candidates.length > 0) {
                const responseContent = answer.candidates[0].content;
                if (responseContent && responseContent.parts) {
                    const textPart = responseContent.parts.find(part => part.text);
                    if (textPart) {
                        break;
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        } while (true);

        if (iterationCount >= MAX_ITERATIONS) {
            // Generate a default response when the max repetition is exceded
            answers.push({ candidates: [{ content: { parts: [{ text: "Ok...", }] } }] });
        }

        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: {
                result: answers,
                toolsStatus,
                searchedResult,
            },
            timestamp: new Date()
        };
        makeJsonToEncriptedTextResponse(response, res, (decriptedKey + "a").split('').reverse().join(''));
    }
}