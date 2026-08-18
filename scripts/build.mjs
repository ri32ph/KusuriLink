import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public");

const IDS = {
  drugs: process.env.NOTION_DRUGS_DATA_SOURCE_ID,
  topics: process.env.NOTION_TOPICS_DATA_SOURCE_ID,
  troubles: process.env.NOTION_TROUBLES_DATA_SOURCE_ID,
  evidence: process.env.NOTION_EVIDENCE_DATA_SOURCE_ID,
};

const REQUIRED_ENV = {
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DRUGS_DATA_SOURCE_ID: IDS.drugs,
  NOTION_TOPICS_DATA_SOURCE_ID: IDS.topics,
  NOTION_TROUBLES_DATA_SOURCE_ID: IDS.troubles,
  NOTION_EVIDENCE_DATA_SOURCE_ID: IDS.evidence,
};

const MISSING_ENV = Object.entries(REQUIRED_ENV)
  .filter(([,v]) => !v)
  .map(([k]) => k);

const PREVIEW_MODE = MISSING_ENV.length > 0;

const esc = (s="") => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

const css = `
:root{
  --ink:#17324d;--muted:#66788a;--line:#dfe7ed;--bg:#f7fafb;
  --accent:#2f7f78;--accent-soft:#e7f3f1;--warm:#fff7e8;--card:#fff;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",Meiryo,sans-serif;background:var(--bg);color:var(--ink);line-height:1.8}
a{color:inherit}
.wrap{max-width:1040px;margin:auto;padding:0 20px}
header{background:#fff;border-bottom:1px solid var(--line)}
.head{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-weight:800;letter-spacing:.01em}
.brand small{display:block;font-size:11px;font-weight:500;color:var(--muted)}
.trust{font-size:12px;background:var(--accent-soft);color:var(--accent);padding:6px 11px;border-radius:999px;white-space:nowrap}
main{padding:34px 0 72px}
.hero,.panel,.card,.entry,.searchbox{background:#fff;border:1px solid var(--line);border-radius:22px}
.hero{padding:34px;background:linear-gradient(135deg,#fff,#eef8f6)}
.kicker,.card span,.eyebrow{color:var(--accent);font-size:12px;font-weight:800}
h1{font-size:clamp(34px,5.5vw,54px);margin:6px 0 12px;line-height:1.22;letter-spacing:-.015em}
.lead{font-size:18px;color:#36516a;max-width:760px;margin:0}
.sublead{margin-top:12px;color:var(--muted);font-size:15px}
.entry-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px}
.entry{display:block;text-decoration:none;padding:22px;min-height:146px;transition:.15s}
.entry:hover{transform:translateY(-2px);border-color:#a9c9c4;box-shadow:0 8px 24px rgba(32,72,90,.06)}
.entry .icon{font-size:28px;display:block;margin-bottom:8px}
.entry h3{font-size:20px;line-height:1.45;margin:0 0 5px}
.entry p{font-size:14px;color:var(--muted);margin:0}
.section{margin-top:38px}
.section-title{font-size:27px;margin:0 0 7px}
.section-intro{color:var(--muted);margin:0 0 14px}
.panel{padding:24px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
.card{display:block;text-decoration:none;padding:19px;transition:.15s}
.card:hover{border-color:#a9c9c4}
.card h3{margin:4px 0 3px;font-size:19px}
.card p{color:var(--muted);font-size:14px;margin:0}
.searchbox{padding:16px}
.search{width:100%;padding:14px 16px;border:1px solid #cfdae2;border-radius:13px;background:#fff;font-size:16px;color:var(--ink)}
.chips{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
.chip{display:inline-block;text-decoration:none;background:#fff;border:1px solid var(--line);padding:8px 12px;border-radius:999px;font-size:14px}
.chip:hover{border-color:#9dc5bf}
.info-row{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}
.soft{background:var(--accent-soft);border-color:#cfe7e3}
.warm{background:var(--warm);border-color:#f0dfbd}
.quick-list{margin:8px 0 0;padding-left:20px}
.quick-list li{margin:5px 0}
.meta-links{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}
.meta-links a{color:var(--accent);text-decoration:none}
.ref{font-size:13px;color:var(--muted)}
footer{background:#fff;border-top:1px solid var(--line);padding:26px 0;color:var(--muted);font-size:13px}
@media(max-width:760px){
  .head{align-items:flex-start;padding:13px 0}.trust{font-size:11px}
  .entry-grid,.grid,.info-row{grid-template-columns:1fr}
  .hero{padding:25px}.entry{min-height:auto}
  h1{font-size:36px}
}
`;

