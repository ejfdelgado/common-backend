import { MyStore } from "../services/firestore";
import { SupabaseSrv } from "../services/supabase";
import { InnerToolResponseType, ToolDataType, ToolResponseType } from "../types";

export async function searchArticle(
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    const { keywords } = tool;
    const success: boolean = true;
    let message: string | InnerToolResponseType = "";

    const searched: string[] = tool.args.map((arg: any) => arg.val);

    const completeSearch = keywords + " " + [...searched].join(" ");

    const matches = await SupabaseSrv.searchArticleInternal(assistantId, completeSearch, 1);

    if (matches.length == 0) {
        message = {
            data: [],
            error: null,
            success: true,
        };
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
        message = message = {
            data: matches,
            error: null,
            success: true,
        };
    }

    return {
        name: tool.name,
        message,
        success,
    };
}