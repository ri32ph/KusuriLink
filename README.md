# くすりとくらしの情報 Link — Vercel/Notion連携 v0.1

Notionを正本にし、Vercelのビルド時に公開条件を満たす情報だけ取得して静的HTMLを生成する。Notion API未設定時は自動的にプレビューモードでサンプル画面を生成する。

## 1. Notion側
Notion Integrationを作成し、以下4DBをそのIntegrationに共有する。

- 薬剤マスター
- トピック
- 困りごと
- 根拠資料

薬剤ページはさらに「先発医薬品の電子添文」が根拠資料Relationに存在する場合だけ公開対象にする。

## 2. Vercelの環境変数
`.env.example` と同じキーを Project Settings > Environment Variables に登録する。

- `NOTION_API_KEY`
- `NOTION_DRUGS_DATA_SOURCE_ID`
- `NOTION_TOPICS_DATA_SOURCE_ID`
- `NOTION_TROUBLES_DATA_SOURCE_ID`
- `NOTION_EVIDENCE_DATA_SOURCE_ID`

`NOTION_API_KEY` に `NEXT_PUBLIC_` などの公開用prefixは付けない。

## 3. Notionの公開条件
薬剤・トピック・困りごとで共通:

- `レビュー状態` = `完了`
- `Web公開` = ON
- `最終レビュー` = 入力済み

注意: 現在のアレンドロン酸は「進行中」「Web公開OFF」のため、このままビルドすると公開されない。これは意図した安全設計。

## 4. ローカル確認
```bash
npm install
cp .env.example .env.local
# .env.local に実トークンを入れる
set -a; source .env.local; set +a
npm run build
```

生成物は `public/`。

## 5. Vercel
GitHubにこのフォルダをpushし、VercelでImportする。
Vercelは `vercel.json` の設定に従い `npm run build` → `public/` を配信する。

## 6. 更新
Notionでレビュー → `レビュー状態=完了` → `Web公開=ON` → Vercelを再デプロイ。
v0.2でNotion Webhook + Vercel Deploy Hookを追加すれば自動反映できる。

## 設計上の注意
- NotionトークンをHTML/JavaScriptへ埋め込まない。
- 患者閲覧時にNotion APIを呼ばない。
- 先発電子添文の根拠チェックに通らない薬剤ページはビルド対象から除外する。
- トピック詳細本文はNotion本文から読み取るが、患者向け主要文はDBプロパティ（患者向け要約/対応）を優先する。


## プレビューモード
Notion API関連の環境変数が1つでも未設定なら、ビルドは失敗せず自動的にプレビューモードになる。

- トップ
- アレンドロン酸
- 飲み忘れ

のサンプル画面を生成する。

API設定がすべて揃うと、コード変更なしでNotion連携モードへ切り替わる。
