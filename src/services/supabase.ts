import postgres from 'postgres';
import { Request, Response } from 'express';
import { InesperadoException } from '../errors';
import { MyTemplate } from 'ejfdelgado-common-ts';
import { ApiResponse } from '../types';
import { setDefaultResultOrder } from 'node:dns';
import { General } from '../tools/General';
import { EmbedSrv } from './embeed.service';

//setDefaultResultOrder('ipv4first');

export class SupabaseSrv {

    static renderer = new MyTemplate();
    static sql: any = null;

    static {
        SupabaseSrv.renderer.registerFunction("noQuotes", SupabaseSrv.noQuotes);
        SupabaseSrv.renderer.registerFunction("singleWord", SupabaseSrv.singleWord);
        SupabaseSrv.renderer.registerFunction("sanitizeNumber", SupabaseSrv.sanitizeNumber);
        SupabaseSrv.renderer.registerFunction("sanitizeText", SupabaseSrv.sanitizeText);
        SupabaseSrv.renderer.registerFunction("sanitizeTextNull", SupabaseSrv.sanitizeTextNull);
    }

    static getConnection() {
        if (SupabaseSrv.sql == null) {
            if (!process.env.SUPABASE_DATABASE_URL) {
                throw new InesperadoException("No SUPABASE_DATABASE_URL");
            }
            const connectionString: string = process.env.SUPABASE_DATABASE_URL;
            SupabaseSrv.sql = postgres(connectionString);
        }
        return SupabaseSrv.sql;
    }

    static noQuotes(val: any, ...args: any) {
        if ([null, undefined].indexOf(val) >= 0) {
            return "NULL";
        }
        return val.replace(/'/g, "''");
    }
    static singleWord(val: any, ...args: any) {
        const text = SupabaseSrv.sanitizeTextNull(val);
        return text.split(/\s+/g)[0];
    }
    static sanitizeText(val: any, ...args: any) {
        let text = val;
        if ([null, undefined].indexOf(text) >= 0) {
            if (typeof args[0] == "string") {
                return args[0];
            }
            return "";
        }
        text = `${text}`;
        text = SupabaseSrv.noQuotes(text);
        return text;
    }
    static sanitizeTextNull(val: any, ...args: any) {
        if ([null, undefined].indexOf(val) >= 0) {
            return "NULL";
        }
        let text = SupabaseSrv.noQuotes(`${val}`, args);
        return text;
    }
    static sanitizeNumber(val: any, ...args: any) {
        let myNumber = parseFloat(val);
        if (isNaN(myNumber)) {
            if (typeof args[0] == "number") {
                return args[0];
            }
            return 'NULL';
        }
        return myNumber;
    }

    static async checkSelect1() {
        const sql = SupabaseSrv.getConnection();
        const ping = await sql`SELECT 1 AS status;`;
        return ping;
    }

    static async check1(req: Request, res: Response) {
        const rows = await SupabaseSrv.checkSelect1();
        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: rows,
            timestamp: new Date()
        };
        res.status(201).json(response);
    }

    static async insertUpdateEmbeed(req: Request, res: Response) {
        const id = General.readParam(req, "id", "", true);
        const parent = General.readParam(req, "parent", "", true);
        const q = General.readParam(req, "q", null, false);
        // Crete the embed
        const promesas: Promise<any>[] = [];
        const sql = SupabaseSrv.getConnection();

        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: null,
            timestamp: new Date()
        };

        if (q === null) {
            // delete
            await sql`DELETE FROM document_embeddings WHERE id=${id} AND parent=${parent};`;
            response.data = {
                action: "delete",
            };
        } else {
            promesas.push(new Promise(async (resolve, reject) => {
                try {
                    const embed = await EmbedSrv.embed(q);
                    const embeddingString = JSON.stringify(embed);
                    resolve(embeddingString);
                } catch (err) {
                    reject(err);
                }
            }));
            promesas.push(sql`SELECT 1 as found from document_embeddings where id = ${id} AND parent=${parent};`);

            const [embeddingString, old] = await Promise.all(promesas);

            if (old.length == 0) {
                // make an insert
                await sql`INSERT INTO document_embeddings (id, parent, embedding) VALUES (${id}, ${parent}, ${embeddingString}::vector);`;
            } else {
                // make an update
                await sql`UPDATE document_embeddings SET embedding = ${embeddingString}::vector WHERE id=${id} AND parent=${parent};`;
            }

            response.data = {
                action: old.length == 0 ? "create" : "update",
            };
        }

        res.status(201).json(response);
    }
};