# 学習ノート:売上CSV集計ダッシュボード

このプロジェクトで学んだことの詳細記録です。README の「4. 学んだ事」はこのノートの要約です。

---

## Step 1:雛形作成、README・学習ノート

### やったこと
- `create-next-app` でNext.jsのプロジェクトを作成した(TypeScript、ESLint、Tailwind CSS、App Router、`src/` なし)
- `npm run dev` で、`http://localhost:3000` に初期画面が表示されることを確認した
- プロジェクトのフォルダで `git init` を実行した
- portfolio-template からREADME・学習ノート・LICENSEを作成した

### 学んだこと
- インストールされたバージョンは、Next.js 16.4.6、React 19.3.0、Tailwind CSS 4.3.3だった
- Next.js 16では、全リクエストの前処理を行うファイルの名前が `proxy.ts` になる(15以前は `middleware.ts`)。Step 3のログイン確認で使う
- Gitは、今いるフォルダに `.git` がないと親フォルダをさかのぼって探し、一番近い `.git` を使う

### つまずいた点と解決方法
- **症状**:プロジェクトのフォルダで `git status` を実行すると、`../Documents/` や `../NTUSER.DAT` などホームフォルダのファイルが一覧に出て、「Permission denied」の警告も大量に出た
- **原因**:プロジェクトに `.git` がなく、親の `C:\Users\User` に以前誤って作られた `.git` があった。そのため、ホームフォルダ全体が1つのリポジトリとして扱われていた
- **解決**:プロジェクトのフォルダで `git init` を実行し、専用のリポジトリを作って切り離した。この状態で `git add .` をしていたら、PC内の設定ファイルまでGitに入るところだった。作業前に `git status` で対象のファイルを確認する

---

## Step 2:Supabaseのテーブル・インデックス・RLSの作成

### やったこと
- Supabaseのプロジェクトを作成した(リージョンは東京)
- 作成時のセキュリティ設定は、「Enable Data API」をオン、「Automatically expose new tables」をオフ、「Enable automatic RLS」をオンにした
- SQL Editorで、`uploads`(取り込み1回分)と `sales`(明細)のテーブル、インデックス5つ、RLSのポリシーを作成した
- `@supabase/supabase-js` と `@supabase/ssr` をインストールした
- `.env.local` に接続先のURLとPublishable keyを設定し、`.env.example` に項目名だけを書いた

### 学んだこと
- RLS(行レベルセキュリティ)を有効にすると、ポリシーで許可した操作しかできなくなる。今回は「ログイン済み(`authenticated`)なら読み書きできる」ポリシーだけを付けたので、ログインしていない人(`anon`)はキーを知っていてもデータを扱えない
- 「Automatically expose new tables」をオフにすると、テーブルを操作する権限が自動では付かない。`grant` で、ログイン済みのロールにだけ権限を付けた。権限とRLSの二重で守る形になる
- Publishable keyはブラウザに出てもよいキーで、データはRLSで守る。Secret keyはRLSを無視できるので、ブラウザ側のコードや `.env.local` には入れない
- 古い形式のキー(anon / service_role)は2027年に廃止予定のため、新しい形式のPublishable keyを使った。環境変数名も `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` にした
- `check` 制約で、`status` に決めた3つ(pending / active / replaced)以外の値を入れられないようにできる
- `on delete cascade` を付けると、取り込み履歴(`uploads`)を消したときに、その明細(`sales`)もまとめて消える
- SQL Editorの「Run」で実行した時点で、データベースに反映される。「Save」はSQLの文章を残すだけ
- インストールしたバージョンは、`@supabase/supabase-js` 2.119.0、`@supabase/ssr` 0.12.7だった