function shell(title, body) {
  return `<!doctype html><html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}｜くすりとくらしの情報 Link</title><style>${css}</style></head>
<body>
<header><div class="wrap head">
  <div class="brand">くすりとくらしの情報 Link<small>患者さんの「知りたい」から探す薬情報</small></div>
  <div class="trust">根拠を確認した情報のみ掲載</div>
</div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap">
  <div class="meta-links">
    <a href="/about/">このサイトの情報について</a>
    <a href="/evidence/">根拠資料について</a>
    <a href="/professionals/">医療・介護職の方へ</a>
  </div>
  <p>医療上の個別判断は、処方医・薬剤師などへ確認する。</p>
</div></footer>
</body></html>`;
}

async function buildPreview() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT,"drugs","alendronate"), { recursive: true });
  await fs.mkdir(path.join(OUT,"topics","bisphosphonate-missed-dose"), { recursive: true });
  await fs.mkdir(path.join(OUT,"about"), { recursive: true });
  await fs.mkdir(path.join(OUT,"evidence"), { recursive: true });
  await fs.mkdir(path.join(OUT,"professionals"), { recursive: true });

  await fs.writeFile(path.join(OUT,"index.html"), shell("トップ", `
    <section class="hero">
      <div class="kicker">くすりの情報を、今知りたいことから</div>
      <h1>薬について、<br>知りたいことから探せます。</h1>
      <p class="lead">「薬の名前は分かる」「飲み忘れた」「副作用が心配」など、今の状況に合わせて情報を探せる。</p>
      <p class="sublead">まずは、いちばん近い入口を選ぶ。</p>
    </section>

    <section class="entry-grid" aria-label="情報の探し方">
      <a class="entry" href="#drugs"><span class="icon">💊</span><h3>薬から探す</h3><p>薬の名前が分かっているとき</p></a>
      <a class="entry" href="#troubles"><span class="icon">🙋</span><h3>困りごとから探す</h3><p>飲み忘れ・副作用・歯科受診など</p></a>
      <a class="entry" href="#quick"><span class="icon">✓</span><h3>まず知っておきたい</h3><p>飲み方や大切な注意点を確認する</p></a>
    </section>

    <section id="drugs" class="section">
      <h2 class="section-title">薬から探す</h2>
      <p class="section-intro">薬の名前で探す。</p>
      <div class="searchbox"><input class="search" type="search" placeholder="薬の名前を入力（例：アレンドロン酸）"></div>
      <div class="grid">
        <a class="card" href="/drugs/alendronate/">
          <span>骨粗しょう症の薬</span>
          <h3>アレンドロン酸</h3>
          <p>骨を壊す働きを抑え、骨折を防ぐために使われる薬。</p>
        </a>
      </div>
    </section>

    <section id="troubles" class="section">
      <h2 class="section-title">よくある困りごと</h2>
      <p class="section-intro">医学用語ではなく、今困っていることから探す。</p>
      <div class="chips">
        <a class="chip" href="/topics/bisphosphonate-missed-dose/">飲み忘れた</a>
        <a class="chip" href="/drugs/alendronate/#heartburn">胸やけがする</a>
        <a class="chip" href="/drugs/alendronate/#dental">歯医者に行く</a>
        <a class="chip" href="/drugs/alendronate/#duration">いつまで飲む？</a>
        <a class="chip" href="/drugs/alendronate/#thigh">太もも・足の付け根が痛い</a>
      </div>
    </section>

    <section id="quick" class="section info-row">
      <div class="panel soft">
        <div class="eyebrow">まず知っておきたい</div>
        <h2>アレンドロン酸の飲み方</h2>
        <ul class="quick-list">
          <li>朝、起きたときに飲む</li>
          <li>水 約180mLで飲む</li>
          <li>少なくとも30分は横にならない</li>
          <li>30分は食事・水以外の飲み物・ほかの薬を避ける</li>
        </ul>
      </div>
      <div class="panel warm">
        <div class="eyebrow">迷ったとき</div>
        <h2>自己判断で調整しない</h2>
        <p>飲み忘れや副作用が心配なときは、追加服用や休薬を自己判断せず、薬ごとの対応を確認する。</p>
      </div>
    </section>
  `));

  await fs.writeFile(path.join(OUT,"drugs","alendronate","index.html"), shell("アレンドロン酸", `
    <section class="hero">
      <div class="kicker">骨粗しょう症の薬</div>
      <h1>アレンドロン酸</h1>
      <p class="lead">骨を壊す働きを抑えて、骨を折れにくくするために使う薬だ。</p>
    </section>

    <section class="section info-row">
      <div class="panel soft">
        <div class="eyebrow">まず知っておきたい</div>
        <h2>飲み方の基本</h2>
        <ul class="quick-list">
          <li>朝起きたときに飲む</li>
          <li>水 約180mLで飲む</li>
          <li>30分は横にならない</li>
          <li>30分は飲食・ほかの薬を避ける</li>
        </ul>
      </div>
      <div class="panel">
        <div class="eyebrow">この薬は何のため？</div>
        <h2>骨折を防ぐため</h2>
        <p>骨が壊れすぎるのを抑え、骨折しにくい状態を目指す。</p>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">困りごとから探す</h2>
      <div class="grid">
        <a class="card" href="/topics/bisphosphonate-missed-dose/"><span>飲み忘れ</span><h3>薬を飲み忘れた</h3><p>週1回35mgを飲み忘れた場合の対応。</p></a>
        <div class="card" id="heartburn"><span>副作用</span><h3>胸やけ・飲み込みにくさ</h3><p>飲み込みづらさ、痛み、新しい・悪化する胸やけは相談の目安になる。</p></div>
        <div class="card" id="dental"><span>歯科</span><h3>歯医者に行くことになった</h3><p>歯科受診は避けなくてよい。薬を使っていることを伝え、自己判断で休薬しない。</p></div>
        <div class="card" id="thigh"><span>副作用</span><h3>太もも・足の付け根が痛い</h3><p>いつもと違う痛みが続く場合は相談する。</p></div>
        <div class="card" id="duration"><span>治療期間</span><h3>いつまで飲むの？</h3><p>「○年で必ず終了」ではなく、骨折リスクを見直して継続や休薬を判断する。</p></div>
      </div>
    </section>
  `));

  await fs.writeFile(path.join(OUT,"topics","bisphosphonate-missed-dose","index.html"), shell("アレンドロン酸を飲み忘れたら", `
    <section class="hero">
      <div class="kicker">週1回35mgを使っている方へ</div>
      <h1>アレンドロン酸を<br>飲み忘れたら？</h1>
      <p class="lead">まず結論を確認して、そのあと必要な理由や注意点を読む。</p>
    </section>
    <section class="section panel soft">
      <div class="eyebrow">まず結論</div>
      <h2>飲み忘れた日は飲まず、翌朝に1錠。</h2>
      <p><b>その後はいつもの曜日に戻す。2回分を一度に飲まない。</b></p>
    </section>
    <section class="section panel">
      <h2>どうすればいい？</h2>
      <ol class="quick-list">
        <li>飲み忘れた日は追加で飲まない</li>
        <li>翌朝、起きたときに1錠飲む</li>
        <li>水 約180mLで飲み、30分は横にならない</li>
        <li>次回から元の曜日に戻す</li>
      </ol>
    </section>
  `));

  await fs.writeFile(path.join(OUT,"about","index.html"), shell("このサイトの情報について", `
    <section class="hero"><div class="kicker">このサイトについて</div><h1>情報の確認方法</h1><p class="lead">患者さんが行動に移しやすい表現を優先しつつ、根拠資料を確認して掲載する。</p></section>
    <section class="section panel"><h2>公開前の確認</h2><p>薬剤情報では先発医薬品の電子添文を必須根拠とし、患者向医薬品ガイド、公的安全性情報、ガイドライン、論文などを必要に応じて追加する。</p></section>
  `));

  await fs.writeFile(path.join(OUT,"evidence","index.html"), shell("根拠資料について", `
    <section class="hero"><div class="kicker">Evidence</div><h1>根拠資料について</h1><p class="lead">各情報の根拠と最終確認日を管理し、更新時に見直せる仕組みを使う。</p></section>
  `));

  await fs.writeFile(path.join(OUT,"professionals","index.html"), shell("医療・介護職の方へ", `
    <section class="hero"><div class="kicker">For Professionals</div><h1>医療・介護職の方へ</h1><p class="lead">患者向け情報と同じ根拠から、専門職向け要点へ展開する予定だ。</p></section>
  `));

  console.log("Built patient-facing preview UI v0.3.1.");
}

