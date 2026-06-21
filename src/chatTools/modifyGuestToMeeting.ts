import { CalendarService } from "../services/calendar.service";
import { MyStore } from "../services/firestore";
import { InnerToolResponseType, ToolDataType, ToolResponseType, ChatToolContract, AssistantStateType } from "../types/types";

const modifyGuestToMeeting: ChatToolContract = async (
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
    state: AssistantStateType,
    author: string,
): Promise<ToolResponseType | null> => {

    const argEmail = tool.args.find(a => /email|correo/ig.exec(a.name) != null);
    const event = tool.args.find(a => /id|event/ig.exec(a.name) != null);

    let message: string | InnerToolResponseType = {
        error: null,
        data: null,
        success: true,
    };
    if (!argEmail || !event) {
        message.error = "Incomplete information.";
        message.success = false;
    } else {
        if (tool.action == "add") {
            const responseInternal = await CalendarService.addGuestToMeeting(
                assistantId,
                tool.id,
                event.val,
                argEmail.val,
            );
            // Add history
            const eventData = responseInternal.data;
            const { htmlLink, start, end } = eventData;
            message.data = { htmlLink, start, end };
            MyStore.create(`knowledge/${assistantId}/history`, {
                checked: false,
                type: tool.type + "_" + tool.action,//calendar_write_guest_add
                event: message.data,
                guest: argEmail.val,
                desc: tool.name,
                created: Date.now(),
            });
        } else if (tool.action == "remove") {
            await CalendarService.removeGuestToMeeting(assistantId, tool.id, event.val, argEmail.val);
        }
    }

    return {
        name: tool.name,
        type: tool.type,
        message,
        success: message.success,
        hidden: true,
    };
};

export { modifyGuestToMeeting };