-- =============================================================
-- Step 2:テーブル・インデックス・RLS
-- (Step 2 で SQL Editor から実行したものと同じ内容の記録)
-- =============================================================

-- ========== テーブル ==========
create table public.uploads (
  id           uuid primary key default gen_random_uuid(),
  file_name    text not null,
  file_hash    text,
  period_from  date not null,
  period_to    date not null,
  row_count    int not null,
  total_amount bigint not null,
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'replaced')),
  uploaded_by  uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  check (period_from <= period_to)
);

create table public.sales (
  id           bigint generated always as identity primary key,
  upload_id    uuid not null references public.uploads(id) on delete cascade,
  sale_id      text not null,
  sale_date    date not null,
  category     text not null,
  product_name text not null,
  sales_rep    text not null,
  quantity     int not null,
  unit_price   int not null,
  amount       int not null
);

-- ========== インデックス ==========
create index sales_sale_date_idx          on public.sales (sale_date);
create index sales_category_date_idx      on public.sales (category, sale_date);
create index sales_rep_date_idx           on public.sales (sales_rep, sale_date);
create index sales_product_name_idx       on public.sales (product_name);
create index sales_upload_id_idx          on public.sales (upload_id);

-- ========== RLS(ログインした人だけ読み書きできる) ==========
alter table public.uploads enable row level security;
alter table public.sales   enable row level security;

create policy "ログイン済みは読み書き可" on public.uploads
  for all to authenticated using (true) with check (true);

create policy "ログイン済みは読み書き可" on public.sales
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.uploads to authenticated;
grant select, insert, update, delete on public.sales   to authenticated;
