-- =============================================================
-- Step 6:取り込み(置き換え・取り込み履歴)
-- Supabase の SQL Editor で、このファイルの中身をまとめて実行する
-- =============================================================

-- ---------- 1. uploads に列を追加 ----------
-- 案A:置き換えで行が減ったら row_count / total_amount を「残っている分」に更新し、
--      取り込んだときの値は original_* に残す
alter table public.uploads
  add column original_row_count    int    not null,
  add column original_total_amount bigint not null,
  -- 履歴の「取り込んだ人」に表示する。auth.users は直接読めないため、取り込み時に保存する
  add column uploader_email        text   default (auth.jwt() ->> 'email');


-- ---------- 2. 置き換えの事前確認 ----------
-- 指定した期間に、有効なデータが何件・いくらあるかを返す(確認画面で使う)
create or replace function public.preview_replacement(p_from date, p_to date)
returns table (row_count bigint, total_amount bigint)
language sql
stable
set search_path = ''
as $$
  select count(*), coalesce(sum(s.amount), 0)
  from public.sales s
  join public.uploads u on u.id = s.upload_id
  where u.status = 'active'
    and s.sale_date between p_from and p_to;
$$;


-- ---------- 3. 取り込みの確定 ----------
-- 送り終えた pending の取り込みについて、1つのトランザクションで次を行う
--   (1) 送った行が欠けていないか確認する(件数と合計金額)
--   (2) 同じ期間の、有効な旧データを削除する
--   (3) 行が減った取り込みの row_count / total_amount を更新する(0件になったら replaced)
--   (4) 新しい取り込みを active にする
-- どこかで失敗すれば全部取り消される
create or replace function public.commit_upload(p_upload_id uuid)
returns table (replaced_rows bigint, replaced_amount bigint)
language plpgsql
set search_path = ''
as $$
declare
  v_upload  public.uploads%rowtype;
  v_count   bigint;
  v_sum     bigint;
  v_del_cnt bigint := 0;
  v_del_sum bigint := 0;
begin
  -- 同時に2つの取り込みが確定しないよう、順番待ちにする
  perform pg_advisory_xact_lock(hashtext('commit_upload'));

  select * into v_upload
  from public.uploads
  where id = p_upload_id
  for update;

  if not found then
    raise exception 'upload % が見つかりません', p_upload_id;
  end if;
  if v_upload.status <> 'pending' then
    raise exception 'upload % は取り込み中ではありません(状態:%)', p_upload_id, v_upload.status;
  end if;

  -- (1) 送った行が欠けていないか
  select count(*), coalesce(sum(amount), 0) into v_count, v_sum
  from public.sales
  where upload_id = p_upload_id;

  if v_count <> v_upload.original_row_count or v_sum <> v_upload.original_total_amount then
    raise exception '送信した行が一致しません(件数 %/%、金額 %/%)',
      v_count, v_upload.original_row_count, v_sum, v_upload.original_total_amount;
  end if;

  -- (2) 同じ期間の、有効な旧データを削除する
  with deleted as (
    delete from public.sales s
    using public.uploads u
    where s.upload_id = u.id
      and u.status = 'active'
      and s.sale_date between v_upload.period_from and v_upload.period_to
    returning s.upload_id, s.amount
  )
  select count(*), coalesce(sum(amount), 0) into v_del_cnt, v_del_sum
  from deleted;

  -- (3) 行が減った取り込みの件数・金額を、残っている分に更新する
  update public.uploads u
  set row_count    = coalesce(r.cnt, 0),
      total_amount = coalesce(r.total, 0),
      status       = case when coalesce(r.cnt, 0) = 0 then 'replaced' else 'active' end
  from public.uploads target
  left join (
    select upload_id, count(*) as cnt, sum(amount) as total
    from public.sales
    group by upload_id
  ) r on r.upload_id = target.id
  where u.id = target.id
    and u.status = 'active'
    and u.id <> p_upload_id
    and (u.row_count <> coalesce(r.cnt, 0) or u.total_amount <> coalesce(r.total, 0));

  -- (4) 新しい取り込みを有効にする
  update public.uploads set status = 'active' where id = p_upload_id;

  return query select v_del_cnt, v_del_sum;
end;
$$;


-- ---------- 4. 関数を実行する権限 ----------
-- 関数は作った時点で「誰でも実行できる」状態になるので、ログイン済みだけに絞る
revoke execute on function public.preview_replacement(date, date) from public, anon;
revoke execute on function public.commit_upload(uuid)             from public, anon;
grant  execute on function public.preview_replacement(date, date) to authenticated;
grant  execute on function public.commit_upload(uuid)             to authenticated;
