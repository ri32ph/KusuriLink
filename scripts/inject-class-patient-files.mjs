import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public");
const DATA_SOURCE_ID = process.env.NOTION_CLINICAL_DRUG_CLASSES_DATA_SOURCE_ID || "e39a2d0d-cc9d-82e5-ad0c-87c7d420b3e3";
const PROPERTY_NAME = "患者・介護者向け資料";
const notion = new Client({ auth: process.env.NOTION_API_KEY });

const esc = (s = "") => String(s)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function textValue(p) {
  if (!p) return "";
  if (p.type === "title") return (p.title || []).map(x => x.plain_text).join("");
  if (p.type === "rich_text") return (p.rich_text || []).map(x => x.plain_text).join("");
  return "";
}

function slugifyClass(name) {
  return String(name || "").normalize("NFKC").trim()
    .replace(/[\\/／]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[?#%&+]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "class";
}

function notionFiles(page, name) {
  const p = page.properties?.[name];
  if (p?.type !== "files") return [];
  return (p.files || []).map((file, index) => ({
    name: file.name || `${name}-${index + 1}`,
    url: file.type === "external" ? file.external?.url : file.file?.url
  })).filter(file => file.url);
}

function extensionFrom(name, url, contentType = "") {
  const fromName = String(name || "").match(/\.([a-z0-9]{2,8})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  try {
    const fromUrl = new URL(url).pathname.match(/\.([a-z0-9]{2,8})$/i)?.[1];
    if (fromUrl) return fromUrl.toLowerCase();
  } catch {}
  const byType = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };
  return byType[contentType.split(";")[0].toLowerCase()] || "bin";
}

function isImage(ext) {
  return ["avif", "gif", "jpg", "jpeg", "png", "svg", "webp"].includes(ext);
}

async function queryAll() {
  const rows = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: cursor
    });
    rows.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function downloadFiles(page, slug) {
  const files = notionFiles(page, PROPERTY_NAME);
  if (!files.length) return [];

  const assetDir = path.join(OUT, "assets", "clinical", "drug-classes", slug, "patient-materials");
  await fs.mkdir(assetDir, { recursive: true });

  const downloaded = [];
  for (const [index, file] of files.entries()) {
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      const ext = extensionFrom(file.name, file.url, contentType);
      const fileName = `material-${index + 1}.${ext}`;
      await fs.writeFile(path.join(assetDir, fileName), Buffer.from(await response.arrayBuffer()));
      downloaded.push({
        name: file.name,
        href: `/assets/clinical/drug-classes/${encodeURIComponent(slug)}/patient-materials/${fileName}`,
        ext
      });
    } catch (error) {
      console.warn(`[PATIENT MATERIAL] ${file.name} を取得できませんでした: ${error?.message || error}`);
    }
  }
  return downloaded;
}

function renderSection(files) {
  if (!files.length) return "";
  const items = files.map(file => {
    if (isImage(file.ext)) {
      return `<figure class="patient-material"><a href="${esc(file.href)}" target="_blank" rel="noopener noreferrer"><img src="${esc(file.href)}" alt="${esc(file.name)}" loading="lazy"></a><figcaption>${esc(file.name)}</figcaption></figure>`;
    }
    return `<a class="related-link patient-material-link" href="${esc(file.href)}" target="_blank" rel="noopener noreferrer">${esc(file.name)} を開く →</a>`;
  }).join("");

  return `<section class="clinical-figure-section patient-material-section"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">患者・介護者向け資料</h2></div><div class="patient-materials">${items}</div></section>`;
}

async function injectIntoPage(slug, section) {
  const htmlPath = path.join(OUT, "professionals", "drug-classes", slug, "index.html");
  let html;
  try {
    html = await fs.readFile(htmlPath, "utf8");
  } catch {
    console.warn(`[PATIENT MATERIAL] 対象ページが見つかりません: ${slug}`);
    return false;
  }

  const marker = '<section class="notice"><strong>臨床で使用するときの注意</strong>';
  if (!html.includes(marker)) {
    console.warn(`[PATIENT MATERIAL] 挿入位置が見つかりません: ${slug}`);
    return false;
  }

  html = html.replace(marker, `${section}${marker}`);

  const style = `<style>
.patient-materials{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:18px}
.patient-material{margin:0;padding:14px;border:1px solid #e8e8e8;border-radius:14px;background:#fff}
.patient-material img{display:block;width:100%;height:auto;border-radius:10px}
.patient-material figcaption{margin-top:10px;font-size:.9rem;color:#666;line-height:1.5;word-break:break-word}
.patient-material-link{display:block;padding:16px;border:1px solid #e8e8e8;border-radius:12px;background:#fff}
@media(max-width:640px){.patient-materials{grid-template-columns:1fr}.patient-material{padding:10px}}
</style>`;
  html = html.replace("</head>", `${style}</head>`);
  await fs.writeFile(htmlPath, html);
  return true;
}

async function main() {
  if (!process.env.NOTION_API_KEY) {
    console.warn("[PATIENT MATERIAL] NOTION_API_KEY がないため処理をスキップします");
    return;
  }

  const pages = await queryAll();
  let count = 0;
  for (const page of pages) {
    if (page.properties?.Web公開?.type === "checkbox" && !page.properties.Web公開.checkbox) continue;
    const name = textValue(page.properties?.薬効群);
    if (!name) continue;
    const slug = slugifyClass(name);
    const files = await downloadFiles(page, slug);
    if (!files.length) continue;
    const ok = await injectIntoPage(slug, renderSection(files));
    if (ok) count += 1;
  }
  console.log(`[PATIENT MATERIAL] ${count}ページに資料を追加しました`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
