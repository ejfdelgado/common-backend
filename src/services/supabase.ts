import postgres from 'postgres';
import { Request, Response } from 'express';
import { InesperadoException, NoAutorizadoException, ParametrosIncompletosException } from '../errors';
import { MyTemplate } from 'ejfdelgado-common-ts';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { setDefaultResultOrder } from 'node:dns';
import { General } from '../tools/General';
import { EmbedSrv } from './embeed.service';
import { MyStore } from './firestore';

//setDefaultResultOrder('ipv4first');

const EN_STOPWORDS = new Set([
    "of", "the", "to", "and", "a", "an", "in", "on", "at", "for", "with",
    "by", "from", "about", "as", "into", "like", "through", "after",
    "over", "between", "out", "against", "during", "without", "before",
    "under", "around", "among"
]);

const ES_STOPWORDS = new Set([
    "de", "la", "el", "los", "las", "un", "una", "unos", "unas",
    "y", "o", "en", "con", "por", "para", "del", "al",
    "que", "como", "más", "pero", "sus", "le", "ya", "si",
    "porque", "esta", "este", "estos", "estas"
]);

const STOPWORDS = new Set([...EN_STOPWORDS, ...ES_STOPWORDS]);

export function preprocessSearchText(input: string): string {
    if (!input) return "";

    return input
        // Normalize accents (á → a, ñ → n)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")

        // Lowercase
        .toLowerCase()

        // Remove punctuation
        .replace(/[^\p{L}\p{N}\s]/gu, " ")

        // Split into tokens
        .split(/\s+/)

        // Remove empty, short tokens, and stopwords
        .filter(word =>
            word.length > 2 &&
            !STOPWORDS.has(word)
        ).join(" ");
}

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

    static async searchEmbeedInternal(
        parent: string,
        q: string,
        distance: number,
        n: number,

    ) {
        const embed = await EmbedSrv.embed(q);
        const embeddingString = JSON.stringify(embed);
        const sql = SupabaseSrv.getConnection();

        const results = await sql`
        SELECT 
            id, 
            (embedding <=> ${embeddingString}::vector) AS distance,
            metadata,
            created_at
        FROM document_embeddings
        WHERE parent = ${parent}
        ORDER BY distance ASC
        LIMIT ${n}
        `;
        SupabaseSrv.assureMetadataJson(results);
        return results.filter((row: any) => row.distance <= distance)
            .map((row: any) => { row.metadata.created = parseInt(row.created_at); return row; });
    }

    static async searchEmbeed(req: Request, res: Response) {
        const parent = General.readParam(req, "parent", "", true);
        const q = General.readParam(req, "q", null, true);
        const distance = parseFloat(General.readParam(req, "distance", "1", true));
        const n = parseInt(General.readParam(req, "n", 5, false));

        const results = await SupabaseSrv.searchEmbeedInternal(parent, q, distance, n);

        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: results,
            timestamp: new Date()
        };

        res.status(201).json(response);
    }

    static async checkPermissions(req: AuthenticatedRequest, parentId: string) {
        if (!req.user?.uid) {
            throw new NoAutorizadoException("No user");
        }
        // Check permission over parent collection
        const oldDoc = await MyStore.readById("knowledge", parentId);
        if (oldDoc.owners instanceof Array) {
            // Check current user is in
            if (!req.user?.uid || oldDoc.owners.indexOf(req.user.uid) < 0) {
                throw new NoAutorizadoException("Not owner");
            }
        }
    }

    static async crudEmbeed(req: AuthenticatedRequest, res: Response) {
        const id = General.readParam(req, "id", null, false);
        const parent = General.readParam(req, "parent", "", true);
        const q = General.readParam(req, "q", null, false);
        const metadata = General.readParam(req, "metadata", {}, false);

        await SupabaseSrv.checkPermissions(req, parent);

        const sql = SupabaseSrv.getConnection();

        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: {},
            timestamp: new Date()
        };

        if (q === null) {
            // delete
            if (!id || id.trim().length == 0) {
                throw new ParametrosIncompletosException("id missed");
            }
            await sql`DELETE FROM document_embeddings WHERE id=${id} AND parent=${parent};`;
            response.data.action = "delete";
            response.data.id = id;
        } else {
            if (!id || id.trim().length == 0) {
                // make an insert
                const embed = await EmbedSrv.embed(q);
                const embeddingString = JSON.stringify(embed);
                const [insertedRow] = await sql`INSERT INTO document_embeddings (parent, embedding, embedding_txt, metadata) VALUES (${parent}, ${embeddingString}::vector, ${q}, ${metadata}) RETURNING id, created_at;`;
                response.data.action = "insert";
                response.data.id = insertedRow.id;
                response.data.created_at = insertedRow.created_at;
            } else {
                const old = await sql`SELECT embedding_txt from document_embeddings where id = ${id} AND parent=${parent};`;
                // Is there a risk it may not exists?
                if (q != old[0].embedding_txt) {
                    const embed = await EmbedSrv.embed(q);
                    const embeddingString = JSON.stringify(embed);
                    // make an update embed (txt and vector) and metadata
                    await sql`UPDATE document_embeddings SET embedding = ${embeddingString}::vector, metadata = ${metadata}, embedding_txt = ${q} WHERE id=${id} AND parent=${parent};`;
                } else {
                    // make an update only of metadata
                    await sql`UPDATE document_embeddings SET metadata = ${metadata} WHERE id=${id} AND parent=${parent};`;
                }
                response.data.action = "update";
                response.data.id = id;
            }
        }

        res.status(201).json(response);
    }

    static async pageEmbeed(req: AuthenticatedRequest, res: Response) {
        const parent = General.readParam(req, "parent", "", true);
        const limit = General.readParam(req, "limit", 50, false);
        const cursor = General.readParam(req, "cursor", null, false);

        await SupabaseSrv.checkPermissions(req, parent);

        const sql = SupabaseSrv.getConnection();

        let query: any = null;

        if (cursor) {
            // Page subsequent results
            query = sql`
      SELECT id, metadata, created_at 
      FROM document_embeddings
      WHERE parent = ${parent} 
        AND (created_at, id) < (${cursor.createdAt}, ${cursor.id})
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
        } else {
            // Page the first results
            query = sql`
      SELECT id, metadata, created_at 
      FROM document_embeddings
      WHERE parent = ${parent}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
        }
        let results: any[] = [];
        results = await query;

        const nextCursor = results.length >= limit
            ? { createdAt: results[results.length - 1].created_at, id: results[results.length - 1].id }
            : null;

        SupabaseSrv.assureMetadataJson(results);

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

    static assureMetadataJson(results: any[]) {
        results.forEach((el: any) => {
            if (typeof el.metadata == "string") {
                try {
                    el.metadata = JSON.parse(el.metadata);
                } catch (err) { }
            }
        });
    }

    static async pageArticle(req: AuthenticatedRequest, res: Response) {
        const parent = General.readParam(req, "parent", "", true);
        const limit = General.readParam(req, "limit", 50, false);
        const cursor = General.readParam(req, "cursor", null, false);

        await SupabaseSrv.checkPermissions(req, parent);

        const sql = SupabaseSrv.getConnection();

        let query: any = null;

        if (cursor) {
            // Page subsequent results
            query = sql`
      SELECT id, metadata, created_at 
      FROM articles
      WHERE parent = ${parent} 
        AND (created_at, id) < (${cursor.createdAt}, ${cursor.id})
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
        } else {
            // Page the first results
            query = sql`
      SELECT id, metadata, created_at 
      FROM articles
      WHERE parent = ${parent}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
        }
        let results: any[] = [];
        results = await query;

        const nextCursor = results.length >= limit
            ? { createdAt: results[results.length - 1].created_at, id: results[results.length - 1].id }
            : null;

        SupabaseSrv.assureMetadataJson(results);

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

    static async crudArticle(req: AuthenticatedRequest, res: Response) {
        const id = General.readParam(req, "id", null, false);
        const parent = General.readParam(req, "parent", "", true);
        const q1 = General.readParam(req, "q", null, false);
        const metadata = General.readParam(req, "metadata", {}, false);

        await SupabaseSrv.checkPermissions(req, parent);

        const sql = SupabaseSrv.getConnection();

        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: {},
            timestamp: new Date()
        };

        if (q1 === null) {
            // delete
            if (!id || id.trim().length == 0) {
                throw new ParametrosIncompletosException("id missed");
            }
            await sql`DELETE FROM articles WHERE id=${id} AND parent=${parent};`;
            response.data.action = "delete";
            response.data.id = id;
        } else {
            const q = preprocessSearchText(q1);
            if (!id || id.trim().length == 0) {
                // make an insert
                const [insertedRow] = await sql`INSERT INTO articles (parent, keywords, metadata) VALUES (${parent}, ${q}, ${metadata}) RETURNING id, created_at;`;
                response.data.action = "insert";
                response.data.id = insertedRow.id;
                response.data.created_at = insertedRow.created_at;
            } else {
                await sql`UPDATE articles SET keywords = ${q}, metadata = ${metadata} WHERE id=${id} AND parent=${parent};`;
                response.data.action = "update";
                response.data.id = id;
            }
        }

        res.status(201).json(response);
    }

    static async searchArticleInternal(
        parent: string,
        q1: string,
        n: number,
    ) {
        const q = preprocessSearchText(q1);
        const sql = SupabaseSrv.getConnection();
        const results = await sql`
        SELECT 
            id, 
            metadata,
            created_at
        FROM articles
        WHERE parent = ${parent}
        AND fts_vector @@ websearch_to_tsquery('simple', ${q})
        LIMIT ${n}
        `;
        SupabaseSrv.assureMetadataJson(results);
        return results
            .map((row: any) => { row.metadata.created = parseInt(row.created_at); return row.metadata; });
    }

    static async searchArticle(req: AuthenticatedRequest, res: Response) {
        const parent = General.readParam(req, "parent", "", true);
        const q = General.readParam(req, "q", null, true);
        const n = General.readParam(req, "n", 1, false);

        await SupabaseSrv.checkPermissions(req, parent);

        const results = await SupabaseSrv.searchArticleInternal(parent, q, n);

        const response: ApiResponse = {
            success: true,
            message: 'ok',
            data: results,
            timestamp: new Date()
        };
        res.status(201).json(response);
    }
};