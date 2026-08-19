// kusuri-link v0.6.2 — render Notion Q&A page body
import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public");
const IDS = {
  drugs: process.env.NOTION_DRUGS_DATA_SOURCE_ID,
  topics: process.env.NOTION_TOPICS_DATA_SOURCE_ID,
  troubles: process.env.NOTION_TROUBLES_DATA_SOURCE_ID,
  evidence: process.env.NOTION_EVIDENCE_DATA_SOURCE_ID,
  questions: process.env.NOTION_QUESTIONS_DATA_SOURCE_ID || "1239feec-4626-4503-a819-250feb112c79",
};

const REQUIRED_ENV = {
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DRUGS_DATA_SOURCE_ID: IDS.drugs,
  NOTION_TOPICS_DATA_SOURCE_ID: IDS.topics,
  NOTION_TROUBLES_DATA_SOURCE_ID: IDS.troubles,
  NOTION_EVIDENCE_DATA_SOURCE_ID: IDS.evidence,
  NOTION_QUESTIONS_DATA_SOURCE_ID: IDS.questions,
};
const MISSING_ENV = Object.entries(REQUIRED_ENV).filter(([,v])=>!v).map(([k])=>k);
const PREVIEW_MODE = MISSING_ENV.length > 0;

const esc=(s="")=>String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");


function iconSvg(name, cls="flat-icon"){
  const common = `class="${cls}" viewBox="0 0 64 64" fill="none" aria-hidden="true"`;
  const stroke = `stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    pill: `<svg ${common}><rect x="11" y="23" width="42" height="18" rx="9" ${stroke}/><path d="M32 23v18" ${stroke}/><path d="M16 28h11" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    bubble: `<svg ${common}><path d="M13 15h38a7 7 0 0 1 7 7v18a7 7 0 0 1-7 7H31l-12 8v-8h-6a7 7 0 0 1-7-7V22a7 7 0 0 1 7-7Z" ${stroke}/><path d="M27 28c1.2-3.4 3.8-5.2 7.2-5.2 4.3 0 7.3 2.6 7.3 6.2 0 3.1-1.8 4.6-4.1 6.1-1.9 1.2-2.8 2.1-2.8 4.3" ${stroke}/><circle cx="34.5" cy="44.5" r="1.5" fill="var(--accent)"/></svg>`,
    book: `<svg ${common}><path d="M9 14h18c4 0 7 3 7 7v29c0-4-3-7-7-7H9V14Z" ${stroke}/><path d="M55 14H37c-4 0-7 3-7 7v29c0-4 3-7 7-7h18V14Z" ${stroke}/><path d="M16 23h11M16 29h11M38 23h10M38 29h10" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    clock: `<svg ${common}><circle cx="32" cy="32" r="22" ${stroke}/><path d="M32 18v15l10 6" ${stroke}/><circle cx="32" cy="32" r="2" fill="var(--accent)"/></svg>`,
    tooth: `<svg ${common}><path d="M22 9c-8 0-13 6-13 14 0 6 3 10 5 15 2 5 3 17 8 17 4 0 4-11 10-11s6 11 10 11c5 0 6-12 8-17 2-5 5-9 5-15 0-8-5-14-13-14-5 0-7 3-10 3s-5-3-10-3Z" ${stroke}/><path d="M22 15c3 2 6 3 10 3" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    chest: `<svg ${common}><path d="M24 10c-6 3-10 10-10 18 0 9 5 17 8 25h20c3-8 8-16 8-25 0-8-4-15-10-18" ${stroke}/><path d="M32 11v38" ${stroke}/><path d="M26 29c2-3 4-4 6-4 3 0 5 2 6 5" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    throat: `<svg ${common}><path d="M23 9c-2 8-1 14 3 18l3 3v22M41 9c2 8 1 14-3 18l-3 3v22" ${stroke}/><path d="M27 30h10" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    leg: `<svg ${common}><path d="M25 8c1 10 2 18 2 26l-5 20M39 8c-1 10-2 18-2 26l5 20" ${stroke}/><path d="M27 33c3 2 7 2 10 0" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    calendar: `<svg ${common}><rect x="10" y="14" width="44" height="40" rx="6" ${stroke}/><path d="M10 25h44M21 8v12M43 8v12" ${stroke}/><path d="M21 34h8M35 34h8M21 42h8" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    food: `<svg ${common}><circle cx="32" cy="33" r="18" ${stroke}/><path d="M13 13v16M8 13v10c0 4 2 6 5 6s5-2 5-6V13M51 13v16M51 13c5 5 6 11 0 16" ${stroke}/><path d="M24 33h16" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    warning: `<svg ${common}><path d="M32 9 57 53H7L32 9Z" ${stroke}/><path d="M32 23v15" ${stroke}/><circle cx="32" cy="44" r="1.7" fill="var(--accent)"/></svg>`,
    link: `<svg ${common}><path d="M24 39l-5 5a8 8 0 0 1-11-11l9-9a8 8 0 0 1 11 0" ${stroke}/><path d="M40 25l5-5a8 8 0 0 1 11 11l-9 9a8 8 0 0 1-11 0" ${stroke}/><path d="M23 41l18-18" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/></svg>`
  };
  return icons[name] || icons.bubble;
}
function iconForTrouble(category,title=""){
  if(title.includes("胸やけ")) return "chest";
  if(title.includes("飲み込み")) return "throat";
  if(title.includes("太もも")||title.includes("足の付け根")) return "leg";
  const map={"飲み忘れ":"clock","歯科":"tooth","治療期間":"calendar","食事":"food","副作用":"warning","飲み方":"pill"};
  return map[category]||"bubble";
}


function notionPageIcon(page, fallbackName="bubble", cls="mini-icon"){
  const icon = page?.icon;
  if(!icon) return iconSvg(fallbackName, cls);

  if(icon.type === "emoji" && icon.emoji){
    return `<span class="notion-emoji" aria-hidden="true">${esc(icon.emoji)}</span>`;
  }

  let url = "";
  if(icon.type === "external") url = icon.external?.url || "";
  if(icon.type === "file") url = icon.file?.url || "";
  if(icon.type === "custom_emoji") url = icon.custom_emoji?.url || "";

  if(url){
    return `<img class="notion-image-icon" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }

  return iconSvg(fallbackName, cls);
}

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


