import { CalendarService } from "../services/calendar.service";
import { AssistantStateType, CalendarEventType, ChatToolContract, InnerToolResponseType, ToolDataType, ToolResponseType } from "../types/types";

const calendarSearchEvent: ChatToolContract = async (
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
    state: AssistantStateType,
    author: string,
): Promise<ToolResponseType | null> => {
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
                const { id, htmlLink, summary, start } = e;
                return {
                    id,
                    htmlLink,
                    summary,
                    start, //inside we have: dateTime, timeZone
                }
            }),
        };
    }
    return {
        name: tool.name,
        type: tool.type,
        message,
        success,
        hidden: true,
    };
};

export { calendarSearchEvent };