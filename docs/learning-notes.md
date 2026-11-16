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
