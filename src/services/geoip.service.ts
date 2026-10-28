import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import maxmind, { CityResponse, Reader } from 'maxmind';
import { ApiResponse } from '../types/types';
import { InesperadoException, MalaPeticionException, NoExisteException } from '../errors';

/*
    Licence. DB-IP Lite is CC BY 4.0, so you need to show 
    "IP Geolocation by DB-IP" with a link somewhere your 
    app uses the data.
    Updates. Both databases are refreshed monthly. Run 
    "npm run geoip_download" before building the image, 
    or the data gets stale.
    */

// Any MaxMind-format city database works: DB-IP City Lite or MaxMind GeoLite2-City / GeoIP2-City
const GEOIP_DB_PATH = process.env.GEOIP_DB_PATH || path.join(process.cwd(), '.geoip', 'city.mmdb');

export class GeoIpSrv {
    static reader: Reader<CityResponse> | null = null;
    static loading: Promise<Reader<CityResponse>> | null = null;

    static async getReader(): Promise<Reader<CityResponse>> {
        if (GeoIpSrv.reader) {
            return GeoIpSrv.reader;
        }
        if (!GeoIpSrv.loading) {
            if (!fs.existsSync(GEOIP_DB_PATH)) {
                throw new InesperadoException(`GeoIP database not found at ${GEOIP_DB_PATH}`);
            }
            // watchForUpdates reloads the file in memory when it is replaced on disk
            GeoIpSrv.loading = maxmind.open<CityResponse>(GEOIP_DB_PATH, { watchForUpdates: true })
                .then((reader) => {
                    GeoIpSrv.reader = reader;
                    return reader;
                })
                .finally(() => {
                    GeoIpSrv.loading = null;
                });
        }
        return GeoIpSrv.loading;
    }

    static getClientIp(req: Request): string {
        // Cloud Run / load balancers put the original client first in x-forwarded-for
        const forwarded = req.headers['x-forwarded-for'];
        const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
        const ip = first || req.socket.remoteAddress || '';
        // IPv4 mapped into IPv6, e.g. ::ffff:181.49.10.1
        return ip.replace(/^::ffff:/i, '');
    }

    static lookup(reader: Reader<CityResponse>, ip: string) {
        const result = reader.get(ip);
        if (!result) {
            return null;
        }
        const name = (names?: { readonly en?: string }) => names?.en ?? null;
        return {
            ip,
            continent: result.continent ? { code: result.continent.code, name: name(result.continent.names) } : null,
            country: result.country ? { code: result.country.iso_code, name: name(result.country.names) } : null,
            subdivisions: (result.subdivisions ?? []).map((sub) => ({ code: sub.iso_code ?? null, name: name(sub.names) })),
            city: result.city ? name(result.city.names) : null,
            postalCode: result.postal?.code ?? null,
            location: result.location ? {
                latitude: result.location.latitude,
                longitude: result.location.longitude,
                accuracyRadiusKm: result.location.accuracy_radius ?? null,
                timeZone: result.location.time_zone ?? null,
            } : null,
        };
    }

    static async locate(req: Request, res: Response) {
        const ip = GeoIpSrv.getClientIp(req);
        if (!maxmind.validate(ip)) {
            throw new MalaPeticionException(`Invalid IP address: ${ip}`);
        }
        const reader = await GeoIpSrv.getReader();
        const data = GeoIpSrv.lookup(reader, ip);
        if (!data) {
            throw new NoExisteException(`No geolocation found for ${ip}`);
        }
        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }
}
