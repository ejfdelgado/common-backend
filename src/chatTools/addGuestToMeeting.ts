import { CalendarService } from "../services/calendar.service";
import { InnerToolResponseType, ToolDataType, ToolResponseType } from "../types";

export async function addGuestToMeeting(
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {

    const argEmail = tool.args.find(a => /email|correo/ig.exec(a.name) != null);
    const event = tool.args.find(a => /id|event/ig.exec(a.name) != null);

    let message: string | InnerToolResponseType = "Ok";
    let success = true;
    if (!argEmail || !event) {
        message = "Error scheduling, try later.";
        success = false;
    } else {
        await CalendarService.addGuestToMeeting(assistantId, tool.id, event.val, argEmail.val);
    }

    return {
        name: tool.name,
        message,
        success,
        hidden: true,
    };
}