import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const OUT = path.resolve("public");

const IDS = {
  drugs: process.env.NOTION_DRUGS_DATA_SOURCE_ID,
  topics: process.env.NOTION_TOPICS_DATA_SOURCE_ID,
  troubles: process.env.NOTION_TROUBLES_DATA_SOURCE_ID,
  evidence: process.env.NOTION_EVIDENCE_DATA_SOURCE_ID,
};

for (const [key, value] of Object.entries({ NOTION_API_KEY: process.env.NOTION_API_KEY, ...IDS })) {
  if (!value) throw new Error(`Missing environment variable: ${key}`);
}

const esc = (s="") => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

function prop(page, name) { return page.properties?.[name]; }
function textValue(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map(x=>x.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map(x=>x.plain_text).join("");
  if (p.type === "select") return p.select?.name || "";
  if (p.type === "status") return p.status?.name || "";
  if (p.type === "date") return p.date?.start || "";
  if (p.type === "url") return p.url || "";
  return "";
}
function checkValue(p){ return !!p?.checkbox; }
function multiValue(p){ return (p?.multi_select || []).map(x=>x.name); }
function relationIds(p){ return (p?.relation || []).map(x=>x.id); }

async function queryAll(dataSourceId, filter) {
  const out = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results.filter(x=>x.object === "page"));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

const publishFilter = {
  and: [
    { property: "Web公開", checkbox: { equals: true } },
    { property: "レビュー状態", status: { equals: "完了" } },
    { property: "最終レビュー", date: { is_not_empty: true } },
  ]
};

async function getBlocks(pageId) {
  const all = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId, page_size: 100, start_cursor: cursor
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

function rich(block) {
  const obj = block[block.type];
  return (obj?.rich_text || []).map(x=>x.plain_text).join("");
}
function blocksToSections(blocks) {
  const sections = [];
  let current = null;
  for (const b of blocks) {
    if (["heading_1","heading_2","heading_3"].includes(b.type)) {
      current = { title: rich(b), items: [] };
      sections.push(current);
      continue;
    }
    const txt = rich(b);
    if (!txt) continue;
    if (!current) {
      current = { title: "", items: [] };
      sections.push(current);
    }
    current.items.push({ type: b.type, text: txt });
  }
  return sections;
}

function topicCard(t) {
  const title = textValue(prop(t,"トピック名"));
  const slug = textValue(prop(t,"slug"));
  const cat = textValue(prop(t,"カテゴリ"));
  const summary = textValue(prop(t,"患者向け要約"));
  return `<a class="card" href="/topics/${esc(slug)}/"><span>${esc(cat)}</span><h3>${esc(title)}</h3><p>${esc(summary)}</p></a>`;
}

const css = `
:root{--ink:#17324d;--muted:#66788a;--line:#dfe7ed;--bg:#f7fafb;--accent:#2f7f78;--soft:#e7f3f1}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",Meiryo,sans-serif;background:var(--bg);color:var(--ink);line-height:1.8}
a{color:inherit}.wrap{max-width:980px;margin:auto;padding:0 20px}header{background:#fff;border-bottom:1px solid var(--line)}
.head{min-height:68px;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:800}.pill{font-size:12px;background:var(--soft);color:var(--accent);padding:5px 10px;border-radius:999px}
main{padding:36px 0 70px}.hero,.panel,.card{background:#fff;border:1px solid var(--line);border-radius:20px}.hero{padding:30px;background:linear-gradient(135deg,#fff,#edf7f5)}
.kicker,.card span{color:var(--accent);font-size:12px;font-weight:800}h1{font-size:clamp(32px,5vw,48px);margin:5px 0 8px;line-height:1.25}.lead{font-size:18px;color:#36516a}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:18px}.card{display:block;text-decoration:none;padding:18px}.card h3{margin:4px 0}.card p{color:var(--muted);font-size:14px;margin:0}
.panel{padding:22px;margin-top:24px}.ref{font-size:13px;color:var(--muted)}footer{background:#fff;border-top:1px solid var(--line);padding:24px 0;color:var(--muted);font-size:13px}
@media(max-width:700px){.grid{grid-template-columns:1fr}.hero{padding:22px}}
`;

function shell(title, body) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}｜くすりとくらしの情報 Link</title><style>${css}</style></head>
<body><header><div class="wrap head"><div class="brand">くすりとくらしの情報 Link</div><div class="pill">根拠確認済み情報のみ公開</div></div></header>
<main class="wrap">${body}</main><footer><div class="wrap">医療上の個別判断は、処方医・薬剤師などへ確認する。</div></footer></body></html>`;
}

async function hasRequiredBrandEvidence(drug) {
  const ids = relationIds(prop(drug,"根拠資料"));
  if (!ids.length) return false;
  for (const id of ids) {
    const p = await notion.pages.retrieve({ page_id: id });
    const kind = textValue(prop(p,"資料種別"));
    const name = textValue(prop(p,"資料名"));
    const note = textValue(prop(p,"根拠として使う内容"));
    if (kind === "電子添文" && (name.includes("フォサマック") || name.includes("ボナロン") || note.includes("先発"))) {
      return true;
    }
  }
  return false;
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT,"drugs"), { recursive: true });
  await fs.mkdir(path.join(OUT,"topics"), { recursive: true });

  const drugs = await queryAll(IDS.drugs, publishFilter);
  const topics = await queryAll(IDS.topics, publishFilter);

  const topicMap = new Map(topics.map(t=>[t.id,t]));

  const publishedDrugs = [];
  for (const drug of drugs) {
    if (!(await hasRequiredBrandEvidence(drug))) {
      console.warn(`SKIP: ${textValue(prop(drug,"薬剤名"))} — 先発電子添文が確認できない`);
      continue;
    }
    publishedDrugs.push(drug);
  }

  for (const drug of publishedDrugs) {
    const name = textValue(prop(drug,"薬剤名"));
    const slug = textValue(prop(drug,"slug"));
    const lead = textValue(prop(drug,"患者向け一言"));
    const topicIds = relationIds(prop(drug,"トピック"));
    const related = topicIds.map(id=>topicMap.get(id)).filter(Boolean);

    const body = `<section class="hero"><div class="kicker">${esc(multiValue(prop(drug,"薬効群")).join(" / "))}</div><h1>${esc(name)}</h1><p class="lead">${esc(lead)}</p></section>
      <section class="panel"><h2>何を知りたい？</h2><div class="grid">${related.map(topicCard).join("") || "<p>公開済みトピックはまだない。</p>"}</div></section>
      <section class="panel ref">最終レビュー：${esc(textValue(prop(drug,"最終レビュー")))}</section>`;
    const dir = path.join(OUT,"drugs",slug);
    await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,"index.html"), shell(name,body));
  }

  for (const t of topics) {
    const title = textValue(prop(t,"トピック名"));
    const slug = textValue(prop(t,"slug"));
    const summary = textValue(prop(t,"患者向け要約"));
    const action = textValue(prop(t,"患者向け対応"));
    const professional = textValue(prop(t,"専門職向け要約"));
    const blocks = await getBlocks(t.id);
    const sections = blocksToSections(blocks)
      .filter(s => !["根拠","編集メモ","医療・介護職向け","医療・介護職向け要点"].includes(s.title))
      .map(s=>`<section class="panel">${s.title?`<h2>${esc(s.title)}</h2>`:""}${s.items.map(i=>`<p>${esc(i.text)}</p>`).join("")}</section>`).join("");

    const body = `<section class="hero"><div class="kicker">${esc(textValue(prop(t,"カテゴリ")))}</div><h1>${esc(title)}</h1><p class="lead">${esc(summary)}</p></section>
      ${action?`<section class="panel"><h2>どうすればいい？</h2><p>${esc(action)}</p></section>`:""}
      ${sections}
      ${professional?`<details class="panel"><summary><b>医療・介護職向け要点</b></summary><p>${esc(professional)}</p></details>`:""}
      <section class="panel ref">最終レビュー：${esc(textValue(prop(t,"最終レビュー")))}</section>`;
    const dir = path.join(OUT,"topics",slug);
    await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,"index.html"), shell(title,body));
  }

  const list = publishedDrugs.map(d => {
    const n=textValue(prop(d,"薬剤名")), s=textValue(prop(d,"slug")), l=textValue(prop(d,"患者向け一言"));
    return `<a class="card" href="/drugs/${esc(s)}/"><span>薬から探す</span><h3>${esc(n)}</h3><p>${esc(l)}</p></a>`;
  }).join("");
  await fs.writeFile(path.join(OUT,"index.html"), shell("トップ", `<section class="hero"><div class="kicker">患者さんの「知りたい」から探す</div><h1>くすりとくらしの情報 Link</h1><p class="lead">Notionでレビュー・公開承認された薬情報だけを掲載する。</p></section><section class="panel"><h2>薬から探す</h2><div class="grid">${list || "<p>現在、公開済みの薬はない。</p>"}</div></section>`));

  console.log(`Built ${publishedDrugs.length} drug page(s) and ${topics.length} topic page(s).`);
}
main().catch(err => { console.error(err); process.exit(1); });
