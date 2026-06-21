-- First, ensure the extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
    id UUID DEFAULT gen_random_uuid(),
    parent TEXT,
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
    embedding_txt TEXT,
    embedding vector(1024),
    metadata JSONB,
    PRIMARY KEY (parent, id)
);

-- Create an HNSW index for fast similarity search
CREATE INDEX ON document_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX document_embeddings_parent ON document_embeddings (parent);

CREATE INDEX document_embeddings_created_at_parent ON document_embeddings (
    parent,
    created_at DESC,
    id DESC
);

create table articles (
    id UUID DEFAULT gen_random_uuid (),
    parent TEXT,
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
    keywords text not null,
    metadata JSONB,
    fts_vector tsvector generated always as (
        to_tsvector ('simple', keywords)
    ) stored,
    PRIMARY KEY (parent, id)
);

create index idx_article_fts on articles using gin (fts_vector);

CREATE INDEX article_created_at_parent ON articles (
    parent,
    created_at DESC,
    id DESC
);

CREATE POLICY "Authenticated users can CRUD on document_embeddings"
ON document_embeddings
FOR ALL
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can CRUD on articles"
ON articles
FOR ALL
TO authenticated
USING (true);