# くすりとくらしの情報 Link v0.5.2

v0.5.1のデザインを維持し、VercelのNode.jsを22.xに固定した版。

## 重要
`package.json`:
```json
"engines": {
  "node": "22.x"
}
```

Vercel公式では22.xは現在利用可能なNode.jsメジャーバージョン。

## 確認済み
このZIP内の `scripts/build.mjs` は以下で構文チェック済み。

```bash
node --check scripts/build.mjs
```

GitHubへはZIPそのものではなく、解凍したフォルダ内の
`package.json` と `scripts/build.mjs` を含む全内容をリポジトリ直下へ上書きする。