function prop(page, name) { return page.properties?.[name]; }
function textValue(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map(x=>x.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map(x=>x.plain_text).join("");
  if (p.type === "select") return p.select?.name || "";
  if (p.type === "status") return p.status?.name || "";
  if (p.type === "date") return p.date?.start || "";
  return "";
}
function relationIds(p){ return (p?.relation || []).map(x=>x.id); }

async function queryAll(notion, dataSourceId, filter) {
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

async function hasRequiredBrandEvidence(notion, drug) {
  const ids = relationIds(prop(drug,"根拠資料"));
  if (!ids.length) {
    console.warn(`[PUBLICATION CHECK] ${textValue(prop(drug,"薬剤名"))}: 根拠資料Relationが空`);
    return false;
  }

  for (const id of ids) {
    const evidence = await notion.pages.retrieve({ page_id: id });
    const kind = textValue(prop(evidence,"資料種別"));
    const productClass = textValue(prop(evidence,"製品区分"));
    const evidenceName = textValue(prop(evidence,"資料名"));

    console.log(
      `[EVIDENCE] ${textValue(prop(drug,"薬剤名"))} <- ${evidenceName} / 資料種別=${kind || "未設定"} / 製品区分=${productClass || "未設定"}`
    );

    if (kind === "電子添文" && productClass === "先発品") {
      console.log(`[PUBLICATION CHECK] ${textValue(prop(drug,"薬剤名"))}: 先発品電子添文を確認`);
      return true;
    }
  }

  console.warn(
    `[PUBLICATION CHECK] ${textValue(prop(drug,"薬剤名"))}: 「資料種別=電子添文」かつ「製品区分=先発品」の根拠がないため非公開`
  );
  return false;
}

async function buildFromNotion() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT,"drugs"), { recursive: true });

  const publishFilter = {
    and: [
      { property: "Web公開", checkbox: { equals: true } },
      { property: "レビュー状態", status: { equals: "完了" } },
      { property: "最終レビュー", date: { is_not_empty: true } },
    ]
  };

  const drugs = await queryAll(notion, IDS.drugs, publishFilter);
  console.log(`[PUBLICATION CHECK] 基本公開条件を満たす薬剤: ${drugs.length}件`);
  const approved = [];
  for (const d of drugs) {
    const name = textValue(prop(d,"薬剤名"));
    const slug = textValue(prop(d,"slug"));
    console.log(`[PUBLICATION CHECK] 確認開始: ${name} / slug=${slug || "未設定"}`);

    if (!slug) {
      console.warn(`[PUBLICATION CHECK] ${name}: slug未設定のため非公開`);
      continue;
    }

    if (await hasRequiredBrandEvidence(notion,d)) {
      approved.push(d);
      console.log(`[PUBLICATION CHECK] ${name}: 公開対象`);
    }
  }

  const cards = approved.map(d => {
    const name=textValue(prop(d,"薬剤名"));
    const slug=textValue(prop(d,"slug"));
    const lead=textValue(prop(d,"患者向け一言"));
    return `<a class="card" href="/drugs/${esc(slug)}/"><span>薬から探す</span><h3>${esc(name)}</h3><p>${esc(lead)}</p></a>`;
  }).join("");

  await fs.writeFile(path.join(OUT,"index.html"), shell("トップ", `
    <section class="hero">
      <div class="kicker">くすりの情報を、今知りたいことから</div>
      <h1>薬について、<br>知りたいことから探せます。</h1>
      <p class="lead">レビューと公開承認が完了した薬情報を掲載している。</p>
    </section>
    <section class="section"><h2 class="section-title">薬から探す</h2><div class="grid">${cards || "<p>現在、公開済みの薬はない。</p>"}</div></section>
  `));

  for (const d of approved) {
    const name = textValue(prop(d,"薬剤名"));
    const slug = textValue(prop(d,"slug"));
    const lead = textValue(prop(d,"患者向け一言"));
    const reviewDate = textValue(prop(d,"最終レビュー"));

    const dir = path.join(OUT,"drugs",slug);
    await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,"index.html"), shell(name, `
      <section class="hero">
        <div class="kicker">薬の情報</div>
        <h1>${esc(name)}</h1>
        <p class="lead">${esc(lead)}</p>
      </section>
      <section class="section panel soft">
        <div class="eyebrow">公開確認</div>
        <h2>根拠資料を確認して掲載</h2>
        <p>先発医薬品の電子添文が根拠資料として登録され、レビュー・公開条件を満たしている。</p>
      </section>
      <section class="section panel ref">最終レビュー：${esc(reviewDate)}</section>
    `));
  }

  console.log(`Built ${approved.length} approved drug(s) from Notion.`);
}

async function main() {
  if (PREVIEW_MODE) {
    console.warn(`Preview mode: missing ${MISSING_ENV.join(", ")}`);
    return buildPreview();
  }
  return buildFromNotion();
}

main().catch(err => { console.error(err); process.exit(1); });
