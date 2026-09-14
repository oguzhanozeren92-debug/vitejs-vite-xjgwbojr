-- Consolidate permissive policies without changing effective access.

-- agri_news: preserve anonymous published reads, authenticated published reads,
-- admin full access, and user-owned pending post management using one policy per action.
drop policy if exists "Admins can read all agri news" on public.agri_news;
drop policy if exists "Public can read published agri news" on public.agri_news;
create policy "Anonymous can read published agri news"
on public.agri_news for select to anon
using (is_published = true);
create policy "Authenticated can read permitted agri news"
on public.agri_news for select to authenticated
using (is_admin() or is_published = true);

drop policy if exists "Admins can insert agri news" on public.agri_news;
drop policy if exists "Authenticated users can create own agri posts" on public.agri_news;
create policy "Authenticated can insert permitted agri news"
on public.agri_news for insert to authenticated
with check (
  is_admin()
  or (
    source_type = 'user'
    and author_id = (select auth.uid())
    and is_published = false
  )
);

drop policy if exists "Admins can update agri news" on public.agri_news;
drop policy if exists "Users can update own pending agri posts" on public.agri_news;
create policy "Authenticated can update permitted agri news"
on public.agri_news for update to authenticated
using (
  is_admin()
  or (
    source_type = 'user'
    and author_id = (select auth.uid())
    and is_published = false
  )
)
with check (
  is_admin()
  or (
    source_type = 'user'
    and author_id = (select auth.uid())
    and is_published = false
  )
);

drop policy if exists "Admins can delete agri news" on public.agri_news;
drop policy if exists "Users can delete own pending agri posts" on public.agri_news;
create policy "Authenticated can delete permitted agri news"
on public.agri_news for delete to authenticated
using (
  is_admin()
  or (
    source_type = 'user'
    and author_id = (select auth.uid())
    and is_published = false
  )
);

-- CMS tables are already publicly readable. Replace each admin ALL policy with
-- write-only admin policies so SELECT no longer has a redundant permissive policy.
drop policy if exists "Admins manage blocks" on public.app_blocks;
create policy "Admins insert blocks" on public.app_blocks for insert to authenticated with check (is_admin());
create policy "Admins update blocks" on public.app_blocks for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins delete blocks" on public.app_blocks for delete to authenticated using (is_admin());

drop policy if exists "Admins manage media" on public.app_media;
create policy "Admins insert media" on public.app_media for insert to authenticated with check (is_admin());
create policy "Admins update media" on public.app_media for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins delete media" on public.app_media for delete to authenticated using (is_admin());

drop policy if exists "Admins manage menu" on public.app_menu_items;
create policy "Admins insert menu" on public.app_menu_items for insert to authenticated with check (is_admin());
create policy "Admins update menu" on public.app_menu_items for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins delete menu" on public.app_menu_items for delete to authenticated using (is_admin());

drop policy if exists "Admins manage pages" on public.app_pages;
create policy "Admins insert pages" on public.app_pages for insert to authenticated with check (is_admin());
create policy "Admins update pages" on public.app_pages for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins delete pages" on public.app_pages for delete to authenticated using (is_admin());

drop policy if exists "Admins manage theme" on public.app_theme_settings;
create policy "Admins insert theme" on public.app_theme_settings for insert to authenticated with check (is_admin());
create policy "Admins update theme" on public.app_theme_settings for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins delete theme" on public.app_theme_settings for delete to authenticated using (is_admin());
