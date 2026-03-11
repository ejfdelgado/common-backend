import { CalendarService } from "../services/calendar.service";
import { epochTo } from "../tools/DateUtils";
import { CalendarEventType, ToolDataType, ToolResponseType } from "../types";

export async function calendarSearchEvent(
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    const { error } = tool;
    const events = await CalendarService.searchInternal(
        assistantId,
        tool.id,
        tool.calendarMaxEvents,
        tool.calendarMinHoursGap,
        tool.calendarMaxGuests,
        tool.calendarKeyword,
    );
    const castedEvent = (events as CalendarEventType[] | null);
    let message = "";
    let success = true;
    if (!castedEvent) {
        message = error ? error : "No schedule found. Try later.";
        success = false;
    } else {
        message = castedEvent.map(e => `- id: ${e.id} date: ${epochTo(new Date(e.start.dateTime).getTime(), 'v5')} (${e.start.timeZone})`).join(".\n");
    }
    return {
        name: tool.name,
        message,
        success,
        events: castedEvent,
        hidden: true,
    };
}