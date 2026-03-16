import { MyStore } from "../services/firestore";
import { SupabaseSrv } from "../services/supabase";
import { InnerToolResponseType, ToolDataType, ToolResponseType } from "../types/types";

export async function searchFact(
    tool: ToolDataType,
    history: any[],
    assistantId: string,
    userQuery: string,
): Promise<ToolResponseType | null> {
    let { keywords, factsMaxMatches, factsMinDistance } = tool;
    const success: boolean = true;
    let message: string | InnerToolResponseType = "";

    const searched: string[] = tool.args.map((arg: any) => arg.val);

    const ideasList = [];

    if (typeof keywords == "string" && keywords.trim().length > 0) {
        ideasList.push(keywords);
    }
    ideasList.push(...searched);

    const completeSearch = ideasList.filter(i => i.trim().length > 0).join(" ");

    if (typeof factsMinDistance == "number" && !isNaN(factsMinDistance)) {
        factsMinDistance = factsMinDistance / 100;
    }

    const matches = await SupabaseSrv.searchEmbeedInternal(assistantId, completeSearch, factsMinDistance, factsMaxMatches);

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
        type: tool.type,
        message,
        success,
    };
}