### つまずいた点と解決方法
- **症状**:コミット前の確認で、`.env.example` の中身が空(0バイト)になっていた
- **原因**:ファイルを作成したあと、項目名を書いた内容が保存されていなかった
- **解決**:`NEXT_PUBLIC_SUPABASE_URL=` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` の2行を書いて保存し直した。ファイルは作るだけでなく、中身が保存されているかも確認する

---

## Step 3:ログイン、ログアウト

### やったこと
- Supabaseの管理画面で、テスト用のユーザーを作成した(「Auto Confirm User」をオンにして、確認メールなしでログインできるようにした)
- Supabaseにつなぐ部品を、ブラウザ用(`lib/supabase/client.ts`)とサーバー用(`lib/supabase/server.ts`)に分けて作った
- `proxy.ts` で、リクエストのたびにログイン状態を確認し、未ログインなら `/login` へ、ログイン済みで `/login` を開いたら `/` へ移動させるようにした
- ログイン画面(`app/login/page.tsx`)とログアウトボタンを作った。エラーは要件定義書の文言で、原因別に表示する
- 確認用の仮のトップ画面を作り、ログイン中のメールアドレスと、`uploads` を読めたかどうかを表示した

### 学んだこと
- ログインの判定には `getClaims()` を使う。ログイン情報(トークン)の署名を検証してから返すため、偽のCookieを信用しない。`getSession()` はCookieの値を検証せずに返すので、サーバー側の判定に使ってはいけない
- `@supabase/ssr` は、ログイン情報をCookieに保存する。サーバー側でもログイン状態を読めるのはこのため
- `proxy.ts` では、Cookieを更新した `supabaseResponse` をそのまま返す必要がある。別のレスポンスを新しく作るとCookieの更新が失われ、勝手にログアウトされる原因になる
- Server ComponentではCookieを書き換えられないので、`server.ts` の `setAll` は失敗しても無視する。ログイン状態の更新は `proxy.ts` が担当している
- ログイン成功後は `router.replace("/")` で移動し、`router.refresh()` でサーバー側の表示も更新する。`replace` を使うと、ブラウザの「戻る」でログイン画面に戻らない
- ログインしていない人がAPIを直接呼ぶと、`42501`(permission denied)が返る。Step2で権限をログイン済みの人にだけ付けた効果を、curlで確認できた。エラーの `hint` には「anonに権限を付ける」方法が出るが、今回の設計では実行しない

### つまずいた点と解決方法
- **症状**:ログインすると「現在ご利用いただけません」と表示された。詳細は `AuthApiError: Invalid path specified in request URL` だった。続けてcurlで確認すると、`requested path is invalid` が返った
- **原因**:`.env.local` の `NEXT_PUBLIC_SUPABASE_URL` に、後ろに余計なパスが付いたURLを貼っていた。そのため、ログインの通信先が存在しないパスになっていた。curlでも、同じURLをもとにしたため `/rest/v1/` が二重になっていた
- **解決**:URLを `https://xxxxxxxx.supabase.co` の形(`.supabase.co` で終わる)に直し、`npm run dev` を再起動した。環境変数は起動時にだけ読み込まれるので、変更したら再起動が必要

---

## Step 4:突合用の正解データを作るスクリプト

### やったこと
- `scripts/make-expected.mjs` を作った。CSVを直接読み、月×カテゴリ×商品×担当者ごとの合計を計算して、`data/expected/` にJSONで書き出す
- 検証用のCSVを3つ `data/` に置いた。サンプル(1,000行)、10万行版、置き換えテスト用(サンプルの2026年10月分を修正したもの)
- 3つとも正解データを作り、サンプルの合計が2,518,378円になることを確認した
- 置き換えの範囲を「CSV内の一番早い日〜一番遅い日」(案B)のままにすると決めた

### 学んだこと
- 正解データは、アプリのコード(取り込み・集計RPC)とは別に作る。同じロジックを使うと、間違いも一緒にコピーされて突合の意味がなくなる
- 細かい単位(月×カテゴリ×商品×担当者)の合計で持っておけば、どんな絞り込み条件の正解も、あとから足し算で作れる
- 正解データに不正な行が混ざると突合の意味がないので、解釈できない行が1件でもあれば止めるようにした
- BOM付きUTF-8は、ファイルの先頭に3バイト(EF BB BF)が付く。Excelで保存したCSVによくある形式で、受け取ったサンプルもこの形式だった。UTF-8として読めないファイルは Shift_JIS として読む
- 日付は `new Date` に任せず、年・月・日が変わっていないかを確かめる。`2024-13-04` のような存在しない日付を、JavaScriptは翌年の日付に直してしまうため
- 置き換えテスト用のCSVは、範囲の端の行(10月2日・31日)を残して作った。案Bでは、端の日の行を消すと範囲が狭くなり、古いデータが残るため
- GitHubが警告を出すのは50MBを超えるファイル。10万行版(6.2MB)は、ほかの人も同じデータで確かめられるようにコミットした

