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

    static async searchEmbeed(req: Request, res: Response) {
        const parent = General.readParam(req, "parent", "", true);
        const q = General.readParam(req, "q", null, true);
        const n = General.readParam(req, "n", 5, false);
        const embed = await EmbedSrv.embed(q);
        const embeddingString = JSON.stringify(embed);
        const sql = SupabaseSrv.getConnection();

        const results = await sql`
        SELECT 
            id, 
            (embedding <=> ${embeddingString}::vector) AS distance
        FROM document_embeddings
        WHERE parent = ${parent}
        ORDER BY distance ASC
        LIMIT ${n}
        `;

        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: results,
            timestamp: new Date()
        };

        res.status(201).json(response);
    }

    static async insertUpdateEmbeed(req: Request, res: Response) {
        const id = General.readParam(req, "id", "", true);
        const parent = General.readParam(req, "parent", "", true);
        const q = General.readParam(req, "q", null, false);
        const metadata = General.readParam(req, "metadata", {}, false);

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
            const old = await sql`SELECT embedding_txt from document_embeddings where id = ${id} AND parent=${parent};`;

            if (old.length == 0) {
                // make an insert
                const embed = await EmbedSrv.embed(q);
                const embeddingString = JSON.stringify(embed);
                await sql`INSERT INTO document_embeddings (id, parent, embedding, embedding_txt, metadata) VALUES (${id}, ${parent}, ${embeddingString}::vector, ${q}, ${metadata});`;
            } else {
                if (q != old[0].embedding_txt) {
                    const embed = await EmbedSrv.embed(q);
                    const embeddingString = JSON.stringify(embed);
                    // make an update embed (txt and vector) and metadata
                    await sql`UPDATE document_embeddings SET embedding = ${embeddingString}::vector, metadata = ${metadata}, embedding_txt = ${q} WHERE id=${id} AND parent=${parent};`;
                } else {
                    // make an update only of metadata
                    await sql`UPDATE document_embeddings SET metadata = ${metadata} WHERE id=${id} AND parent=${parent};`;
                }
            }

            response.data = {
                action: old.length == 0 ? "create" : "update",
            };
        }

        res.status(201).json(response);
    }

    static async pageEmbeed(req: Request, res: Response) {
        const parent = General.readParam(req, "parent", "", true);
        const limit = General.readParam(req, "limit", 50, false);
        const cursor = General.readParam(req, "cursor", null, false);

        const sql = SupabaseSrv.getConnection();

        let query: any = null;

        if (cursor) {
            // Page subsequent results
            query = sql`
      SELECT id, parent, created_at, metadata 
      FROM document_embeddings
      WHERE parent = ${parent} 
        AND (created_at, id) < (${cursor.createdAt}, ${cursor.id})
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
        } else {
            // Page the first results
            query = sql`
      SELECT id, parent, created_at, metadata 
      FROM document_embeddings
      WHERE parent = ${parent}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;

            const results = await query;

            const nextCursor = results.length > 0
                ? { createdAt: results[results.length - 1].created_at, id: results[results.length - 1].id }
                : null;

            const response: ApiResponse = {
                success: true,
                message: 'ok',
                data: {
                    rows: results,
                    nextCursor: nextCursor,
                },
                timestamp: new Date()
            };

            res.status(201).json(response);
        }
    }
};