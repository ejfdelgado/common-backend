import { General } from "../tools/General";
import { ApiResponse, AuthenticatedRequest, AuthenticatedUser } from "../types";
import { Response } from 'express';
import { MyStore } from "./firestore";
import { NoAutorizadoException } from "../errors";
import { google } from "googleapis";

export class CalendarService {

    static async findMeetingByType(auth: any, typeKeyword: string) {
        const calendar = google.calendar({ version: 'v3', auth });

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 3,
            singleEvents: true,
            orderBy: 'startTime',
            q: typeKeyword,
        });

        const events = res.data.items;
        if (!events || events.length === 0) {
            return null;
        }

        // Return the first match or a list
        return events;
    }

    static async searchInternal(parentRawId: string, toolRawId: string, text?: string, user?: AuthenticatedUser) {
        // Read the tool and parent if needed
        // Check the current user is in the owners of the parent...
        const promises = [];
        promises.push(MyStore.readById(`knowledge/${parentRawId}/tool`, toolRawId));
        if (user) {
            promises.push(MyStore.readById(`knowledge`, parentRawId));
        }
        const results = await Promise.all(promises);
        const tool = results[0];

        if (user) {
            const parent = results[1];
            const { owners } = parent;
            if (owners.indexOf(user.uid) < 0) {
                throw new NoAutorizadoException("User is not owner");
            }
        }

        const { calendarUser, calendarKeyword } = tool;

        if (!calendarUser || !calendarUser.uid) {
            throw new NoAutorizadoException("Calendar user not configured");
        }

        // Get the refreshToken
        const personal = await MyStore.readById("personal", calendarUser.uid);

        if (!personal) {
            throw new NoAutorizadoException("User did not grant permissions");
        }

        const { refreshToken } = personal;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: refreshToken });

        let keyword = calendarKeyword;
        if (text) {
            keyword = text;
        }

        return await CalendarService.findMeetingByType(auth, keyword);
    }

    static async search(req: AuthenticatedRequest, res: Response) {
        const parentRawId: string = General.readParam(req, "parent", "", true);
        const toolRawId: string = General.readParam(req, "toolId", "", true);
        const text: string = General.readParam(req, "text", null, false);
        const user = req.user;
        if (!user) {
            throw new NoAutorizadoException("No user");
        }

        const events = await CalendarService.searchInternal(parentRawId, toolRawId, text, user);

        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: events,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }
}