import { ParametrosIncompletosException } from '../errors';
import express, { Request, Response, NextFunction } from "express";

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => any>(
    fn: T
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export class General {

    static readParam(req: Request, name: string, pred: any = null, complain: boolean = false) {
        const nameLower = name.toLowerCase();
        let first = undefined;
        if (req.body) {
            req.body[name];
        }
        if (first !== undefined) {
            return first;
        } else if (req.query && name in req.query) {
            return req.query[name];
        } else if (req.query && nameLower in req.query) {
            return req.query[nameLower];
        } else if (req.params && name in req.params) {
            return req.params[name];
        } else if (req.params && nameLower in req.params) {
            return req.params[nameLower];
        }
        if (complain) {
            throw new ParametrosIncompletosException(`Parameter not found but required: ${name}`);
        }
        return pred;
    }
}