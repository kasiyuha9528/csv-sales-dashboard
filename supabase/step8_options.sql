-- =============================================================
-- Step 8:ダッシュボードの初期表示用
-- Supabase の SQL Editor で、このファイルの中身をまとめて実行する
-- =============================================================

-- 有効なデータの「最初の月・最後の月・カテゴリ一覧・担当者一覧」を返す
-- (初期表示の期間と、絞り込みの選択肢に使う)
create or replace function public.get_filter_options()
returns table (
  min_month  date,
  max_month  date,
  categories text[],
  reps       text[]
)
language sql
stable
set search_path = ''
as $$
  select
    date_trunc('month', min(s.sale_date))::date,
    date_trunc('month', max(s.sale_date))::date,
    coalesce(array_agg(distinct s.category  order by s.category)  filter (where s.category  is not null), '{}'),
    coalesce(array_agg(distinct s.sales_rep order by s.sales_rep) filter (where s.sales_rep is not null), '{}')
  from public.sales s
  join public.uploads u on u.id = s.upload_id
  where u.status = 'active';
$$;

revoke execute on function public.get_filter_options() from public, anon;
grant  execute on function public.get_filter_options() to authenticated;
