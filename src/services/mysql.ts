import { ApiResponse, AuthenticatedRequest } from "../types";
import { createPool, Pool } from "mysql2/promise";
import { Response } from 'express';
import { General } from "../tools/General";

export class MySQLSrv {
    static pool: Pool | null = null;
    static getPool(): Pool {
        if (MySQLSrv.pool == null) {
            MySQLSrv.pool = createPool({
                host: process.env.MYSQL_HOST,
                //port: process.env.MYSQL_PORT,//not needed
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASS,
                database: process.env.MYSQL_DB,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
        }
        return MySQLSrv.pool;
    }

    static async check(req: AuthenticatedRequest, res: Response) {
        const script = General.readParam(req, "sql", 'SELECT VERSION();', false);
        const [dbResponse] = await MySQLSrv.getPool().query(script);
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: dbResponse,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }
}