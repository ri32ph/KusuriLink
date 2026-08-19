# v0.9.1

v0.9.0の修正版。

原因：
`public/classes/index.html` を書き込む前に `public/classes/` を作成していなかった。

修正：
- buildFromNotion() の初期化時に `public/classes/` を `recursive:true` で作成
- Preview側にも classes ディレクトリと案内ページを追加
- v0.9.0の薬効群一覧・薬効群別薬剤ページ機能は維持
