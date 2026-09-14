-- Keep only one copy of the identical field AI observation history index.
-- idx_field_ai_observations_field has the same definition and remains authoritative.
drop index if exists public.idx_field_ai_observations_history;