const GENERAL_QUESTIONERS=new Set(["患者","家族","一般向け"]);
const PROFESSIONAL_AUDIENCES=new Set(["薬剤師向け","医療者向け","介護職向け"]);
function multiSelectValues(p){
  if(!p)return [];
  if(p.type==="multi_select")return (p.multi_select||[]).map(x=>x.name).filter(Boolean);
  const one=textValue(p);return one?[one]:[];
}
function questionAudiences(q){
  const modern=multiSelectValues(prop(q,"対象区分"));
  if(modern.length)return modern;
  const legacy=textValue(prop(q,"質問者区分"));
  if(GENERAL_QUESTIONERS.has(legacy))return ["一般向け"];
  if(legacy==="薬剤師")return ["薬剤師向け"];
  if(["医師","看護師","歯科","リハ職","管理栄養士"].includes(legacy))return ["医療者向け"];
  if(legacy==="介護職")return ["介護職向け"];
  return [];
}

function isQuestionPublishReady(q){
  const ok=checkboxValue(prop(q,"公開候補"))
    && textValue(prop(q,"回答状態"))==="完了"
    && checkboxValue(prop(q,"根拠確認"))
    && !!textValue(prop(q,"質問"))
    && !!textValue(prop(q,"回答案"));
  const audiences=questionAudiences(q);
  return ok && audiences.some(x=>x==="一般向け"||PROFESSIONAL_AUDIENCES.has(x));
}
function questionPdfUrl(q){
  for(const name of ["PDF資料","PDF URL"]){
    const p=prop(q,name);
    if(!p)continue;
    if(p.type==="url"&&p.url)return p.url;
    if(p.type==="files"&&p.files?.length){
      const f=p.files[0];
      return f.external?.url||f.file?.url||"";
    }
  }
  return "";
}
function questionSlug(q){
  const id=textValue(prop(q,"Question ID")).trim();
  return id ? id.toLowerCase().replace(/[^a-z0-9_-]+/g,"-") : q.id.replaceAll("-","");
}
function qaCard(q,base){
  const question=textValue(prop(q,"質問"));
  const answer=textValue(prop(q,"回答案"));
  const category=textValue(prop(q,"質問カテゴリ"))||"その他";
  const audiences=questionAudiences(q);
  return `<a class="qa-card" data-audiences="${esc(audiences.join(" "))}" href="${base}${esc(questionSlug(q))}/">
    <div class="qa-meta"><span>${esc(category)}</span>${audiences.map(x=>`<span>${esc(x)}</span>`).join("")}</div>
    <div class="qa-q"><span class="qa-letter">Q</span><h3>${esc(question)}</h3></div>
    <p>${esc(answer.length>100?answer.slice(0,100)+"…":answer)}</p>
    <span class="qa-more">回答を見る →</span>
  </a>`;
}


