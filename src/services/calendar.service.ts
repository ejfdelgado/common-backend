import { General } from "../tools/General";
import { ApiResponse, AuthenticatedRequest, AuthenticatedUser } from "../types";
import { Response } from 'express';
import { MyStore } from "./firestore";
import { NoAutorizadoException } from "../errors";
import { google } from "googleapis";

export class CalendarService {

    static async findMeetingByType(auth: any, max: number = 3, hoursGap: number = 0, typeKeyword: string) {
        const calendar = google.calendar({ version: 'v3', auth });

        let hours = hoursGap;
        if (isNaN(hours)) {
            hours = 0;
        }
        const millis = Date.now() + (1000 * 60 * 60 * hoursGap);
        const timeMin = new Date(millis).toISOString();
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            maxResults: max,
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

    static async preprocessRequest(parentRawId: string, toolRawId: string, user?: AuthenticatedUser) {
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

        const { calendarUser } = tool;

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
        return {
            auth,
            tool,
        };
    }

    static async searchInternal(
        parentRawId: string,
        toolRawId: string,
        max: number = 3,
        hoursGap: number = 0,
        calendarMaxGuests: number = 999,
        text?: string,
        user?: AuthenticatedUser,
    ) {
        // Read the tool and parent if needed
        // Check the current user is in the owners of the parent...
        if (!max) {
            max = 3;
        }
        if (!hoursGap) {
            hoursGap = 0;
        }

        const {
            auth,
            tool,
        } = await CalendarService.preprocessRequest(parentRawId, toolRawId, user);

        const { calendarKeyword } = tool;

        let keyword = calendarKeyword;
        if (text) {
            keyword = text;
        }

        let eventsFound = await CalendarService.findMeetingByType(
            auth,
            max,
            hoursGap,
            keyword,
        );
        if (!eventsFound) {
            return eventsFound;
        }


        const meetingsWithoutGuests = eventsFound.filter(event => {
            if (!event.attendees) {
                // no guests
                return true;
            } else if (event.attendees.length === 0) {
                // zero guests
                return true;
            } else {
                // Some guests
                // filter
                const forbidList: string[] = [];
                if (event.creator?.email) {
                    forbidList.push(event.creator.email);
                }
                if (event.organizer?.email) {
                    if (forbidList.indexOf(event.organizer.email) < 0) {
                        forbidList.push(event.organizer.email);
                    }
                }
                if (forbidList.length > 0) {
                    const others = event.attendees.filter(e => !e.email || forbidList.indexOf(e.email) < 0);
                    return others.length < calendarMaxGuests;
                } else {
                    return false;
                }
            }
        });
        if (meetingsWithoutGuests.length == 0) {
            return null;
        }
        return meetingsWithoutGuests;
    }

    static async search(req: AuthenticatedRequest, res: Response) {
        const parentRawId: string = General.readParam(req, "parent", "", true);
        const toolRawId: string = General.readParam(req, "toolId", "", true);
        const text: string = General.readParam(req, "text", null, false);
        const maxGuests = parseInt(General.readParam(req, "maxGuests", "999", false));
        let max = parseInt(General.readParam(req, "maxEvents", "3", false));
        let hoursGap = parseInt(General.readParam(req, "hoursGap", "6", true));
        const user = req.user;
        if (!user) {
            throw new NoAutorizadoException("No user");
        }

        const events = await CalendarService.searchInternal(parentRawId, toolRawId, max, hoursGap, maxGuests, text, user);

        const response: ApiResponse = {
            success: true,
            message: 'Ok',
            data: events,
            timestamp: new Date()
        };
        res.status(200).json(response);
    }

    static async addGuestToMeeting(
        parentRawId: string,
        toolRawId: string,
        eventId: string,
        guestEmail: string,
        user?: AuthenticatedUser
    ) {

        const {
            auth,
            tool,
        } = await CalendarService.preprocessRequest(parentRawId, toolRawId, user);

        const calendar = google.calendar({ version: 'v3', auth });

        // 1. Fetch the current event to get the existing attendee list
        const event = await calendar.events.get({
            calendarId: 'primary',
            eventId: eventId,
        });

        let attendees = event.data.attendees || [];

        // 2. Check if guest is already there
        const alreadyInvited = attendees.some(a => a.email === guestEmail);

        if (!alreadyInvited) {
            attendees.push({ email: guestEmail });

            // 3. Patch the event with the new attendee list
            await calendar.events.patch({
                calendarId: 'primary',
                eventId: eventId,
                sendUpdates: 'all', // THIS IS KEY: It triggers the invite and calendar sync
                requestBody: {
                    attendees: attendees,
                },
            });
            return true;
        } else {
            return true;
        }
    }
}