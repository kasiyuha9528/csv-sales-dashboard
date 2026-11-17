-- =============================================================
-- Step 7:集計RPC
-- Supabase の SQL Editor で、このファイルの中身をまとめて実行する
--
-- 共通の引数
--   p_from_month  開始月(その月の1日。例 2025-11-01)
--   p_to_month    終了月(その月の1日。例 2026-10-01)
--   p_categories  カテゴリの配列。null または空なら「すべて」
--   p_reps        担当者の配列。null または空なら「すべて」
-- 当期 = 開始月の1日 〜 終了月の末日
-- 前年同期 = 当期をちょうど1年前にずらした期間
-- 集計するのは status = 'active' の取り込みの行だけ
-- 前年比 = (当期 − 前年同期) ÷ 前年同期 × 100 を小数第1位で四捨五入。前年同期が0なら null
-- =============================================================


-- ---------- 共通:条件に合う行を「当期/前年同期」の印つきで返す ----------
create or replace function public.filtered_sales(
  p_from_month date,
  p_to_month   date,
  p_categories text[] default null,
  p_reps       text[] default null
)
returns table (
  period       text,  -- 'current' または 'previous'
  month        date,  -- 当期の月(前年同期の行も、1年後の月に読み替える)
  category     text,
  product_name text,
  amount       bigint
)
language sql
stable
set search_path = ''
as $$
  with range as (
    select
      date_trunc('month', p_from_month)::date                                as cur_from,
      (date_trunc('month', p_to_month) + interval '1 month')::date          as cur_to,   -- この日を含まない
      (date_trunc('month', p_from_month) - interval '1 year')::date         as prev_from,
      (date_trunc('month', p_to_month) + interval '1 month' - interval '1 year')::date as prev_to
  )
  select
    case when s.sale_date >= r.cur_from then 'current' else 'previous' end,
    case when s.sale_date >= r.cur_from
         then date_trunc('month', s.sale_date)::date
         else (date_trunc('month', s.sale_date) + interval '1 year')::date end,
    s.category,
    s.product_name,
    s.amount::bigint
  from public.sales s
  join public.uploads u on u.id = s.upload_id
  cross join range r
  where u.status = 'active'
    and (
      (s.sale_date >= r.cur_from  and s.sale_date < r.cur_to)
      or
      (s.sale_date >= r.prev_from and s.sale_date < r.prev_to)
    )
    and (p_categories is null or cardinality(p_categories) = 0 or s.category  = any (p_categories))
    and (p_reps       is null or cardinality(p_reps)       = 0 or s.sales_rep = any (p_reps));
$$;


-- ---------- 前年比の計算(共通) ----------
create or replace function public.yoy_pct(p_current bigint, p_previous bigint)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_previous, 0) = 0 then null
    else round((p_current - p_previous)::numeric * 100 / p_previous, 1)
  end;
$$;


-- ---------- KPI:売上合計・前年同期・前年比 ----------
create or replace function public.get_kpi_summary(
  p_from_month date,
  p_to_month   date,
  p_categories text[] default null,
  p_reps       text[] default null
)
returns table (current_amount bigint, previous_amount bigint, yoy_pct numeric)
language sql
stable
set search_path = ''
as $$
  with t as (
    select
      coalesce(sum(amount) filter (where period = 'current'),  0)::bigint as cur,
      coalesce(sum(amount) filter (where period = 'previous'), 0)::bigint as prev
    from public.filtered_sales(p_from_month, p_to_month, p_categories, p_reps)
  )
  select cur, prev, public.yoy_pct(cur, prev) from t;
$$;


-- ---------- 月次推移:月ごとの当年と前年同月 ----------
-- 売上のない月も 0 として返す(グラフの横軸が欠けないように)
create or replace function public.get_monthly_sales(
  p_from_month date,
  p_to_month   date,
  p_categories text[] default null,
  p_reps       text[] default null
)
returns table (month date, current_amount bigint, previous_amount bigint)
language sql
stable
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', p_from_month),
      date_trunc('month', p_to_month),
      interval '1 month'
    )::date as month
  ),
  agg as (
    select
      f.month,
      sum(f.amount) filter (where f.period = 'current')  as cur,
      sum(f.amount) filter (where f.period = 'previous') as prev
    from public.filtered_sales(p_from_month, p_to_month, p_categories, p_reps) f
    group by f.month
  )
  select m.month, coalesce(a.cur, 0)::bigint, coalesce(a.prev, 0)::bigint
  from months m
  left join agg a on a.month = m.month
  order by m.month;
$$;


-- ---------- 商品別:当期・前年同期・前年比 ----------
-- 当期・前年同期のどちらにも売上がない商品は返さない
create or replace function public.get_product_sales(
  p_from_month date,
  p_to_month   date,
  p_categories text[] default null,
  p_reps       text[] default null
)
returns table (
  product_name    text,
  category        text,
  current_amount  bigint,
  previous_amount bigint,
  yoy_pct         numeric
)
language sql
stable
set search_path = ''
as $$
  with agg as (
    select
      f.product_name,
      f.category,
      coalesce(sum(f.amount) filter (where f.period = 'current'),  0)::bigint as cur,
      coalesce(sum(f.amount) filter (where f.period = 'previous'), 0)::bigint as prev
    from public.filtered_sales(p_from_month, p_to_month, p_categories, p_reps) f
    group by f.product_name, f.category
  )
  select product_name, category, cur, prev, public.yoy_pct(cur, prev)
  from agg
  order by cur desc, prev desc, product_name;
$$;


-- ---------- 関数を実行する権限 ----------
revoke execute on function public.filtered_sales(date, date, text[], text[])    from public, anon;
revoke execute on function public.yoy_pct(bigint, bigint)                        from public, anon;
revoke execute on function public.get_kpi_summary(date, date, text[], text[])   from public, anon;
revoke execute on function public.get_monthly_sales(date, date, text[], text[]) from public, anon;
revoke execute on function public.get_product_sales(date, date, text[], text[]) from public, anon;

grant execute on function public.filtered_sales(date, date, text[], text[])    to authenticated;
grant execute on function public.yoy_pct(bigint, bigint)                        to authenticated;
grant execute on function public.get_kpi_summary(date, date, text[], text[])   to authenticated;
grant execute on function public.get_monthly_sales(date, date, text[], text[]) to authenticated;
grant execute on function public.get_product_sales(date, date, text[], text[]) to authenticated;
