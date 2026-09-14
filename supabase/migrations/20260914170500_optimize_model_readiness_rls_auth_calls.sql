drop policy if exists "Users can view own fields" on public.fields;
create policy "Users can view own fields" on public.fields for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own fields" on public.fields;
create policy "Users can insert own fields" on public.fields for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own fields" on public.fields;
create policy "Users can update own fields" on public.fields for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own fields" on public.fields;
create policy "Users can delete own fields" on public.fields for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own field seasons" on public.field_seasons;
create policy "Users can view own field seasons" on public.field_seasons for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own field seasons" on public.field_seasons;
create policy "Users can insert own field seasons" on public.field_seasons for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own field seasons" on public.field_seasons;
create policy "Users can update own field seasons" on public.field_seasons for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own field seasons" on public.field_seasons;
create policy "Users can delete own field seasons" on public.field_seasons for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own activities" on public.activities;
create policy "Users can view own activities" on public.activities for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own activities" on public.activities;
create policy "Users can insert own activities" on public.activities for insert to public with check (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = activities.field_id and f.user_id = (select auth.uid())));
drop policy if exists "Users can update own activities" on public.activities;
create policy "Users can update own activities" on public.activities for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own activities" on public.activities;
create policy "Users can delete own activities" on public.activities for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own field todos" on public.field_todos;
create policy "Users can view own field todos" on public.field_todos for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own field todos" on public.field_todos;
create policy "Users can insert own field todos" on public.field_todos for insert to public with check (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = field_todos.field_id and f.user_id = (select auth.uid())));
drop policy if exists "Users can update own field todos" on public.field_todos;
create policy "Users can update own field todos" on public.field_todos for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own field todos" on public.field_todos;
create policy "Users can delete own field todos" on public.field_todos for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "soil analyses read own" on public.soil_analyses;
create policy "soil analyses read own" on public.soil_analyses for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "soil analyses insert own" on public.soil_analyses;
create policy "soil analyses insert own" on public.soil_analyses for insert to authenticated with check (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = soil_analyses.field_id and f.user_id = (select auth.uid())));
drop policy if exists "soil analyses update own" on public.soil_analyses;
create policy "soil analyses update own" on public.soil_analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "soil analyses delete own" on public.soil_analyses;
create policy "soil analyses delete own" on public.soil_analyses for delete to authenticated using ((select auth.uid()) = user_id);
