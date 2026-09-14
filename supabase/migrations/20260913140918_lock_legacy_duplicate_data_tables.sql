-- These tables are legacy/duplicate stores. The active canonical stores are:
-- soil_analyses for soil laboratory analysis and field_ai_observations for Pusula map memory.
-- Keep legacy rows readable during transition, but prevent app clients from creating a second truth.

revoke insert, update, delete, truncate on public.field_lab_analyses from anon, authenticated;
revoke insert, update, delete, truncate on public.field_ai_analyses from anon, authenticated;
revoke insert, update, delete, truncate on public.map_ai_analyses from anon, authenticated;

grant select on public.field_lab_analyses to anon, authenticated;
grant select on public.field_ai_analyses to anon, authenticated;
grant select on public.map_ai_analyses to anon, authenticated;
