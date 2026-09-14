drop policy if exists "Users can view own calendar reminders" on public.calendar_reminders;
create policy "Users can view own calendar reminders" on public.calendar_reminders for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own calendar reminders" on public.calendar_reminders;
create policy "Users can insert own calendar reminders" on public.calendar_reminders for insert to public with check (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = calendar_reminders.field_id and f.user_id = (select auth.uid())));
drop policy if exists "Users can update own calendar reminders" on public.calendar_reminders;
create policy "Users can update own calendar reminders" on public.calendar_reminders for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own calendar reminders" on public.calendar_reminders;
create policy "Users can delete own calendar reminders" on public.calendar_reminders for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own field notes" on public.field_notes;
create policy "Users can view own field notes" on public.field_notes for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own field notes" on public.field_notes;
create policy "Users can insert own field notes" on public.field_notes for insert to public with check (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = field_notes.field_id and f.user_id = (select auth.uid())));
drop policy if exists "Users can update own field notes" on public.field_notes;
create policy "Users can update own field notes" on public.field_notes for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own field notes" on public.field_notes;
create policy "Users can delete own field notes" on public.field_notes for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own field lab analyses" on public.field_lab_analyses;
create policy "Users can view own field lab analyses" on public.field_lab_analyses for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own field lab analyses" on public.field_lab_analyses;
create policy "Users can insert own field lab analyses" on public.field_lab_analyses for insert to public with check (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = field_lab_analyses.field_id and f.user_id = (select auth.uid())));
drop policy if exists "Users can update own field lab analyses" on public.field_lab_analyses;
create policy "Users can update own field lab analyses" on public.field_lab_analyses for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own field lab analyses" on public.field_lab_analyses;
create policy "Users can delete own field lab analyses" on public.field_lab_analyses for delete to public using ((select auth.uid()) = user_id);

drop policy if exists field_observation_points_select_own on public.field_observation_points;
create policy field_observation_points_select_own on public.field_observation_points for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists field_observation_points_insert_own on public.field_observation_points;
create policy field_observation_points_insert_own on public.field_observation_points for insert to authenticated with check ((user_id = (select auth.uid())) and exists (select 1 from public.fields f where f.id = field_observation_points.field_id and f.user_id = (select auth.uid())));
drop policy if exists field_observation_points_update_own on public.field_observation_points;
create policy field_observation_points_update_own on public.field_observation_points for update to authenticated using (user_id = (select auth.uid())) with check ((user_id = (select auth.uid())) and exists (select 1 from public.fields f where f.id = field_observation_points.field_id and f.user_id = (select auth.uid())));
drop policy if exists field_observation_points_delete_own on public.field_observation_points;
create policy field_observation_points_delete_own on public.field_observation_points for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists field_observation_photos_select_own on public.field_observation_photos;
create policy field_observation_photos_select_own on public.field_observation_photos for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists field_observation_photos_insert_own on public.field_observation_photos;
create policy field_observation_photos_insert_own on public.field_observation_photos for insert to authenticated with check ((user_id = (select auth.uid())) and exists (select 1 from public.field_observation_points p where p.id = field_observation_photos.point_id and p.user_id = (select auth.uid()) and p.field_id = p.field_id));
drop policy if exists field_observation_photos_update_own on public.field_observation_photos;
create policy field_observation_photos_update_own on public.field_observation_photos for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists field_observation_photos_delete_own on public.field_observation_photos;
create policy field_observation_photos_delete_own on public.field_observation_photos for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists field_observation_comparisons_select_own on public.field_observation_comparisons;
create policy field_observation_comparisons_select_own on public.field_observation_comparisons for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists field_observation_comparisons_insert_own on public.field_observation_comparisons;
create policy field_observation_comparisons_insert_own on public.field_observation_comparisons for insert to authenticated with check ((user_id = (select auth.uid())) and exists (select 1 from public.field_observation_points p where p.id = field_observation_comparisons.point_id and p.user_id = (select auth.uid()) and p.field_id = p.field_id));
drop policy if exists field_observation_comparisons_update_own on public.field_observation_comparisons;
create policy field_observation_comparisons_update_own on public.field_observation_comparisons for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists field_observation_comparisons_delete_own on public.field_observation_comparisons;
create policy field_observation_comparisons_delete_own on public.field_observation_comparisons for delete to authenticated using (user_id = (select auth.uid()));
