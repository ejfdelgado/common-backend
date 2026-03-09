import { MyStore } from "../services/firestore";
import { SupabaseSrv } from "../services/supabase";
import { ToolResponseType } from "../types";
import { replaceArguments } from "./sendEmail";

export async function searchArticle(
    tool: any,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    const { error, keywords } = tool;
    const success: boolean = true;
    let message = "";

    const searched: string[] = tool.args.map((arg: any) => arg.val);

    const completeSearch = keywords + " " + [...searched].join(" ");

    const matches = await SupabaseSrv.searchArticleInternal(assistantId, completeSearch, 1);

    if (matches.length == 0) {
        message = replaceArguments(error, tool.args);
        // No need to wait, maybe...
        MyStore.create(`knowledge/${assistantId}/history`, {
            checked: false,
            type: "not_found",
            searchText: completeSearch,
            userQuery,
            desc: tool.name,
            created: Date.now(),
        });
    } else {
        message = replaceArguments(matches[0].desc, tool.args);
    }

    return {
        name: tool.name,
        message,
        success,
        articles: matches,
    };
}