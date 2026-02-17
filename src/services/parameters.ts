import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { makeJsonToBinaryResponse } from '../tools/General';

export class ParametersSrv {
    static read(req: Request, res: Response) {
        const response: ApiResponse = {
            success: true,
            message: 'Data received successfully',
            data: {
                secret: "This is my secret",
            },
            timestamp: new Date()
        };
        makeJsonToBinaryResponse(response, res);
    }
}