import { MyTuples, SimpleObj } from "ejfdelgado-common-ts";
import { AssistantStateType, InnerToolResponseType, ToolDataType, ToolResponseType } from "../types";
import { marked } from 'marked';
import { randomUUID } from 'crypto';
import { EmailHandler } from "../services/email";
import { MyStore } from "../services/firestore";
import { BucketsSrv } from "../services/bucket";

export function replaceArguments(template: string, args: any[]) {
    let rendered = template;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const pattern = `\\$\\s*\\{\\s*${arg.name}\\s*\\}`;
        rendered = rendered.replace(new RegExp(pattern, "ig"), arg.val);
    }
    return rendered;
}

export function removeAccents(text: string): string {
    return text
        .normalize('NFD')                 // Separates characters from their accents
        .replace(/[\u0300-\u036f]/g, ''); // Removes the accent marks (combining marks)
};

export function normalizeName(name: string) {
    return removeAccents(name.toLowerCase()).replace(/[^a-z]/g, "_");
}

export function gescriptionOrNone(desc?: string) {
    if (typeof desc != "string") {
        return undefined;
    }
    let d = desc.trim();
    if (d.length > 0) {
        return d.trim();
    }
}

export function isPrimitive(value: unknown): boolean {
    return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

export async function sendEmail(
    tool: ToolDataType,
    history: any[],
    state: AssistantStateType,
    author: string,
    assistantId: string,
    template: string = "mails/chat_history_orig.html",
): Promise<ToolResponseType | null> {
    // Simplify last message:
    if (history.length > 0 && history[history.length - 1].parts.length > 0) {
        let lastMessage = history[history.length - 1].parts[0].text;
        if (typeof lastMessage == "string") {
            lastMessage = lastMessage.replace(/^.*\[USER QUESTION\]\n/igs, "");
            history[history.length - 1].parts[0].text = lastMessage;
        }
    }
    let success = true;
    let message: string | InnerToolResponseType = "Email sent";
    try {
        // Iterate history to use MD when needed
        history.forEach((message) => {
            if (message.role == 'model') {
                if (message.parts[0].text) {
                    message.parts[0].text = marked.parse(message.parts[0].text);
                }
            }
        });
        // Tuples break down
        const tuples = MyTuples.getTuples(state);
        const keys = Object.keys(tuples);
        const stateList: any[] = [];
        keys.forEach((k) => {
            const value = SimpleObj.getValue(state, k);
            if (isPrimitive(value)) {
                stateList.push({ key: k, val: JSON.stringify(value) });
            }
        });

        let customTemplate = template;
        if (typeof tool.template == "string" && tool.template.trim().length > 0) {
            customTemplate = tool.template.trim();
        }

        const reportId = randomUUID();
        const ahora = new Date();
        const year = ahora.getFullYear();
        const month = ahora.getMonth() + 1;
        const date = ahora.getDate();
        const hour = ahora.getUTCHours();
        const minutes = ahora.getMinutes();
        const seconds = ahora.getSeconds();

        // TODO incluir el nombre del asistente, no solo el nombre de la herramienta.
        const response = await EmailHandler.sendInternal({
            params: { tool, history, state, stateList },
            subject: `Assistant - ${tool.name} - ${year}/${month}/${date} ${hour}:${minutes}:${seconds}`,
            template: customTemplate,
            to: tool.to,
            gmailUser: tool.gmailUser,
        }, true, undefined, false, false);

        const { contenidoFinal, result } = response;

        const promises: Promise<any>[] = [];
        promises.push(result);

        // Upload to bucket on path author/assistantId
        const path = `alterego/${author}/${assistantId}/reports/${year}/${month}/${reportId}.html`;

        // Insert on history
        promises.push(MyStore.create(`knowledge/${assistantId}/history`, {
            checked: false,
            type: tool.type,//email always
            desc: tool.name,
            created: Date.now(),
            reportId: path,
        }));

        promises.push(BucketsSrv.uploadStringAsText(path, contenidoFinal, "text/html"));

        await Promise.all(promises);
    } catch (err) {
        console.log(err);
        success = false;
        message = "Error sending email";
    }

    return {
        name: tool.name,
        message,
        success,
        hidden: true,
    };
}