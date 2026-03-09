import { CalendarService } from "../services/calendar.service";
import { CalendarEventType, ToolResponseType } from "../types";

export async function calendarSearchEvent(
    tool: any,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    const { error, ok } = tool;
    const events = await CalendarService.searchInternal(assistantId, tool.id, 5, tool.calendarMinHoursGap, tool.calendarKeyword);
    const castedEvent = (events as CalendarEventType[] | null);
    let message = ok;
    let success = true;
    if (!castedEvent) {
        message = error;
        success = false;
    }
    return {
        name: tool.name,
        message,
        success,
        events: castedEvent,
    };
}