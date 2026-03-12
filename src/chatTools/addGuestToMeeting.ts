import { CalendarService } from "../services/calendar.service";
import { InnerToolResponseType, ToolDataType, ToolResponseType } from "../types";

export async function addGuestToMeeting(
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    const { error, ok } = tool;

    const argEmail = tool.args.find(a => /email|correo/ig.exec(a.name) != null);
    const argId = tool.args.find(a => /id|evento/ig.exec(a.name) != null);

    let message: string | InnerToolResponseType = ok ? ok : "Ok";
    let success = true;
    if (!argEmail || !argId) {
        message = error ? error : "Error scheduling, try later.";
        success = false;
    } else {
        await CalendarService.addGuestToMeeting(assistantId, tool.id, argId.val, argEmail.val);
    }

    return {
        name: tool.name,
        message,
        success,
        hidden: true,
    };
}