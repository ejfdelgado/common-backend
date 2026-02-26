
import { bigquery, TABLE_PATH } from './bigquery';
import { Article, CursorPaginatedResult, Cursor } from './bigquery_types';

export async function searchArticles(
    path: string,
    searchText: string,
    pageSize = 10,
    cursor?: Cursor
): Promise<CursorPaginatedResult<Article>> {

    const hasCursor = !!cursor;

    const query = `
    SELECT *
    FROM \`${TABLE_PATH}\`
    WHERE SEARCH((title), @searchText)
    AND path = @path
    ${hasCursor
            ? `
        AND (
              (created_at < @cursorCreatedAt)
           OR (created_at = @cursorCreatedAt AND id < @cursorId)
        )
        `
            : ''
        }
    ORDER BY created_at DESC, id DESC
    LIMIT @pageSize
  `;

    const params: Record<string, any> = {
        searchText,
        pageSize,
        path,
    };

    if (hasCursor) {
        params.cursorCreatedAt = cursor!.created_at;
        params.cursorId = cursor!.id;
    }

    const [rows] = await bigquery.query({
        query,
        location: 'US',
        params,
    });

    const articles = rows as Article[];

    const last = articles[articles.length - 1];

    return {
        data: articles,
        nextCursor: last
            ? {
                created_at: last.created_at,
                id: last.id,
            }
            : null,
    };
}

export async function listArticles(
    path: string,
    pageSize = 10,
    cursor?: Cursor
): Promise<CursorPaginatedResult<Article>> {

    const hasCursor = !!cursor;

    const query = `
    SELECT *
    FROM \`${TABLE_PATH}\`
    WHERE path = @path
    ${hasCursor
            ? `
        AND (
              (created_at < @cursorCreatedAt)
           OR (created_at = @cursorCreatedAt AND id < @cursorId)
        )
        `
            : ''
        }
    ORDER BY created_at DESC, id DESC
    LIMIT @pageSize
  `;

    const params: Record<string, any> = {
        pageSize,
        path
    };

    if (hasCursor) {
        params.cursorCreatedAt = cursor!.created_at;
        params.cursorId = cursor!.id;
    }

    const [rows] = await bigquery.query({
        query,
        location: 'US',
        params,
    });

    const articles = rows as Article[];

    const last = articles[articles.length - 1];

    return {
        data: articles,
        nextCursor: last
            ? {
                created_at: last.created_at,
                id: last.id,
            }
            : null,
    };
}