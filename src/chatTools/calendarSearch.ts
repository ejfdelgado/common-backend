import { CalendarService } from "../services/calendar.service";
import { epochTo } from "../tools/DateUtils";
import { CalendarEventType, InnerToolResponseType, ToolDataType, ToolResponseType } from "../types/types";

export async function calendarSearchEvent(
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    const events = await CalendarService.searchInternal(
        assistantId,
        tool.id,
        tool.calendarMaxEvents,
        tool.calendarMinHoursGap,
        tool.calendarMaxGuests,
        tool.calendarKeyword,
    );
    const castedEvent = (events as CalendarEventType[] | null);
    let message: string | InnerToolResponseType = "";
    let success = true;
    if (!castedEvent) {
        message = {
            success: false,
            data: [],
            error: "No schedule found. Try later."
        };
        success = false;
    } else {
        message = {
            error: null,
            success: true,
            data: castedEvent.map((e) => {
                return {
                    id: e.id,
                    date: e.start.dateTime,
                    timeZone: e.start.timeZone,
                }
            }),
        };
    }
    return {
        name: tool.name,
        type: tool.type,
        message,
        success,
        events: castedEvent,
        hidden: true,
    };
}