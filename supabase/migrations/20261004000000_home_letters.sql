-- 가정통신문: 누구나 읽고, 관리자(public.is_admin())만 쓰기
create table if not exists public.home_letters (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '',
  target text not null default '전체',
  attachments jsonb not null default '[]'::jsonb,
  author text,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists home_letters_created_at_idx on public.home_letters (created_at desc);

alter table public.home_letters enable row level security;

grant select on public.home_letters to anon, authenticated;
grant insert, update, delete on public.home_letters to authenticated;

create policy home_letters_select_all on public.home_letters
  for select to anon, authenticated using (true);
create policy home_letters_insert_admin on public.home_letters
  for insert to authenticated with check ((select public.is_admin()));
create policy home_letters_update_admin on public.home_letters
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy home_letters_delete_admin on public.home_letters
  for delete to authenticated using ((select public.is_admin()));

-- 첨부파일 저장소 (공개 읽기, 20MB, 문서·이미지만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-letters', 'home-letters', true, 20971520,
  array[
    'application/pdf',
    'application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp',
    'application/hwp+zip', 'application/vnd.hancom.hwpx', 'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  ]
)
on conflict (id) do nothing;

create policy home_letters_files_insert_admin on storage.objects
  for insert to authenticated with check (bucket_id = 'home-letters' and (select public.is_admin()));
create policy home_letters_files_update_admin on storage.objects
  for update to authenticated using (bucket_id = 'home-letters' and (select public.is_admin()));
create policy home_letters_files_delete_admin on storage.objects
  for delete to authenticated using (bucket_id = 'home-letters' and (select public.is_admin()));
