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

CREATE INDEX document_embeddings_created_at_parent ON document_embeddings (parent, created_at DESC, id DESC);