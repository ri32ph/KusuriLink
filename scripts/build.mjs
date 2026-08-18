// kusuri-link v0.5.2 — Node 22.x pinned
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
const MISSING_ENV = Object.entries(REQUIRED_ENV).filter(([,v])=>!v).map(([k])=>k);
const PREVIEW_MODE = MISSING_ENV.length > 0;

const esc=(s="")=>String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

function prop(page,name){return page.properties?.[name];}
function textValue(p){
  if(!p) return "";
  if(p.type==="title") return (p.title||[]).map(x=>x.plain_text).join("");
  if(p.type==="rich_text") return (p.rich_text||[]).map(x=>x.plain_text).join("");
  if(p.type==="select") return p.select?.name||"";
  if(p.type==="status") return p.status?.name||"";
  if(p.type==="date") return p.date?.start||"";
  if(p.type==="url") return p.url||"";
  return "";
}
function multiValue(p){return (p?.multi_select||[]).map(x=>x.name);}
function relationIds(p){return (p?.relation||[]).map(x=>x.id);}
function checkboxValue(p){return !!p?.checkbox;}

async function queryAll(notion,dataSourceId){
  const out=[]; let cursor;
  do{
    const res=await notion.dataSources.query({
      data_source_id:dataSourceId,start_cursor:cursor,page_size:100
    });
    out.push(...res.results.filter(x=>x.object==="page"));
    cursor=res.has_more?res.next_cursor:undefined;
  }while(cursor);
  return out;
}

function isPublishReady(page,label){
  const web=checkboxValue(prop(page,"Web公開"));
  const status=textValue(prop(page,"レビュー状態"));
  const review=textValue(prop(page,"最終レビュー"));
  const slug=textValue(prop(page,"slug"));
  const ok=web && status==="完了" && !!review && !!slug;
  console.log(`[PUBLICATION ROW] ${label}: Web公開=${web?"ON":"OFF"} / レビュー状態=${status||"未設定"} / 最終レビュー=${review||"未設定"} / slug=${slug||"未設定"} / ${ok?"PASS":"SKIP"}`);
  return ok;
}

async function hasRequiredBrandEvidence(notion,drug){
  const ids=relationIds(prop(drug,"根拠資料"));
  if(!ids.length){
    console.warn(`[PUBLICATION CHECK] ${textValue(prop(drug,"薬剤名"))}: 根拠資料Relationが空`);
    return false;
  }
  for(const id of ids){
    const evidence=await notion.pages.retrieve({page_id:id});
    const kind=textValue(prop(evidence,"資料種別"));
    const productClass=textValue(prop(evidence,"製品区分"));
    const evidenceName=textValue(prop(evidence,"資料名"));
    console.log(`[EVIDENCE] ${textValue(prop(drug,"薬剤名"))} <- ${evidenceName} / 資料種別=${kind||"未設定"} / 製品区分=${productClass||"未設定"}`);
    if(kind==="電子添文" && productClass==="先発品"){
      console.log(`[PUBLICATION CHECK] ${textValue(prop(drug,"薬剤名"))}: 先発品電子添文を確認`);
      return true;
    }
  }
  console.warn(`[PUBLICATION CHECK] ${textValue(prop(drug,"薬剤名"))}: 先発品電子添文なし`);
  return false;
}

async function getBlocks(notion,pageId){
  const all=[]; let cursor;
  do{
    const res=await notion.blocks.children.list({block_id:pageId,page_size:100,start_cursor:cursor});
    all.push(...res.results);
    cursor=res.has_more?res.next_cursor:undefined;
  }while(cursor);
  return all;
}
function richTextFromBlock(block){
  const body=block?.[block.type];
  return (body?.rich_text||[]).map(x=>x.plain_text).join("");
}
function patientSectionsFromBlocks(blocks){
  const excluded=new Set(["医療・介護職向け","医療・介護職向け要点","Clinical Point","編集メモ","根拠","Webでの見せ方","患者向けWebでの見せ方"]);
  const sections=[]; let current=null;
  for(const block of blocks){
    if(["heading_1","heading_2","heading_3"].includes(block.type)){
      current={title:richTextFromBlock(block).trim(),items:[]}; sections.push(current); continue;
    }
    const text=richTextFromBlock(block).trim();
    if(!text) continue;
    if(!current){current={title:"",items:[]};sections.push(current);}
    current.items.push({type:block.type,text});
  }
  return sections.filter(s=>!excluded.has(s.title));
}

