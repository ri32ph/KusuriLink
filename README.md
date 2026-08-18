# くすりとくらしの情報 Link v0.5.4

## Notionアイコン対応

Notionページに設定したアイコンをWeb表示へ反映する。

優先順位:
1. Notionページアイコン
2. 未設定の場合はサイト側のフラットSVGアイコン

対応:
- emoji
- external image
- file image
- custom emoji
- 未設定時のSVG fallback

対象:
- 薬剤
- トピック
- 困りごと

「大きい錠剤が飲み込みにくい」など、自動アイコンが合わない項目は
Notion側でページアイコンを設定すれば、次回ビルド時にそのアイコンが優先表示される。

Node.js 22.x固定。Notion公開判定ロジックは維持。
