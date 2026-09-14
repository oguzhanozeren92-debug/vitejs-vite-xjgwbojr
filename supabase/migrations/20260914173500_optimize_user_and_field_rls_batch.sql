drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to public using ((select auth.uid()) = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to public with check ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to public using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users can view own onboarding" on public.onboarding_answers;
create policy "Users can view own onboarding" on public.onboarding_answers for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own onboarding" on public.onboarding_answers;
create policy "Users can insert own onboarding" on public.onboarding_answers for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own onboarding" on public.onboarding_answers;
create policy "Users can update own onboarding" on public.onboarding_answers for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own field sections" on public.field_sections;
create policy "Users can view own field sections" on public.field_sections for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own field sections" on public.field_sections;
create policy "Users can insert own field sections" on public.field_sections for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own field sections" on public.field_sections;
create policy "Users can update own field sections" on public.field_sections for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own field sections" on public.field_sections;
create policy "Users can delete own field sections" on public.field_sections for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own perennial yields" on public.perennial_yields;
create policy "Users can view own perennial yields" on public.perennial_yields for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own perennial yields" on public.perennial_yields;
create policy "Users can insert own perennial yields" on public.perennial_yields for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own perennial yields" on public.perennial_yields;
create policy "Users can update own perennial yields" on public.perennial_yields for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own perennial yields" on public.perennial_yields;
create policy "Users can delete own perennial yields" on public.perennial_yields for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
create policy "Users can view own push subscriptions" on public.push_subscriptions for select to public using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions" on public.push_subscriptions for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions" on public.push_subscriptions for update to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions" on public.push_subscriptions for delete to public using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own satellite notification state" on public.field_satellite_notification_state;
create policy "Users can view own satellite notification state" on public.field_satellite_notification_state for select to authenticated using ((select auth.uid()) = user_id);
