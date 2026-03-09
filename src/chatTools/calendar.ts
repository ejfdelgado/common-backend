import { CalendarService } from "../services/calendar.service";
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
        tool.calendarEmptyEvents === true,
        tool.calendarKeyword,
    );
    const castedEvent = (events as CalendarEventType[] | null);
    let message = "";
    let success = true;
    if (!castedEvent) {
        message = error ? error : "No schedule found. Try later.";
        success = false;
    } else {
        message = castedEvent.map(e => `- ${e.start.dateTime} (${e.start.timeZone})`).join(". ");
    }
    return {
        name: tool.name,
        message,
        success,
        events: castedEvent,
        hidden: true,
    };
}