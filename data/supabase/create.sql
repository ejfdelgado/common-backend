-- First, ensure the extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
    id TEXT,
    parent TEXT,
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
    embedding vector(1024),
    PRIMARY KEY (parent, id)
);

-- Create an HNSW index for fast similarity search
CREATE INDEX ON document_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_parent ON document_embeddings (parent);