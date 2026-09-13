alter table public.agri_news enable row level security;

drop policy if exists "Admins can read all agri news" on public.agri_news;
create policy "Admins can read all agri news"
on public.agri_news for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert agri news" on public.agri_news;
create policy "Admins can insert agri news"
on public.agri_news for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update agri news" on public.agri_news;
create policy "Admins can update agri news"
on public.agri_news for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete agri news" on public.agri_news;
create policy "Admins can delete agri news"
on public.agri_news for delete to authenticated
using (public.is_admin());
