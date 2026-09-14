create index if not exists soil_analyses_field_id_idx
  on public.soil_analyses(field_id);

create index if not exists field_todos_field_id_idx
  on public.field_todos(field_id);

create index if not exists activities_model_readiness_idx
  on public.activities(field_id, user_id, activity_type, activity_date desc);