async function fetchAllBlocks(notion,blockId){
  const blocks=[];
  let cursor=undefined;
  do{
    const r=await notion.blocks.children.list({block_id:blockId,start_cursor:cursor,page_size:100});
    for(const b of r.results){
      blocks.push(b);
      if(b.has_children){
        b._children=await fetchAllBlocks(notion,b.id);
      }
    }
    cursor=r.has_more?r.next_cursor:undefined;
  }while(cursor);
  return blocks;
}
function richTextHtml(items=[]){
  return items.map(x=>{
    let t=esc(x.plain_text||"");
    if(x.annotations?.code) t=`<code>${t}</code>`;
    if(x.annotations?.bold) t=`<strong>${t}</strong>`;
    if(x.annotations?.italic) t=`<em>${t}</em>`;
    if(x.annotations?.strikethrough) t=`<s>${t}</s>`;
    if(x.annotations?.underline) t=`<u>${t}</u>`;
    if(x.href) t=`<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${t}</a>`;
    return t;
  }).join("");
}
function renderQuestionBlocks(blocks=[]){
  const html=[];
  let listType=null,listItems=[];
  const flush=()=>{
    if(!listItems.length)return;
    const tag=listType==="numbered_list_item"?"ol":"ul";
    html.push(`<${tag}>${listItems.join("")}</${tag}>`);
    listItems=[];listType=null;
  };
  for(const b of blocks){
    const type=b.type;
    const data=b[type]||{};
    if(type==="bulleted_list_item"||type==="numbered_list_item"){
      if(listType&&listType!==type)flush();
      listType=type;
      const child=b._children?.length?renderQuestionBlocks(b._children):"";
      listItems.push(`<li>${richTextHtml(data.rich_text)}${child}</li>`);
      continue;
    }
    flush();
    if(type==="paragraph") html.push(`<p>${richTextHtml(data.rich_text)}</p>`);
    else if(type==="heading_1") html.push(`<h2>${richTextHtml(data.rich_text)}</h2>`);
    else if(type==="heading_2") html.push(`<h2>${richTextHtml(data.rich_text)}</h2>`);
    else if(type==="heading_3") html.push(`<h3>${richTextHtml(data.rich_text)}</h3>`);
    else if(type==="quote") html.push(`<blockquote>${richTextHtml(data.rich_text)}</blockquote>`);
    else if(type==="callout") html.push(`<div class="qa-callout">${richTextHtml(data.rich_text)}</div>`);
    else if(type==="divider") html.push(`<hr>`);
    else if(type==="toggle"){
      const child=b._children?.length?renderQuestionBlocks(b._children):"";
      html.push(`<details><summary>${richTextHtml(data.rich_text)}</summary>${child}</details>`);
    }
  }
  flush();
  return html.join("");
}

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
.logo-wrap{width:38px;height:38px;display:grid;place-items:center;color:var(--accent)}.brand-icon{width:34px;height:34px;display:block}.brand-copy strong{display:block;font-size:21px}.brand-copy small{display:block;font-size:11px;color:var(--muted)}
.header-link{font-size:14px;font-weight:700;text-decoration:none}
main{padding:46px 0 84px}
.hero{display:grid;grid-template-columns:.9fr 1.5fr;gap:48px;align-items:center;padding:34px 0 48px}
.kicker,.eyebrow{color:var(--accent);font-size:13px;font-weight:800;letter-spacing:.06em}
h1{margin:8px 0 18px;font-size:clamp(40px,6vw,68px);line-height:1.16;letter-spacing:-.03em}
h1 .accent{color:var(--accent)}.lead{font-size:18px;color:#404347;max-width:650px;margin:0}
.entry-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.entry{display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px;min-height:250px;box-shadow:var(--shadow);position:relative;transition:.15s}
.entry:hover{transform:translateY(-3px);border-color:#f4b4a8}
.num{display:block;color:var(--accent);font-size:25px;font-weight:800}.icon-ring{width:88px;height:88px;border-radius:50%;background:var(--accent-soft);display:grid;place-items:center;margin:20px auto 24px;color:var(--ink)}.flat-icon{width:52px;height:52px;display:block}.mini-icon{width:24px;height:24px;display:block;color:var(--ink)}
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
.chips{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.chip{display:flex;align-items:center;gap:10px;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:11px;padding:16px 18px;font-size:15px;font-weight:700}
.chip:before{content:"";width:10px;height:10px;border:2px solid var(--accent);border-radius:50%}
.panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:24px}.panel.soft{background:var(--accent-pale);border-color:#f6d4cc}
.quick-list{margin:10px 0 0;padding-left:22px}.notice{margin-top:22px;background:var(--accent-pale);border:1px solid #f6d9d1;border-radius:12px;padding:20px 22px}
.ref{font-size:13px;color:var(--muted)}
footer{border-top:1px solid var(--line);padding:28px 0 36px;color:var(--muted);font-size:13px}
.footer-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}.footer-item{padding-left:18px;border-left:1px solid var(--line)}.footer-item strong{display:block;color:var(--ink);font-size:14px}.footer-item span{display:block;font-size:12px}

.qa-hero{max-width:820px;padding:30px 0 18px}.qa-hero h1{font-size:clamp(38px,5vw,58px)}
.audience-switch{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.audience-tab{padding:9px 14px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;background:#fff;color:inherit;font-family:inherit;cursor:pointer}.profession-filter{margin-top:12px}
.audience-tab.active{background:var(--accent-soft);border-color:var(--accent);color:#a84334}
.qa-list{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px}
.qa-card{display:block;text-decoration:none;border:1px solid var(--line);border-radius:14px;padding:20px;background:#fff}
.qa-card:hover{border-color:#f2aa9c;box-shadow:0 8px 24px rgba(32,35,38,.06)}
.qa-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.qa-meta span{font-size:11px;color:var(--muted);background:var(--soft);border-radius:999px;padding:3px 9px}
.qa-q{display:flex;gap:12px;align-items:flex-start}.qa-q h3{font-size:18px;line-height:1.55;margin:1px 0 6px}
.qa-letter,.qa-answer-letter{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;font-weight:900;flex:0 0 auto}
.qa-letter{background:var(--soft)}.qa-answer-letter{background:var(--accent);color:#fff}
.qa-card p{font-size:13px;color:var(--muted);margin:8px 0}.qa-more{font-size:13px;font-weight:800;color:var(--accent)}
.qa-detail{max-width:860px;margin:0 auto}.qa-question-box{display:flex;gap:15px;align-items:flex-start;padding:22px 0;border-bottom:1px solid var(--line)}
.qa-question-box h1{font-size:clamp(30px,4.5vw,48px);margin:0;line-height:1.35}
.qa-answer-box{display:flex;gap:15px;align-items:flex-start;background:var(--accent-pale);border:1px solid #f5d4cd;border-radius:14px;padding:24px;margin-top:24px}
.qa-answer-box p{font-size:18px;line-height:1.85;margin:0}.related-row{display:flex;gap:9px;flex-wrap:wrap}.qa-pdf{margin-top:26px;padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}.qa-pdf a{font-weight:800;color:var(--accent);text-decoration:none}.related-link{border:1px solid var(--line);border-radius:999px;padding:7px 12px;text-decoration:none;font-size:13px;font-weight:700}

.qa-body{margin-top:28px;font-size:16px;line-height:1.9}.qa-body h2{font-size:24px;margin:34px 0 12px}.qa-body h3{font-size:19px;margin:26px 0 10px}.qa-body p{margin:0 0 16px}.qa-body ul,.qa-body ol{padding-left:1.5em;margin:0 0 18px}.qa-body li{margin:5px 0}.qa-body blockquote{margin:20px 0;padding:14px 18px;border-left:4px solid var(--accent);background:var(--accent-pale)}.qa-callout{margin:20px 0;padding:16px 18px;border:1px solid #f5d4cd;border-radius:12px;background:var(--accent-pale)}.qa-body hr{border:0;border-top:1px solid var(--line);margin:28px 0}.qa-body details{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:14px 0}.qa-body summary{font-weight:800;cursor:pointer}

.home-intro{max-width:none;width:100%;padding:28px 0 12px}
.home-intro h1{font-size:clamp(42px,5.2vw,64px);font-weight:900;margin:8px 0 18px;line-height:1.18}.hero-line{display:block}.hero-line-2{color:var(--accent)}.home-intro .lead{max-width:none;white-space:nowrap}
.home-search{margin-top:22px;max-width:700px}
.home-search input{width:100%;border:1px solid var(--line);border-radius:14px;padding:16px 18px;font:inherit;font-size:16px;background:#fff}
.home-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0 10px}
.home-nav-card{display:block;text-decoration:none;border:1px solid var(--line);border-radius:18px;padding:22px 18px 20px;background:#fff;min-height:180px;position:relative}.home-nav-card:hover{border-color:#efad9f;transform:translateY(-2px)}
.home-nav-card .nav-no{position:absolute;right:16px;top:15px;font-size:10px;font-weight:900;color:var(--accent);letter-spacing:.12em}.home-nav-icon{width:62px;height:62px;border-radius:16px;background:var(--accent-pale);display:flex;align-items:center;justify-content:center;margin-bottom:18px}.home-nav-icon svg{width:36px;height:36px;stroke:var(--accent);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.home-nav-card h3{font-size:18px;margin:0 0 6px}.home-nav-card p{font-size:12px;color:var(--muted);margin:0;line-height:1.6}
.preview-list{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.preview-item{display:block;text-decoration:none;border:1px solid var(--line);border-radius:12px;padding:15px;background:#fff}
.preview-item small{color:var(--accent);font-weight:800}.preview-item strong{display:block;margin-top:4px}
.more-link{display:inline-flex;margin-top:15px;text-decoration:none;color:var(--accent);font-weight:800}
.directory-head{padding:28px 0 10px}.directory-head h1{font-size:clamp(36px,5vw,56px);margin:6px 0 10px}
.filter-input{width:100%;border:1px solid var(--line);border-radius:13px;padding:14px 16px;font:inherit;margin:14px 0 22px}
.directory-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}
.directory-card{display:block;text-decoration:none;border:1px solid var(--line);border-radius:13px;padding:17px;background:#fff}
.directory-card small{color:var(--muted)}.directory-card h2{font-size:18px;margin:7px 0}.directory-card p{font-size:13px;color:var(--muted);margin:0}


.about-intro{margin-top:54px;padding:34px 36px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff}
.about-intro-inner{max-width:860px}.about-intro h2{font-size:28px;margin:8px 0 12px}.about-intro p{line-height:1.9;color:var(--muted)}
.about-more{display:inline-flex;margin-top:8px;color:var(--accent);font-weight:800;text-decoration:none}
.about-page{max-width:860px;padding:42px 0 70px}.about-page h1{font-size:clamp(38px,5vw,58px);margin:8px 0 18px}.about-page h2{font-size:24px;margin:42px 0 12px;padding-top:18px;border-top:1px solid var(--line)}.about-page p{font-size:16px;line-height:2;margin:0 0 14px}.about-note{padding:20px 22px;border-radius:14px;background:var(--soft);margin-top:20px}
.footer-item a{color:inherit;text-decoration:none}.footer-item a:hover{color:var(--accent)}

@media(max-width:900px){.hero{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}.entry-grid{grid-template-columns:1fr}.entry{min-height:auto}.chips{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.home-intro .lead{white-space:normal}.home-nav{grid-template-columns:repeat(2,1fr)}.preview-list,.directory-grid{grid-template-columns:1fr}.qa-list{grid-template-columns:1fr}.wrap{padding:0 18px}.header-link{display:none}h1{font-size:40px}.grid,.chips,.footer-grid{grid-template-columns:1fr}.search-row{flex-direction:column}.search-button{padding:14px 18px}}
`;

function shell(title,body){
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}｜くすりとくらしの情報 Link</title><style>${css}</style></head>
<body><header><div class="wrap head"><a class="brand" href="/"><span class="logo-wrap">${iconSvg("link","brand-icon")}</span><span class="brand-copy"><strong>くすりとくらしの情報 <span style="color:var(--accent)">Link</span></strong><small>薬のこと、知りたいから探せます</small></span></a><a class="header-link" href="/about/">このサイトについて ↓</a></div></header>
<main class="wrap">${body}</main><footer><div class="wrap footer-grid">
<div class="footer-item"><strong><a href="/about/">このサイトについて</a></strong><span>運営目的と情報のまとめ方</span></div>
<div class="footer-item"><strong><a href="/evidence/">情報源・編集方針</a></strong><span>根拠資料や更新について</span></div>
<div class="footer-item"><strong><a href="/professionals/qa/">医療・介護職の方へ</a></strong><span>専門職向けQ&amp;Aを見る</span></div>
<div class="footer-item"><strong><a href="/about/#usage">ご利用にあたって</a></strong><span>医療情報としての注意事項</span></div>
</div></footer></body></html>`;
}


function homeAboutSection(){
 return `<section class="about-intro"><div class="about-intro-inner">
  <div class="kicker">ABOUT THIS SITE</div>
  <h2>このサイトについて</h2>
  <p>「くすりとくらしの情報 Link」は、保険薬局で勤務する薬剤師が、医薬品や薬物療法に関する情報を、できるだけわかりやすく伝えるためにまとめている情報サイトです。</p>
  <p>電子添文、公的機関の情報、診療ガイドライン、学術論文などを確認し、情報の根拠を大切にしています。</p>
  <a class="about-more" href="/about/">このサイトについて詳しく見る →</a>
 </div></section>`;
}

async function buildPreview(){
 await fs.rm(OUT,{recursive:true,force:true});
 await fs.mkdir(OUT,{recursive:true});
 await fs.writeFile(path.join(OUT,"index.html"),shell("トップ",`
 <section class="hero">
  <div><div class="kicker">患者さんの「知りたい」から探す</div><h1><span class="hero-line hero-line-1">薬のこと、</span><span class="hero-line hero-line-2">「知りたい」</span><span class="hero-line hero-line-3">から探せます</span></h1><p class="lead">薬の名前だけでなく、飲み忘れ、副作用、生活の中で気になることから情報を探せます。</p></div>
  <div class="entry-grid">
   <a class="entry" href="#drugs"><span class="num">01</span><span class="icon-ring">${iconSvg("pill")}</span><h3>薬から探す</h3><p>薬の名前が分かっている方はこちら</p><span class="arrow">→</span></a>
   <a class="entry" href="#troubles"><span class="num">02</span><span class="icon-ring">${iconSvg("bubble")}</span><h3>困りごとから探す</h3><p>今困っていることや不安なことから探す</p><span class="arrow">→</span></a>
   <a class="entry" href="#quick"><span class="num">03</span><span class="icon-ring">${iconSvg("book")}</span><h3>まず知っておきたい</h3><p>飲み方や注意点など、基本的な情報を見る</p><span class="arrow">→</span></a>
   <a class="entry" href="/qa/"><span class="num">04</span><span class="icon-ring">${iconSvg("bubble")}</span><h3>Q&amp;Aから探す</h3><p>患者さん・ご家族からのよくある質問を見る</p><span class="arrow">→</span></a>
  </div>
 </section>
 <section class="section section-divider two-col">
  <div id="drugs"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">薬から探す</h2></div><div class="grid"><div class="card"><span>骨粗しょう症の薬</span><h3>アレンドロン酸</h3><p>骨を壊す働きを抑え、骨折を防ぐために使われる薬。</p></div></div></div>
  <div id="troubles"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">こんなことで困っていませんか？</h2></div><div class="chips"><span class="chip"><span class="chip-icon">${iconSvg("clock","mini-icon")}</span><span>薬を飲み忘れた</span></span><span class="chip"><span class="chip-icon">${iconSvg("chest","mini-icon")}</span><span>胸やけがする</span></span><span class="chip"><span class="chip-icon">${iconSvg("tooth","mini-icon")}</span><span>歯医者に行く</span></span></div></div>
 </section>${homeAboutSection()}`));
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
 await fs.mkdir(path.join(OUT,"qa"),{recursive:true});
 await fs.mkdir(path.join(OUT,"professionals","qa"),{recursive:true});

 const [allDrugs,allTopics,allTroubles,allQuestions]=await Promise.all([
  queryAll(notion,IDS.drugs),queryAll(notion,IDS.topics),queryAll(notion,IDS.troubles),queryAll(notion,IDS.questions)
 ]);
 console.log(`[NOTION FETCH] 全件取得 薬剤=${allDrugs.length} / トピック=${allTopics.length} / 困りごと=${allTroubles.length} / 質問=${allQuestions.length}`);

 const drugRows=allDrugs.filter(d=>isPublishReady(d,`薬剤:${textValue(prop(d,"薬剤名"))||d.id}`));
 const topicRows=allTopics.filter(t=>isPublishReady(t,`トピック:${textValue(prop(t,"トピック名"))||t.id}`));
 const troubleRows=allTroubles.filter(t=>isPublishReady(t,`困りごと:${textValue(prop(t,"困りごと"))||t.id}`));

 const approvedQuestions=allQuestions.filter(isQuestionPublishReady);
 const generalQuestions=approvedQuestions.filter(q=>questionAudiences(q).includes("一般向け"));
 const professionalQuestions=approvedQuestions.filter(q=>questionAudiences(q).some(x=>PROFESSIONAL_AUDIENCES.has(x)));
 const approvedDrugs=[];
 for(const d of drugRows) if(await hasRequiredBrandEvidence(notion,d)) approvedDrugs.push(d);
 const approvedTopics=topicRows, approvedTroubles=troubleRows;

 const drugMap=new Map(approvedDrugs.map(x=>[x.id,x]));
 const topicMap=new Map(approvedTopics.map(x=>[x.id,x]));
 const troubleMap=new Map(approvedTroubles.map(x=>[x.id,x]));

 const drugCards=approvedDrugs.map(d=>{
  const name=textValue(prop(d,"薬剤名")),slug=textValue(prop(d,"slug")),lead=textValue(prop(d,"患者向け一言"));
  const indication=multiValue(prop(d,"主な適応")).join(" / ");
  return `<a class="card" href="/drugs/${esc(slug)}/"><div style="display:flex;align-items:center;gap:10px"><span class="chip-icon">${notionPageIcon(d,"pill","mini-icon")}</span><span>${esc(indication||"薬の情報")}</span></div><h3>${esc(name)}</h3><p>${esc(lead)}</p></a>`;
 }).join("");

 const troubleChips=approvedTroubles.slice(0,12).map(t=>{
  const slug=textValue(prop(t,"slug"));
  const title=textValue(prop(t,"困りごと"));
  const category=textValue(prop(t,"カテゴリ"));
  const fallback=iconForTrouble(category,title);
  return `<a class="chip" href="/troubles/${esc(slug)}/"><span class="chip-icon">${notionPageIcon(t,fallback,"mini-icon")}</span><span>${esc(title)}</span></a>`;
 }).join("");

 const quickTopics = approvedTopics
  .filter(t => ["服用方法","作用"].includes(textValue(prop(t,"カテゴリ"))))
  .slice(0,6)
  .map(t => {
    const slug = textValue(prop(t,"slug"));
    const category = textValue(prop(t,"カテゴリ"));
    const title = textValue(prop(t,"トピック名"));
    const summary = textValue(prop(t,"患者向け要約"));
    return `<a class="card" href="/topics/${esc(slug)}/"><div style="display:flex;align-items:center;gap:10px"><span class="chip-icon">${notionPageIcon(t,"book","mini-icon")}</span><span>${esc(category)}</span></div><h3>${esc(title)}</h3><p>${esc(summary)}</p></a>`;
  }).join("");

 await fs.writeFile(path.join(OUT,"index.html"),shell("トップ",`
 <section class="home-intro">
  <div class="kicker">患者さんの「知りたい」から探す</div>
  <h1><span class="hero-line hero-line-1">薬のこと、</span><span class="hero-line hero-line-2">「知りたい」</span><span class="hero-line hero-line-3">から探せます</span></h1>
  <p class="lead">トップページは必要な情報への入口。薬、困りごと、Q&amp;A、基本情報の一覧から探せる。</p>
  <div class="home-search"><input id="homeSearch" type="search" placeholder="このページの薬・困りごと・Q&Aを検索"></div>
 </section>
 <nav class="home-nav">
  <a class="home-nav-card" href="/drugs/"><span class="nav-no">01</span><span class="home-nav-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 33 33 15a8 8 0 0 1 0 12L27 33a8.5 8.5 0 0 1-12-12l6-6a8 8 0 0 1 12 0"/><path d="m18 30 12-12"/></svg></span><h3>薬から探す</h3><p>薬剤名の一覧・検索</p></a>
  <a class="home-nav-card" href="/troubles/"><span class="nav-no">02</span><span class="home-nav-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 13h24v18H22l-7 6v-6h-3z"/><path d="M24 18v6"/><path d="M24 27h.01"/></svg></span><h3>困りごとから探す</h3><p>症状や生活場面から</p></a>
  <a class="home-nav-card" href="/qa/"><span class="nav-no">03</span><span class="home-nav-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16"/><path d="M19 19a5.5 5.5 0 0 1 10 3c0 4-5 4-5 8"/><path d="M24 34h.01"/></svg></span><h3>Q&amp;Aから探す</h3><p>患者さん・ご家族の質問</p></a>
  <a class="home-nav-card" href="/topics/"><span class="nav-no">04</span><span class="home-nav-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 12h12a5 5 0 0 1 5 5v20a5 5 0 0 0-5-5H9z"/><path d="M39 12H27a5 5 0 0 0-5 5v20a5 5 0 0 1 5-5h12z"/></svg></span><h3>まず知っておきたい</h3><p>飲み方・注意点など</p></a>
 </nav>
 <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">薬から探す</h2></div>
  <div class="preview-list">${approvedDrugs.slice(0,6).map(d=>`<a class="preview-item searchable" data-search="${esc(textValue(prop(d,"薬剤名")))}" href="/drugs/${esc(textValue(prop(d,"slug")))}/"><small>薬の情報</small><strong>${esc(textValue(prop(d,"薬剤名")))}</strong></a>`).join("")||"<p>現在、公開中の薬はない。</p>"}</div><a class="more-link" href="/drugs/">薬をすべて見る →</a></section>
 <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">よくある困りごと</h2></div>
  <div class="preview-list">${approvedTroubles.slice(0,6).map(t=>`<a class="preview-item searchable" data-search="${esc(textValue(prop(t,"困りごと")))}" href="/troubles/${esc(textValue(prop(t,"slug")))}/"><small>${esc(textValue(prop(t,"カテゴリ"))||"困りごと")}</small><strong>${esc(textValue(prop(t,"困りごと")))}</strong></a>`).join("")||"<p>現在、公開中の困りごとはない。</p>"}</div><a class="more-link" href="/troubles/">困りごとをすべて見る →</a></section>
 <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">最近のQ&amp;A</h2></div>
  <div class="preview-list">${generalQuestions.slice(0,3).map(q=>`<a class="preview-item searchable" data-search="${esc(textValue(prop(q,"質問")))}" href="/qa/${esc(questionSlug(q))}/"><small>Q&amp;A</small><strong>Q. ${esc(textValue(prop(q,"質問")))}</strong></a>`).join("")||"<p>現在、公開中のQ&Aはない。</p>"}</div><a class="more-link" href="/qa/">Q&amp;Aをすべて見る →</a></section>
 <script>(()=>{const i=document.getElementById("homeSearch");if(i)i.addEventListener("input",()=>{const q=i.value.trim().toLowerCase();document.querySelectorAll(".searchable").forEach(el=>{el.style.display=!q||(el.dataset.search||"").toLowerCase().includes(q)?"":"none";});});})();</script>
 ${homeAboutSection()}`));

 const filterScript=`<script>(()=>{const i=document.getElementById("filter");if(i)i.addEventListener("input",()=>{const q=i.value.trim().toLowerCase();document.querySelectorAll("[data-filter]").forEach(el=>{el.style.display=!q||(el.dataset.filter||"").toLowerCase().includes(q)?"":"none";});});})();</script>`;

 await fs.writeFile(path.join(OUT,"drugs","index.html"),shell("薬から探す",`
  <section class="directory-head"><div class="kicker">DRUG DIRECTORY</div><h1>薬から探す</h1><p class="lead">薬剤名から情報を探せる。</p></section>
  <input id="filter" class="filter-input" type="search" placeholder="薬剤名を入力">
  <div class="directory-grid">${approvedDrugs.map(d=>`<a class="directory-card" data-filter="${esc(textValue(prop(d,"薬剤名")))}" href="/drugs/${esc(textValue(prop(d,"slug")))}/"><small>薬の情報</small><h2>${esc(textValue(prop(d,"薬剤名")))}</h2><p>${esc(textValue(prop(d,"患者向け一言")))}</p></a>`).join("")||"<p>現在、公開中の薬はない。</p>"}</div>${filterScript}
 `));
 await fs.writeFile(path.join(OUT,"troubles","index.html"),shell("困りごとから探す",`
  <section class="directory-head"><div class="kicker">TROUBLE DIRECTORY</div><h1>困りごとから探す</h1><p class="lead">症状や生活の場面から関連情報を探せる。</p></section>
  <input id="filter" class="filter-input" type="search" placeholder="困りごとを入力">
  <div class="directory-grid">${approvedTroubles.map(t=>`<a class="directory-card" data-filter="${esc(textValue(prop(t,"困りごと"))+" "+textValue(prop(t,"カテゴリ")))}" href="/troubles/${esc(textValue(prop(t,"slug")))}/"><small>${esc(textValue(prop(t,"カテゴリ"))||"困りごと")}</small><h2>${esc(textValue(prop(t,"困りごと")))}</h2><p>${esc(textValue(prop(t,"短い回答")))}</p></a>`).join("")||"<p>現在、公開中の困りごとはない。</p>"}</div>${filterScript}
 `));
 await fs.writeFile(path.join(OUT,"topics","index.html"),shell("まず知っておきたい",`
  <section class="directory-head"><div class="kicker">TOPICS</div><h1>まず知っておきたい</h1><p class="lead">飲み方、作用、注意点などの基本情報。</p></section>
  <input id="filter" class="filter-input" type="search" placeholder="トピックを入力">
  <div class="directory-grid">${approvedTopics.map(t=>`<a class="directory-card" data-filter="${esc(textValue(prop(t,"トピック名"))+" "+textValue(prop(t,"カテゴリ")))}" href="/topics/${esc(textValue(prop(t,"slug")))}/"><small>${esc(textValue(prop(t,"カテゴリ"))||"トピック")}</small><h2>${esc(textValue(prop(t,"トピック名")))}</h2><p>${esc(textValue(prop(t,"患者向け要約")))}</p></a>`).join("")||"<p>現在、公開中のトピックはない。</p>"}</div>${filterScript}
 `));

 for(const d of approvedDrugs){
  const name=textValue(prop(d,"薬剤名")),slug=textValue(prop(d,"slug")),lead=textValue(prop(d,"患者向け一言")),reviewDate=textValue(prop(d,"最終レビュー"));
  const topicCards=relationIds(prop(d,"トピック")).map(id=>topicMap.get(id)).filter(Boolean).map(t=>`<a class="card" href="/topics/${esc(textValue(prop(t,"slug")))}/"><span>${esc(textValue(prop(t,"カテゴリ")))}</span><h3>${esc(textValue(prop(t,"トピック名")))}</h3><p>${esc(textValue(prop(t,"患者向け要約")))}</p></a>`).join("");
  const troubleCards=relationIds(prop(d,"困りごと")).map(id=>troubleMap.get(id)).filter(Boolean).map(t=>{
    const category=textValue(prop(t,"カテゴリ"));
    const title=textValue(prop(t,"困りごと"));
    const fallback=iconForTrouble(category,title);
    return `<a class="card" href="/troubles/${esc(textValue(prop(t,"slug")))}/"><div style="display:flex;align-items:center;gap:10px"><span class="chip-icon">${notionPageIcon(t,fallback,"mini-icon")}</span><span>${esc(category)}</span></div><h3>${esc(title)}</h3><p>${esc(textValue(prop(t,"短い回答")))}</p></a>`;
  }).join("");
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


 await fs.writeFile(path.join(OUT,"qa","index.html"),shell("一般向け Q&A",`
  <section class="qa-hero"><div class="kicker">Q&A｜一般の方へ</div><h1>薬の疑問を、<br><span class="accent">質問から探す。</span></h1>
  <p class="lead">患者さん・ご家族から寄せられる質問を、分かりやすい言葉でまとめている。</p>
  <div class="audience-switch"><a class="audience-tab active" href="/qa/">一般の方・ご家族</a><a class="audience-tab" href="/professionals/qa/">医療・介護職の方</a></div></section>
  <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">Q&A一覧</h2></div>
  <div class="qa-list">${generalQuestions.map(q=>qaCard(q,"/qa/")).join("")||"<p>現在、公開中のQ&Aはない。</p>"}</div></section>`));

 await fs.writeFile(path.join(OUT,"professionals","qa","index.html"),shell("医療・介護職向け Q&A",`
  <section class="qa-hero"><div class="kicker">Q&A｜医療・介護職の方へ</div><h1>現場の疑問を、<br><span class="accent">根拠とともに確認する。</span></h1>
  <p class="lead">必要な情報量に合わせて、薬剤師向け・医療者向け・介護職向けに切り替えて確認できる。</p>
  <div class="audience-switch"><a class="audience-tab" href="/qa/">一般の方・ご家族</a><a class="audience-tab active" href="/professionals/qa/">医療・介護職の方</a></div>
  <div class="audience-switch profession-filter" role="group" aria-label="職種別表示"><button class="audience-tab active" data-filter-audience="all">すべて</button><button class="audience-tab" data-filter-audience="薬剤師向け">薬剤師向け</button><button class="audience-tab" data-filter-audience="医療者向け">医療者向け</button><button class="audience-tab" data-filter-audience="介護職向け">介護職向け</button></div></section>
  <section class="section section-divider"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">専門職Q&A</h2></div>
  <div class="qa-list">${professionalQuestions.map(q=>qaCard(q,"/professionals/qa/")).join("")||"<p>現在、公開中のQ&Aはない。</p>"}</div></section>
  <script>(()=>{const buttons=[...document.querySelectorAll("[data-filter-audience]")],cards=[...document.querySelectorAll(".qa-card[data-audiences]")];buttons.forEach(b=>b.addEventListener("click",()=>{buttons.forEach(x=>x.classList.remove("active"));b.classList.add("active");const f=b.dataset.filterAudience;cards.forEach(c=>{c.style.display=f==="all"||(c.dataset.audiences||"").includes(f)?"":"none";});}));})();</script>`));

 for(const q of generalQuestions){
  const slug=questionSlug(q),question=textValue(prop(q,"質問")),answer=textValue(prop(q,"回答案"));
  const category=textValue(prop(q,"質問カテゴリ")),audiences=questionAudiences(q);
  const blocks=await fetchAllBlocks(notion,q.id);
  const bodyHtml=renderQuestionBlocks(blocks);
  const dir=path.join(OUT,"qa",slug);await fs.mkdir(dir,{recursive:true});
  const drugs=relationIds(prop(q,"関連薬剤")).map(id=>drugMap.get(id)).filter(Boolean).map(d=>`<a class="related-link" href="/drugs/${esc(textValue(prop(d,"slug")))}/">${esc(textValue(prop(d,"薬剤名")))}</a>`).join("");
  const topics=relationIds(prop(q,"関連トピック")).map(id=>topicMap.get(id)).filter(Boolean).map(t=>`<a class="related-link" href="/topics/${esc(textValue(prop(t,"slug")))}/">${esc(textValue(prop(t,"トピック名")))}</a>`).join("");
  await fs.writeFile(path.join(dir,"index.html"),shell(question,`<article class="qa-detail"><div class="qa-meta" style="margin-top:25px"><span>${esc(category||"その他")}</span>${audiences.map(x=>`<span>${esc(x)}</span>`).join("")}</div>
  <div class="qa-question-box"><span class="qa-letter">Q</span><h1>${esc(question)}</h1></div>
  <div class="qa-answer-box"><span class="qa-answer-letter">A</span><p>${esc(answer)}</p></div>
  ${bodyHtml?`<section class="qa-body">${bodyHtml}</section>`:""}
  ${questionPdfUrl(q)?`<div class="qa-pdf"><strong>簡潔にまとめた資料</strong><br><a href="${esc(questionPdfUrl(q))}" target="_blank" rel="noopener noreferrer">PDFを開く →</a></div>`:""}
  ${(drugs||topics)?`<section class="section"><h2>関連する情報</h2><div class="related-row">${drugs}${topics}</div></section>`:""}
  <p class="ref section">一般的な情報を示すもの。個別の判断は処方医・薬剤師などへ確認する。</p></article>`));
 }

 for(const q of professionalQuestions){
  const slug=questionSlug(q),question=textValue(prop(q,"質問")),answer=textValue(prop(q,"回答案"));
  const category=textValue(prop(q,"質問カテゴリ")),audiences=questionAudiences(q);
  const blocks=await fetchAllBlocks(notion,q.id);
  const bodyHtml=renderQuestionBlocks(blocks);
  const dir=path.join(OUT,"professionals","qa",slug);await fs.mkdir(dir,{recursive:true});
  const drugs=relationIds(prop(q,"関連薬剤")).map(id=>drugMap.get(id)).filter(Boolean).map(d=>`<a class="related-link" href="/drugs/${esc(textValue(prop(d,"slug")))}/">${esc(textValue(prop(d,"薬剤名")))}</a>`).join("");
  const topics=relationIds(prop(q,"関連トピック")).map(id=>topicMap.get(id)).filter(Boolean).map(t=>`<a class="related-link" href="/topics/${esc(textValue(prop(t,"slug")))}/">${esc(textValue(prop(t,"トピック名")))}</a>`).join("");
  await fs.writeFile(path.join(dir,"index.html"),shell(question,`<article class="qa-detail"><div class="qa-meta" style="margin-top:25px"><span>${esc(category||"その他")}</span>${audiences.map(x=>`<span>${esc(x)}</span>`).join("")}</div>
  <div class="qa-question-box"><span class="qa-letter">Q</span><h1>${esc(question)}</h1></div>
  <div class="qa-answer-box"><span class="qa-answer-letter">A</span><p>${esc(answer)}</p></div>
  ${bodyHtml?`<section class="qa-body">${bodyHtml}</section>`:""}
  ${questionPdfUrl(q)?`<div class="qa-pdf"><strong>簡潔にまとめた資料</strong><br><a href="${esc(questionPdfUrl(q))}" target="_blank" rel="noopener noreferrer">PDFを開く →</a></div>`:""}
  ${(drugs||topics)?`<section class="section"><h2>関連する薬剤・トピック</h2><div class="related-row">${drugs}${topics}</div></section>`:""}</article>`));
 }

 await fs.writeFile(path.join(OUT,"about","index.html"),shell("このサイトについて",`<article class="about-page">
  <div class="kicker">ABOUT THIS SITE</div><h1>このサイトについて</h1>
  <p>「くすりとくらしの情報 Link」は、保険薬局で勤務する薬剤師が、医薬品や薬物療法に関する情報を、できるだけわかりやすく伝えるためにまとめている情報サイトです。</p>
  <p>患者さんやご家族が「この薬は何の薬？」「どうやって飲めばいい？」「こんなときはどうしたらいい？」と思ったときに、必要な情報へたどり着けることを目指しています。</p>
  <p>また、薬剤師をはじめとする医療・介護に携わる方が、日々の業務で生じた疑問を確認できる情報も掲載しています。</p>
  <h2>情報をまとめるときに大切にしていること</h2>
  <p>掲載内容を作成する際には、電子添文、インタビューフォーム、公的機関の情報、診療ガイドライン、学術論文などを確認し、可能な限り情報の根拠を示すようにしています。</p>
  <p>医薬品に関する情報は更新されることがあります。そのため、掲載後も必要に応じて内容を見直します。</p>
  <p><a class="about-more" href="/evidence/">情報源・編集方針を見る →</a></p>
  <h2 id="usage">ご利用にあたって</h2>
  <div class="about-note"><p>このサイトは、一般的な医薬品・薬物療法に関する情報を提供することを目的としています。</p>
  <p>個々の患者さんの診断や治療方針を決定したり、薬の開始・中止・変更を指示したりするものではありません。</p>
  <p>薬の使用について疑問や心配がある場合は、医師・薬剤師などの医療専門職にご相談ください。</p></div>
 </article>`));
 await fs.writeFile(path.join(OUT,"evidence","index.html"),shell("情報源・編集方針",`<article class="about-page">
  <div class="kicker">EDITORIAL POLICY</div><h1>情報源・編集方針</h1>
  <p>医薬品情報を掲載する際は、情報の出所と更新性を確認することを大切にしています。</p>
  <h2>主に確認する情報源</h2>
  <p>電子添文、インタビューフォーム、厚生労働省やPMDAなど公的機関が公表する情報、診療ガイドライン、学術論文などを確認します。内容に応じて複数の資料を照合します。</p>
  <h2>わかりやすさと正確さ</h2>
  <p>患者さん・ご家族向けの情報では、専門用語をできるだけ避けながら、医薬品情報として重要な条件や注意点が失われない表現を心がけています。専門職向けQ&amp;Aでは、実務で確認しやすいよう根拠や判断のポイントをより詳しく示します。</p>
  <h2>更新について</h2>
  <p>医薬品情報や診療上の推奨は更新されることがあります。新しい情報が確認された場合や、掲載内容の見直しが必要と判断した場合には、内容を更新します。</p>
 </article>`));
 await fs.writeFile(path.join(OUT,"professionals","index.html"),shell("医療・介護職の方へ",`<section class="hero" style="grid-template-columns:1fr"><div><div class="kicker">For Professionals</div><h1>医療・介護職の方へ</h1><p class="lead">患者向け情報と同じ根拠から、専門職向け要点を展開する。</p></div></section>`));
 console.log(`Built drugs=${approvedDrugs.length}, topics=${approvedTopics.length}, troubles=${approvedTroubles.length}`);
}

async function main(){
 if(PREVIEW_MODE){console.warn(`Preview mode: missing ${MISSING_ENV.join(", ")}`);return buildPreview();}
 return buildFromNotion();
}
main().catch(err=>{console.error(err);process.exit(1);});