### つまずいた点と解決方法
- 特になし

---

## 振り返り

- **うまくいったこと**:{}
- **次の案件で活かしたいこと**:{}

---

## 用語集

### コード

| コード | 意味・使い方 |
| --- | --- |
| `npx create-next-app@latest` | Next.jsのプロジェクトを、質問に答えながら作成する |
| `npm run dev` | 開発用のサーバーを起動する。`Ctrl + C` で止める |
| `git init` | 今いるフォルダを、新しいGitのリポジトリにする(`.git` フォルダが作られる) |
| `git status` | 変更されたファイルや、まだGitに登録していないファイルを一覧で表示する |
| `create policy` | RLSのポリシー(誰に、どの操作を許可するか)を作る |
| `grant` | ロールに、テーブルを操作する権限を付ける |
| `on delete cascade` | 親の行を消したとき、それを参照する子の行もまとめて消す |
| `check (...)` | 列に入れられる値の条件を決める制約 |
| `npm install @supabase/supabase-js @supabase/ssr` | Supabaseにつなぐためのパッケージを入れる。`ssr` はログイン情報をCookieで扱うためのもの |
| `createBrowserClient` / `createServerClient` | `@supabase/ssr` の関数。ブラウザ用・サーバー用のSupabaseクライアントを作る |
| `supabase.auth.signInWithPassword` | メールアドレスとパスワードでログインする |
| `supabase.auth.signOut` | ログアウトする |
| `supabase.auth.getClaims` | ログイン情報の署名を検証して、ログイン中のユーザーの情報を返す |
| `proxy`(`proxy.ts`) | 全リクエストの前に実行される関数。ここでログイン状態を確認した |
| `NextResponse.redirect` | 別のページへ移動させるレスポンスを返す |
| `router.replace` / `router.refresh` | 履歴を残さずにページを移動する / サーバー側の表示を取り直す |
| `curl.exe -s ... -H "apikey: ..."` | ブラウザを使わずにAPIを呼ぶ。ヘッダーにキーを付けて、ログインしていない状態を再現した |
| `node scripts/make-expected.mjs <CSV>` | CSVから突合用の正解データ(JSON)を作る |
| `new TextDecoder("utf-8", { fatal: true })` | 文字をUTF-8として読む。`fatal: true` にすると、読めないときにエラーになる(Shift_JISの判定に使った) |
| `normalize("NFKC")` | 全角の数字・英字を半角にそろえる |

### 用語

| 用語 | 意味 |
| --- | --- |
| リポジトリ | Gitがファイルの変更履歴を管理する単位。`.git` フォルダに履歴が保存される |
| KPI | 目標の達成度を測るための重要な指標。今回は売上合計と前年同期比 |
| 前年同期比 | 今期の売上が、1年前の同じ期間に比べてどれだけ増減したかの割合 |
| RLS(Row Level Security) | 行レベルセキュリティ。ポリシーで許可した人・操作だけがデータを扱えるようにする仕組み |
| ポリシー | RLSで「誰に、どの操作を許可するか」を決めたルール |
| ロール | データベースを使う立場。Supabaseでは、ログインしていない人が `anon`、ログイン済みの人が `authenticated` |
| Publishable key | ブラウザに出してもよいSupabaseのキー。データはRLSで守る |
| Secret key | RLSを無視して全データを操作できるキー。サーバー側だけで使い、公開しない |
| インデックス | 検索や集計を速くするための索引。よく絞り込む列に付ける |
| Cookie | ブラウザが保存し、リクエストのたびにサーバーへ送る小さなデータ。ログイン情報の保存に使う |
| トークン | ログインしていることを証明するデータ。署名が付いていて、改ざんを見分けられる |
| リダイレクト | 開こうとしたページから、別のページへ自動で移動させること |
| `42501` | PostgreSQLのエラーコード。権限がない(permission denied)ことを表す |
| 突合 | 2つのデータを照らし合わせて、一致しているかを確かめること。今回はCSVの合計と画面の集計を比べる |
| 正解データ | 突合で「正しい値」として使うデータ。CSVから直接計算して作る |
| BOM | ファイルの先頭に付く、文字コードを示す目印。UTF-8では EF BB BF の3バイト |
| Shift_JIS | 日本語の文字コードの1つ。古いExcelや業務システムが出すCSVで使われることがある |
