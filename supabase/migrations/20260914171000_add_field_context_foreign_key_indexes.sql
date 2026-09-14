create index if not exists field_growth_observations_field_id_idx
  on public.field_growth_observations(field_id);
create index if not exists field_lab_analyses_field_id_idx
  on public.field_lab_analyses(field_id);
create index if not exists field_notes_field_id_idx
  on public.field_notes(field_id);
create index if not exists field_observation_points_field_id_idx
  on public.field_observation_points(field_id);
create index if not exists field_observation_photos_field_id_idx
  on public.field_observation_photos(field_id);
create index if not exists field_observation_comparisons_field_id_idx
  on public.field_observation_comparisons(field_id);
create index if not exists field_satellite_notification_state_field_id_idx
  on public.field_satellite_notification_state(field_id);
