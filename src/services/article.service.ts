
import { bigquery, TABLE_PATH } from './bigquery';
import { Article, PaginatedResult } from './bigquery_types';

export async function searchArticles(
    searchText: string,
    page = 1,
    pageSize = 10
): Promise<PaginatedResult<Article>> {
    const offset = (page - 1) * pageSize;

    const query = `
    SELECT *
    FROM \`${TABLE_PATH}\`
    WHERE SEARCH((title), @searchText)
    ORDER BY created_at DESC
    LIMIT @pageSize
    OFFSET @offset
  `;

    const options = {
        query,
        location: 'US',
        params: {
            searchText,
            pageSize,
            offset,
        },
    };

    const [rows] = await bigquery.query(options);

    return {
        data: rows as Article[],
        page,
        pageSize,
    };
}

export async function listArticles(
    page = 1,
    pageSize = 10
): Promise<PaginatedResult<Article>> {
    const offset = (page - 1) * pageSize;

    const query = `
    SELECT *
    FROM \`${TABLE_PATH}\`
    ORDER BY created_at DESC
    LIMIT @pageSize
    OFFSET @offset
  `;

    const options = {
        query,
        location: 'US',
        params: {
            pageSize,
            offset,
        },
    };

    const [rows] = await bigquery.query(options);

    return {
        data: rows as Article[],
        page,
        pageSize,
    };
}