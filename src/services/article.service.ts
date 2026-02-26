
import { bigquery, DATASET } from './bigquery';
import { Article, CursorPaginatedResult, Cursor, ArticleCreate } from './bigquery_types';

export const TABLE = 'articles';
export const TABLE_PATH = `${process.env.GCP_PROJECT_ID}.${DATASET}.${TABLE}`;

export async function createArticle(article: ArticleCreate) {
    const row = {
        id: article.id,
        title: article.title,
        path: article.path,
        created_at: new Date(),
    };

    await bigquery
        .dataset(DATASET)
        .table(TABLE)
        .insert(row);

    return row;
}

export async function updateArticle(article: ArticleCreate) {
    const query = `
    UPDATE \`${process.env.GCP_PROJECT_ID}.${DATASET}.${TABLE}\`
    SET
      title = IFNULL(@title, title),
      path = IFNULL(@path, path)
    WHERE id = @id
  `;

    const options = {
        query,
        location: 'US',
        params: {
            id: article.id,
            title: article.title,
            path: article.path,
        },
    };

    await bigquery.query(options);
}

export async function deleteArticle(id: string) {
    const query = `
    DELETE FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.${TABLE}\`
    WHERE id = @id
  `;

    const options = {
        query,
        location: 'US',
        params: { id },
    };

    await bigquery.query(options);

    return { deleted: true };
}

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