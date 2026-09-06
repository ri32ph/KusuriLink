# v0.10.0

`/professionals/` に、臨床薬学データベースを利用する専門職向けの入口を追加。

- `/professionals/therapeutic-areas/`：治療領域（適応・目的）から探す
- `/professionals/drug-classes/`：薬剤クラス（作用機序別）から探す
- `/professionals/qa/`：既存の専門職向けQ&A

治療領域と薬剤クラスの個別ページも、Notionデータからビルド時に自動生成する。

参照するデータソースは環境変数で差し替え可能。

- `NOTION_THERAPEUTIC_AREAS_DATA_SOURCE_ID`
- `NOTION_CLINICAL_DRUG_CLASSES_DATA_SOURCE_ID`

未設定時は、「専門職向け臨床薬学データ（Web連携用）」のIDを使用する。

治療領域・薬剤クラスは、次の3条件をすべて満たす項目だけを公開する。

- `Web公開` がON
- `レビュー状態` が「完了」
- `最終レビュー` が入力済み

## v0.9.3

`/drugs/` と `/classes/` の上部に、薬の探し方を切り替えるUIを追加。

- 薬剤名から探す
- 薬効群から探す

現在いるページ側をアクセント表示。
薬効群の個別ページにも同じ切替を表示。