const css=`
:root{
 --ink:#2b2d30;--muted:#6f7479;--line:#e7e8ea;--line2:#d9dbde;
 --accent:#f05f48;--accent-soft:#fff0eb;--accent-pale:#fff7f3;
 --soft:#f7f7f5;--shadow:0 10px 28px rgba(32,35,38,.07)
}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:#fff;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.75}
a{color:inherit}.wrap{max-width:1180px;margin:auto;padding:0 28px}
header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.head{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{display:flex;align-items:center;gap:13px;text-decoration:none}
.logo{font-size:30px;color:var(--accent)}.brand-copy strong{display:block;font-size:21px}.brand-copy small{display:block;font-size:11px;color:var(--muted)}
.header-link{font-size:14px;font-weight:700;text-decoration:none}
main{padding:46px 0 84px}
.hero{display:grid;grid-template-columns:.9fr 1.5fr;gap:48px;align-items:center;padding:34px 0 48px}
.kicker,.eyebrow{color:var(--accent);font-size:13px;font-weight:800;letter-spacing:.06em}
h1{margin:8px 0 18px;font-size:clamp(40px,6vw,68px);line-height:1.16;letter-spacing:-.03em}
h1 .accent{color:var(--accent)}.lead{font-size:18px;color:#404347;max-width:650px;margin:0}
.entry-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.entry{display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px;min-height:250px;box-shadow:var(--shadow);position:relative;transition:.15s}
.entry:hover{transform:translateY(-3px);border-color:#f4b4a8}
.num{display:block;color:var(--accent);font-size:25px;font-weight:800}.icon-ring{width:88px;height:88px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;margin:20px auto 24px;font-size:37px}
.entry h3{font-size:22px;text-align:center;margin:0 0 6px}.entry p{text-align:center;color:var(--muted);font-size:14px;margin:0;padding-top:12px;border-top:1px solid var(--line)}
.entry .arrow{position:absolute;right:22px;bottom:14px;color:var(--accent);font-size:24px}
.section{margin-top:44px}.section-divider{border-top:1px solid var(--line);padding-top:28px}
.section-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}.section-bar{width:5px;height:30px;background:var(--accent)}
.section-title{font-size:28px;margin:0}.section-intro{color:var(--muted);font-size:14px;margin:2px 0 0}
.two-col{display:grid;grid-template-columns:1fr 1.15fr;gap:52px}
.search-row{display:flex;gap:10px}.search{width:100%;padding:15px 16px;border:1px solid var(--line2);border-radius:10px;font-size:16px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.search-button{border:0;background:var(--accent);color:#fff;border-radius:10px;padding:0 22px;font-weight:800;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
.card{display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:12px;padding:17px 18px;transition:.15s}
.card:hover{border-color:#f4b4a8;box-shadow:0 7px 20px rgba(32,35,38,.05)}
.card span{display:inline-block;color:var(--muted);font-size:11px;font-weight:700;background:var(--soft);border-radius:999px;padding:3px 9px}
.card h3{font-size:18px;margin:7px 0 2px}.card p{font-size:13px;color:var(--muted);margin:0}
.chips{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.chip{display:flex;align-items:center;gap:10px;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:11px;padding:16px 18px;font-size:15px;font-weight:700}
.chip:before{content:"";width:10px;height:10px;border:2px solid var(--accent);border-radius:50%}
.panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px}.panel.soft{background:var(--accent-pale);border-color:#f6d4cc}
.quick-list{margin:10px 0 0;padding-left:22px}.notice{margin-top:22px;background:var(--accent-pale);border:1px solid #f6d9d1;border-radius:12px;padding:20px 22px}
.ref{font-size:13px;color:var(--muted)}
footer{border-top:1px solid var(--line);padding:28px 0 36px;color:var(--muted);font-size:13px}
.footer-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}.footer-item{padding-left:18px;border-left:1px solid var(--line)}.footer-item strong{display:block;color:var(--ink);font-size:14px}.footer-item span{display:block;font-size:12px}
@media(max-width:900px){.hero{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}.entry-grid{grid-template-columns:1fr}.entry{min-height:auto}.chips{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.wrap{padding:0 18px}.header-link{display:none}h1{font-size:40px}.grid,.chips,.footer-grid{grid-template-columns:1fr}.search-row{flex-direction:column}.search-button{padding:14px 18px}}
`;

