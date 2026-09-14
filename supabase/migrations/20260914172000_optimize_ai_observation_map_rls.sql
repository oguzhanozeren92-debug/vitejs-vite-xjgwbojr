drop policy if exists "Users can view own field AI observations" on public.field_ai_observations;
drop policy if exists "Users can read own field AI observations" on public.field_ai_observations;
create policy "Users can read own field AI observations" on public.field_ai_observations for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own field AI observations" on public.field_ai_observations;
create policy "Users can insert own field AI observations" on public.field_ai_observations for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own field AI observations" on public.field_ai_observations;
create policy "Users can update own field AI observations" on public.field_ai_observations for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own field AI observations" on public.field_ai_observations;
create policy "Users can delete own field AI observations" on public.field_ai_observations for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own map AI analyses" on public.map_ai_analyses;
create policy "Users can view own map AI analyses" on public.map_ai_analyses for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own map AI analyses" on public.map_ai_analyses;
create policy "Users can insert own map AI analyses" on public.map_ai_analyses for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own map AI analyses" on public.map_ai_analyses;
create policy "Users can update own map AI analyses" on public.map_ai_analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own map AI analyses" on public.map_ai_analyses;
create policy "Users can delete own map AI analyses" on public.map_ai_analyses for delete to authenticated using ((select auth.uid()) = user_id);
