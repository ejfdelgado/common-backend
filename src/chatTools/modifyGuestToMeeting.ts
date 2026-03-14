import { CalendarService } from "../services/calendar.service";
import { InnerToolResponseType, ToolDataType, ToolResponseType } from "../types/types";

export async function modifyGuestToMeeting(
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
        if (tool.action == "add") {
            await CalendarService.addGuestToMeeting(assistantId, tool.id, event.val, argEmail.val);
        } else if (tool.action == "remove") {
            await CalendarService.removeGuestToMeeting(assistantId, tool.id, event.val, argEmail.val);
        }
    }

    return {
        name: tool.name,
        type: tool.type,
        message,
        success,
        hidden: true,
    };
}