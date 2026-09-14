drop policy if exists "Users can view own ai usage" on public.ai_usage;
create policy "Users can view own ai usage" on public.ai_usage for select to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own ai credits" on public.ai_reward_credits;
create policy "Users can view own ai credits" on public.ai_reward_credits for select to public using ((select auth.uid()) = user_id);

drop policy if exists "users read own gamification" on public.user_gamification;
create policy "users read own gamification" on public.user_gamification for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users read own point transactions" on public.gamification_transactions;
create policy "users read own point transactions" on public.gamification_transactions for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own field intelligence" on public.field_ai_analyses;
create policy "Users can view own field intelligence" on public.field_ai_analyses for select to authenticated using (((select auth.uid()) = user_id) and exists (select 1 from public.fields f where f.id = field_ai_analyses.field_id and f.user_id = (select auth.uid())));

drop policy if exists "Authenticated users can create own agri posts" on public.agri_news;
create policy "Authenticated users can create own agri posts" on public.agri_news for insert to authenticated with check ((source_type = 'user'::text) and (author_id = (select auth.uid())) and (is_published = false));

drop policy if exists "Users can delete own pending agri posts" on public.agri_news;
create policy "Users can delete own pending agri posts" on public.agri_news for delete to authenticated using ((source_type = 'user'::text) and (author_id = (select auth.uid())) and (is_published = false));

drop policy if exists "Users can update own pending agri posts" on public.agri_news;
create policy "Users can update own pending agri posts" on public.agri_news for update to authenticated using ((source_type = 'user'::text) and (author_id = (select auth.uid())) and (is_published = false)) with check ((source_type = 'user'::text) and (author_id = (select auth.uid())) and (is_published = false));