function shell(title,body){
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}｜くすりとくらしの情報 Link</title><style>${css}</style></head>
<body><header><div class="wrap head"><a class="brand" href="/"><span class="logo">🔗</span><span class="brand-copy"><strong>くすりとくらしの情報 <span style="color:var(--accent)">Link</span></strong><small>薬のこと、知りたいから探せます</small></span></a><a class="header-link" href="/about/">このサイトについて ↓</a></div></header>
<main class="wrap">${body}</main><footer><div class="wrap footer-grid">
<div class="footer-item"><strong>このサイトの情報について</strong><span>情報の根拠や更新について</span></div>
<div class="footer-item"><strong>根拠資料について</strong><span>電子添文やガイドライン</span></div>
<div class="footer-item"><strong>医療・介護職の方へ</strong><span>専門職向けの情報</span></div>
<div class="footer-item"><strong>迷ったときは</strong><span>処方医・薬剤師などへ確認する</span></div>
</div></footer></body></html>`;
}

async function buildPreview(){
 await fs.rm(OUT,{recursive:true,force:true});
 await fs.mkdir(OUT,{recursive:true});
 await fs.writeFile(path.join(OUT,"index.html"),shell("トップ",`
 <section class="hero">
  <div><div class="kicker">患者さんの「知りたい」から探す</div><h1>薬のこと、<br><span class="accent">「知りたい」</span>から探せます。</h1><p class="lead">薬の名前だけでなく、飲み忘れ、副作用、生活の中で気になることから情報を探せます。</p></div>
  <div class="entry-grid">
   <a class="entry" href="#drugs"><span class="num">01</span><span class="icon-ring">💊</span><h3>薬から探す</h3><p>薬の名前が分かっている方はこちら</p><span class="arrow">→</span></a>
   <a class="entry" href="#troubles"><span class="num">02</span><span class="icon-ring">？</span><h3>困りごとから探す</h3><p>今困っていることや不安なことから探す</p><span class="arrow">→</span></a>
   <a class="entry" href="#quick"><span class="num">03</span><span class="icon-ring">📖</span><h3>まず知っておきたい</h3><p>飲み方や注意点など、基本的な情報を見る</p><span class="arrow">→</span></a>
  </div>
 </section>
 <section class="section section-divider two-col">
  <div id="drugs"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">薬から探す</h2></div><div class="grid"><div class="card"><span>骨粗しょう症の薬</span><h3>アレンドロン酸</h3><p>骨を壊す働きを抑え、骨折を防ぐために使われる薬。</p></div></div></div>
  <div id="troubles"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">こんなことで困っていませんか？</h2></div><div class="chips"><span class="chip">薬を飲み忘れた</span><span class="chip">胸やけがする</span><span class="chip">歯医者に行く</span></div></div>
 </section>`));
}

async function buildFromNotion(){
 const notion=new Client({auth:process.env.NOTION_API_KEY});
 await fs.rm(OUT,{recursive:true,force:true});
 await fs.mkdir(path.join(OUT,"drugs"),{recursive:true});
 await fs.mkdir(path.join(OUT,"topics"),{recursive:true});
 await fs.mkdir(path.join(OUT,"troubles"),{recursive:true});
 await fs.mkdir(path.join(OUT,"about"),{recursive:true});
 await fs.mkdir(path.join(OUT,"evidence"),{recursive:true});
 await fs.mkdir(path.join(OUT,"professionals"),{recursive:true});

 const [allDrugs,allTopics,allTroubles]=await Promise.all([
  queryAll(notion,IDS.drugs),queryAll(notion,IDS.topics),queryAll(notion,IDS.troubles)
 ]);
 console.log(`[NOTION FETCH] 全件取得 薬剤=${allDrugs.length} / トピック=${allTopics.length} / 困りごと=${allTroubles.length}`);

 const drugRows=allDrugs.filter(d=>isPublishReady(d,`薬剤:${textValue(prop(d,"薬剤名"))||d.id}`));
 const topicRows=allTopics.filter(t=>isPublishReady(t,`トピック:${textValue(prop(t,"トピック名"))||t.id}`));
 const troubleRows=allTroubles.filter(t=>isPublishReady(t,`困りごと:${textValue(prop(t,"困りごと"))||t.id}`));

 const approvedDrugs=[];
 for(const d of drugRows) if(await hasRequiredBrandEvidence(notion,d)) approvedDrugs.push(d);
 const approvedTopics=topicRows, approvedTroubles=troubleRows;

 const drugMap=new Map(approvedDrugs.map(x=>[x.id,x]));
 const topicMap=new Map(approvedTopics.map(x=>[x.id,x]));
 const troubleMap=new Map(approvedTroubles.map(x=>[x.id,x]));

 const drugCards=approvedDrugs.map(d=>{
  const name=textValue(prop(d,"薬剤名")),slug=textValue(prop(d,"slug")),lead=textValue(prop(d,"患者向け一言"));
  const indication=multiValue(prop(d,"主な適応")).join(" / ");
  return `<a class="card" href="/drugs/${esc(slug)}/"><span>${esc(indication||"薬の情報")}</span><h3>${esc(name)}</h3><p>${esc(lead)}</p></a>`;
 }).join("");

 const troubleChips = approvedTroubles.slice(0,12).map(t => {
  const slug = textValue(prop(t,"slug"));
  const title = textValue(prop(t,"困りごと"));
  return `<a class="chip" href="/troubles/${esc(slug)}/">${esc(title)}</a>`;
 }).join("");

 const quickTopics = approvedTopics
  .filter(t => ["服用方法","作用"].includes(textValue(prop(t,"カテゴリ"))))
  .slice(0,6)
  .map(t => {
    const slug = textValue(prop(t,"slug"));
    const category = textValue(prop(t,"カテゴリ"));
    const title = textValue(prop(t,"トピック名"));
    const summary = textValue(prop(t,"患者向け要約"));
    return `<a class="card" href="/topics/${esc(slug)}/"><span>${esc(category)}</span><h3>${esc(title)}</h3><p>${esc(summary)}</p></a>`;
  }).join("");

 await fs.writeFile(path.join(OUT,"index.html"),shell("トップ",`
 <section class="hero">
  <div><div class="kicker">患者さんの「知りたい」から探す</div><h1>薬のこと、<br><span class="accent">「知りたい」</span>から探せます。</h1><p class="lead">薬の名前だけでなく、飲み忘れ、副作用、生活の中で気になることから情報を探せます。</p></div>
  <div class="entry-grid">
   <a class="entry" href="#drugs"><span class="num">01</span><span class="icon-ring">💊</span><h3>薬から探す</h3><p>薬の名前が分かっている方はこちら</p><span class="arrow">→</span></a>
   <a class="entry" href="#troubles"><span class="num">02</span><span class="icon-ring">？</span><h3>困りごとから探す</h3><p>今困っていることや不安なことから探す</p><span class="arrow">→</span></a>
   <a class="entry" href="#quick"><span class="num">03</span><span class="icon-ring">📖</span><h3>まず知っておきたい</h3><p>飲み方や注意点など、基本的な情報を見る</p><span class="arrow">→</span></a>
  </div>
 </section>
 <section class="section section-divider two-col">
  <div id="drugs"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">薬から探す</h2></div><div class="search-row"><input class="search" placeholder="薬の名前を入力してください"><button class="search-button">検索</button></div><div class="grid">${drugCards||"<p>現在、公開済みの薬はない。</p>"}</div></div>
  <div id="troubles"><div class="section-head"><span class="section-bar"></span><div><h2 class="section-title">こんなことで困っていませんか？</h2><p class="section-intro">医学用語ではなく、今困っていることから探す。</p></div></div><div class="chips">${troubleChips||"<span class='ref'>現在、公開済みの困りごとはない。</span>"}</div><div class="notice">迷ったときや心配なときは、処方医や薬剤師などに相談してください。</div></div>
 </section>
 <section id="quick" class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">まず知っておきたい</h2></div><div class="grid">${quickTopics||"<p>現在、公開済みのトピックはない。</p>"}</div></section>
 `));

 for(const d of approvedDrugs){
  const name=textValue(prop(d,"薬剤名")),slug=textValue(prop(d,"slug")),lead=textValue(prop(d,"患者向け一言")),reviewDate=textValue(prop(d,"最終レビュー"));
  const topicCards=relationIds(prop(d,"トピック")).map(id=>topicMap.get(id)).filter(Boolean).map(t=>`<a class="card" href="/topics/${esc(textValue(prop(t,"slug")))}/"><span>${esc(textValue(prop(t,"カテゴリ")))}</span><h3>${esc(textValue(prop(t,"トピック名")))}</h3><p>${esc(textValue(prop(t,"患者向け要約")))}</p></a>`).join("");
  const troubleCards=relationIds(prop(d,"困りごと")).map(id=>troubleMap.get(id)).filter(Boolean).map(t=>`<a class="card" href="/troubles/${esc(textValue(prop(t,"slug")))}/"><span>${esc(textValue(prop(t,"カテゴリ")))}</span><h3>${esc(textValue(prop(t,"困りごと")))}</h3><p>${esc(textValue(prop(t,"短い回答")))}</p></a>`).join("");
  const dir=path.join(OUT,"drugs",slug); await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,"index.html"),shell(name,`
   <section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">${esc(multiValue(prop(d,"薬効群")).join(" / ")||"薬の情報")}</div><h1>${esc(name)}</h1><p class="lead">${esc(lead)}</p></div></section>
   <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">この薬について知る</h2></div><div class="grid">${topicCards||"<p>公開済みトピックはまだない。</p>"}</div></section>
   <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">困りごとから探す</h2></div><div class="grid">${troubleCards||"<p>公開済みの困りごとはまだない。</p>"}</div></section>
   <section class="section ref">最終レビュー：${esc(reviewDate)}</section>`));
 }

 for(const t of approvedTopics){
  const title=textValue(prop(t,"トピック名")),slug=textValue(prop(t,"slug")),category=textValue(prop(t,"カテゴリ"));
  const summary=textValue(prop(t,"患者向け要約")),action=textValue(prop(t,"患者向け対応")),professional=textValue(prop(t,"専門職向け要約")),reviewDate=textValue(prop(t,"最終レビュー"));
  const blocks=await getBlocks(notion,t.id);
  const sections=patientSectionsFromBlocks(blocks).map(sec=>`<section class="section panel">${sec.title?`<h2>${esc(sec.title)}</h2>`:""}${sec.items.map(i=>`<p>${esc(i.text)}</p>`).join("")}</section>`).join("");
  const dir=path.join(OUT,"topics",slug);await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,"index.html"),shell(title,`
   <section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">${esc(category)}</div><h1>${esc(title)}</h1><p class="lead">${esc(summary)}</p></div></section>
   ${action?`<section class="section panel soft"><div class="eyebrow">どうすればいい？</div><p>${esc(action)}</p></section>`:""}
   ${sections}
   ${professional?`<details class="section panel"><summary><b>医療・介護職向け要点</b></summary><p>${esc(professional)}</p></details>`:""}
   <section class="section ref">最終レビュー：${esc(reviewDate)}</section>`));
 }

 for(const t of approvedTroubles){
  const title=textValue(prop(t,"困りごと")),slug=textValue(prop(t,"slug")),category=textValue(prop(t,"カテゴリ")),question=textValue(prop(t,"患者さんの質問例")),short=textValue(prop(t,"短い回答")),urgency=textValue(prop(t,"緊急度")),reviewDate=textValue(prop(t,"最終レビュー"));
  const relatedTopics=relationIds(prop(t,"関連トピック")).map(id=>topicMap.get(id)).filter(Boolean).map(x=>`<a class="card" href="/topics/${esc(textValue(prop(x,"slug")))}/"><span>${esc(textValue(prop(x,"カテゴリ")))}</span><h3>${esc(textValue(prop(x,"トピック名")))}</h3><p>${esc(textValue(prop(x,"患者向け要約")))}</p></a>`).join("");
  const dir=path.join(OUT,"troubles",slug);await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,"index.html"),shell(title,`
   <section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">${esc(category)}</div><h1>${esc(title)}</h1>${question?`<p class="lead">「${esc(question)}」</p>`:""}</div></section>
   <section class="section panel soft"><div class="eyebrow">まず確認</div><h2>${esc(short||"関連する情報を確認する")}</h2>${urgency?`<p class="ref">相談の目安：${esc(urgency)}</p>`:""}</section>
   <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">詳しく見る</h2></div><div class="grid">${relatedTopics||"<p>関連トピックはまだない。</p>"}</div></section>
   <section class="section ref">最終レビュー：${esc(reviewDate)}</section>`));
 }

 await fs.writeFile(path.join(OUT,"about","index.html"),shell("このサイトについて",`<section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">このサイトについて</div><h1>情報の確認方法</h1><p class="lead">患者さんが行動に移しやすい表現を優先しつつ、根拠資料を確認して掲載する。</p></div></section>`));
 await fs.writeFile(path.join(OUT,"evidence","index.html"),shell("根拠資料について",`<section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">Evidence</div><h1>根拠資料について</h1><p class="lead">先発医薬品の電子添文を基本資料とする。</p></div></section>`));
 await fs.writeFile(path.join(OUT,"professionals","index.html"),shell("医療・介護職の方へ",`<section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">For Professionals</div><h1>医療・介護職の方へ</h1><p class="lead">患者向け情報と同じ根拠から、専門職向け要点を展開する。</p></div></section>`));
 console.log(`Built drugs=${approvedDrugs.length}, topics=${approvedTopics.length}, troubles=${approvedTroubles.length}`);
}

async function main(){
 if(PREVIEW_MODE){console.warn(`Preview mode: missing ${MISSING_ENV.join(", ")}`);return buildPreview();}
 return buildFromNotion();
}
main().catch(err=>{console.error(err);process.exit(1);});
