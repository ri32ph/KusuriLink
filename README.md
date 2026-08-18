# くすりとくらしの情報 Link v0.4.1

## 修正内容

v0.4で、Notion上では公開条件を満たしているトピックが
`topics=0`になる事象を修正。

### 変更前
Notion APIのquery時に以下を複合filter:
- Web公開 = true
- レビュー状態 = 完了
- 最終レビュー is_not_empty

### v0.4.1
各DBを一度全件取得し、Node.js側で公開判定する。

公開条件:
- Web公開 = ON
- レビュー状態 = 完了
- 最終レビューあり
- slugあり

薬剤はさらに:
- 根拠資料Relationに
  `資料種別 = 電子添文`
  AND
  `製品区分 = 先発品`
  が1件以上

## Build Logs

各行について判定を表示する。

例:

```text
[PUBLICATION ROW] トピック:飲み忘れ時の対応: Web公開=ON / レビュー状態=完了 / 最終レビュー=2026-08-18 / slug=bisphosphonate-missed-dose / PASS
```

その後、

```text
[PUBLICATION CHECK] 基本公開条件PASS 薬剤=1 / トピック=1 / 困りごと=0
```

のようになる。

## 現在確認済みのNotion状態

「飲み忘れ時の対応」:
- Web公開 = ON
- レビュー状態 = 完了
- 最終レビュー = 2026-08-18
- slug = bisphosphonate-missed-dose
→ 公開条件PASS

「薬を飲み忘れた」:
- Web公開 = ON
- レビュー状態 = 未着手
- 最終レビュー = 空欄
→ 現状は非公開が正しい
