import { ApiResponse, AuthenticatedRequest } from "../types/types";
import { createPool, Pool, PoolOptions } from "mysql2/promise";
import { Response } from 'express';
import { General } from "../tools/General";

export class MySQLSrv {
    static pool: Pool | null = null;
    static getPool(): Pool {
        if (MySQLSrv.pool == null) {
            const config: PoolOptions = {
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASS,
                database: process.env.MYSQL_DB,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            };

            if (process.env.DB_SOCKET) {
                config.socketPath = process.env.DB_SOCKET;
            } else {
                config.host = process.env.MYSQL_HOST;
                config.port = parseInt(process.env.MYSQL_PORT ? process.env.MYSQL_PORT : "3306");
            }
            MySQLSrv.pool = createPool(config);
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