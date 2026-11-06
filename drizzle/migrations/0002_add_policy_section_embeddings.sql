CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.policy_sections
  ADD COLUMN embedding extensions.vector(3072);

COMMENT ON COLUMN public.policy_sections.embedding IS 'Dense embedding of title + body (google/gemini-embedding-2, 3072 dims) for hybrid retrieval.';