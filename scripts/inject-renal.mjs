import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public");
const THERAPEUTIC_AREAS_ID = process.env.NOTION_THERAPEUTIC_AREAS_DATA_SOURCE_ID || "c78a2d0d-cc9d-831f-b742-07ea870d2264";
const notion = new Client({ auth: process.env.NOTION_API_KEY });

const esc = (s = "") => String(s)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function prop(page, name) {
  return page.properties?.[name];
}

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
  const p = prop(page, name);
  if (p?.type !== "files") return [];
  return (p.files || []).map((file, index) => ({
    name: file.name || `${name}-${index + 1}`,
    url: file.type === "external" ? file.external?.url : file.file?.url,
  })).filter(file => file.url);
}

function fileExtension(name, url, contentType = "") {
  const fromName = String(name || "").match(/\.(avif|gif|jpe?g|png|svg|webp|pdf)$/i)?.[1];
  if (fromName) return fromName.toLowerCase().replace("jpeg", "jpg");
  try {
    const fromUrl = new URL(url).pathname.match(/\.(avif|gif|jpe?g|png|svg|webp|pdf)$/i)?.[1];
    if (fromUrl) return fromUrl.toLowerCase().replace("jpeg", "jpg");
  } catch {}
  const byType = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return byType[contentType.split(";")[0].toLowerCase()] || "";
}

async function queryAll(dataSourceId) {
  const out = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

async function downloadRenalFiles(page, slug) {
  const files = notionFiles(page, "腎機能");
  if (!files.length) return [];

  const assetDir = path.join(OUT, "assets", "clinical", "therapeutic-areas", slug);
  await fs.mkdir(assetDir, { recursive: true });

  const downloaded = [];
  for (const [index, file] of files.entries()) {
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      const ext = fileExtension(file.name, file.url, contentType);
      if (!ext) {
        console.warn(`[RENAL] 対応していないファイルをスキップしました (${file.name})`);
        continue;
      }
      const fileName = `renal-${index + 1}.${ext}`;
      await fs.writeFile(path.join(assetDir, fileName), Buffer.from(await response.arrayBuffer()));
      downloaded.push({
        src: `/assets/clinical/therapeutic-areas/${slug}/${fileName}`,
        name: file.name,
        type: ext === "pdf" ? "pdf" : "image",
      });
    } catch (error) {
      console.warn(`[RENAL] ${file.name}を取得できませんでした: ${error?.message || error}`);
    }
  }
  return downloaded;
}

function renalSection(files) {
  if (!files.length) return "";
  const body = files.map((file, index) => {
    if (file.type === "pdf") {
      return `<div class="renal-pdf" style="margin:18px 0 8px"><object data="${esc(file.src)}" type="application/pdf" style="display:block;width:100%;height:min(78vh,820px);border:1px solid var(--line,#e5e7eb);border-radius:14px;background:#fff"><p>PDFを表示できません。<a href="${esc(file.src)}" target="_blank" rel="noopener">PDFを開く</a></p></object><p style="margin:10px 0 0"><a class="more-link" href="${esc(file.src)}" target="_blank" rel="noopener">PDFを開く →</a></p></div>`;
    }
    return `<figure><img src="${esc(file.src)}" alt="${esc(`腎機能の図解${files.length > 1 ? ` ${index + 1}` : ""}`)}" loading="lazy"></figure>`;
  }).join("");

  return `<section class="clinical-figure-section"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">腎機能</h2></div>\n   <div class="clinical-figures">${body}</div></section>`;
}

async function main() {
  if (!process.env.NOTION_API_KEY) {
    console.warn("[RENAL] NOTION_API_KEY がないため腎機能セクションの追加をスキップします。");
    return;
  }

  const areas = await queryAll(THERAPEUTIC_AREAS_ID);
  let updated = 0;

  for (const area of areas) {
    const name = textValue(prop(area, "名前"));
    if (!name) continue;

    const slug = slugifyClass(name);
    const htmlPath = path.join(OUT, "professionals", "therapeutic-areas", slug, "index.html");

    try {
      await fs.access(htmlPath);
    } catch {
      continue;
    }

    const files = await downloadRenalFiles(area, slug);
    if (!files.length) continue;

    let html = await fs.readFile(htmlPath, "utf8");
    if (html.includes('<h2 class="section-title">腎機能</h2>')) continue;

    const section = renalSection(files);
    const adrMarker = '<section class="clinical-figure-section"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">ADR（よくある＋要注意）</h2>';
    const classesMarker = '<section class="class-section"><div class="section-head"><span class="section-bar"></span><h2 class="section-title">関連する薬剤クラス</h2>';

    if (html.includes(adrMarker)) {
      html = html.replace(adrMarker, `${section}\n   ${adrMarker}`);
    } else if (html.includes(classesMarker)) {
      html = html.replace(classesMarker, `${section}\n   ${classesMarker}`);
    } else {
      console.warn(`[RENAL] ${name}: 挿入位置を特定できませんでした。`);
      continue;
    }

    await fs.writeFile(htmlPath, html);
    updated += 1;
    console.log(`[RENAL] ${name}: 腎機能セクションを追加しました (${files.length}ファイル)`);
  }

  console.log(`[RENAL] 更新ページ数=${updated}`);
}

main().catch(error => {
  console.error("[RENAL]", error);
  process.exit(1);
});
