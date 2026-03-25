#!/usr/bin/env node
import { google } from "googleapis";
import { parseStringPromise } from "xml2js";

const SPREADSHEET_ID = "1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI";
const SHEET_NAME = "news";
const MAX_ITEMS_PER_COMPANY = 5;

const SOURCES = [
  { id: "mitsui", name: "三井不動産", type: "rss2", url: "https://www.mitsuifudosan.co.jp/corporate/ir/rss/irnews_rss.xml" }, { id: "mitsui", name: "三井不動産", type: "prtimes", url: "https://prtimes.jp/companyrdf.php?company_id=51782" },
  { id: "mitsubishi", name: "三菱地所", type: "prtimes", url: "https://prtimes.jp/companyrdf.php?company_id=16002" },
  { id: "sumitomo", name: "住友不動産", type: "rss2", url: "https://www.sumitomo-rd.co.jp/news/feed/" },
  { id: "tokyo", name: "東京建物", type: "irpocket", url: "https://xml.irpocket.com/8804/XML/release-allrenw-latest-10.rdf", fallback: { type: "rss2", companyId: "22762" } },
  { id: "nomura", name: "野村不動産HD", type: "prtimes", url: "https://prtimes.jp/companyrdf.php?company_id=25694" },
  { id: "tokyu", name: "東急不動産HD", type: "irpocket", url: "https://xml.irpocket.com/3289/XML/release-all-latest-12m.rdf" },
];

const CATEGORY_KEYWORDS = {
  決算: ["決算", "業績", "財務", "収益", "純利益", "売上"],
  着工: ["着工", "起工", "工事開始", "建設着手"],
  竣工: ["竣工", "完成", "完工", "建設完了"],
  開業: ["開業", "オープン", "グランドオープン", "開館", "開店", "開設"],
  資金調達: ["資金調達", "増資", "社債", "借入", "融資", "ファイナンス"],
  提携: ["提携", "協定", "合意", "アライアンス", "パートナー", "連携"],
};

const BADGE_MAP = { 決算: "red", 着工: "yellow", 竣工: "green", 開業: "blue", 資金調達: "purple", 提携: "teal", その他: "gray" };

function detectCategory(title) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => title.includes(kw))) return { category, badge: BADGE_MAP[category] };
  }
  return { category: "その他", badge: "gray" };
}

function normalizeDate(rawDate) {
  if (!rawDate) return new Date().toISOString().split("T")[0];
  try {
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
  } catch { return new Date().toISOString().split("T")[0]; }
}

async function fetchXml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; deveryman-ir-bot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseStringPromise(await res.text(), { explicitArray: false, ignoreAttrs: false });
}

function parseRss2(xml, source) {
  const items = xml?.rss?.channel?.item;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items]).map((item) => {
    const title = item.title?._?.trim() ?? item.title?.trim() ?? "";
    const url = item.link?._?.trim() ?? item.link?.trim() ?? "";
    const { category, badge } = detectCategory(title);
    return { date: normalizeDate(item.pubDate ?? item["dc:date"]), company: source.name, companyId: source.id, category, badge, title, url };
  });
}

function parsePrtimesRdf(xml, source) {
  const rdfRoot = xml?.["rdf:RDF"] ?? xml?.RDF;
  const items = rdfRoot?.item;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items]).map((item) => {
    const title = item["title"]?._?.trim() ?? item["title"]?.trim() ?? "";
    const url = item["link"]?._?.trim() ?? item["link"]?.trim() ?? item["$"]?.["rdf:about"] ?? "";
    const { category, badge } = detectCategory(title);
    return { date: normalizeDate(item["dc:date"] ?? item["pubDate"]), company: source.name, companyId: source.id, category, badge, title, url };
  });
}

function parseIrpocketRdf(xml, source) {
  const rdf = xml?.["rdf:RDF"] ?? xml?.RDF ?? xml;
  const items = rdf?.item;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items]).map((item) => {
    const title = item["title"]?._?.trim() ?? item["title"]?.trim() ?? "";
    const url = item["link"]?._?.trim() ?? item["link"]?.trim() ?? item["$"]?.["rdf:about"] ?? "";
    const { category, badge } = detectCategory(title);
    return { date: normalizeDate(item["dc:date"] ?? item["pubDate"]), company: source.name, companyId: source.id, category, badge, title, url };
  });
}

async function fetchSourceNews(source) {
  const tryFetch = async (url, type) => {
    const xml = await fetchXml(url);
    if (type === "rss2") return parseRss2(xml, source);
    if (type === "prtimes") return parsePrtimesRdf(xml, source);
    if (type === "irpocket") return parseIrpocketRdf(xml, source);
    throw new Error(`Unknown type: ${type}`);
  };
  try {
    const results = await tryFetch(source.url, source.type);
    if (results.length > 0) { console.log(`  ✅ ${source.name}: ${results.length}件取得`); return results; }
    throw new Error("Empty results");
  } catch (err) {
    console.warn(`  ⚠️  ${source.name}: ${err.message}`);
    if (source.fallback?.type === "prtimes") {
      try {
        const results = await tryFetch(`https://prtimes.jp/rss/company/${source.fallback.companyId}/release.rdf`, "prtimes");
        console.log(`  ✅ ${source.name} (fallback): ${results.length}件取得`);
        return results;
      } catch (e) { console.error(`  ❌ ${source.name} fallback失敗: ${e.message}`); }
    }
    return [];
  }
}

async function getAuthClient() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません");
  let credentials;
  try { credentials = JSON.parse(Buffer.from(credJson, "base64").toString("utf-8")); }
  catch { credentials = JSON.parse(credJson); }
  return new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}

async function main() {
  console.log("🏢 deveryman-ir ニュースフェッチャー\n");
  const results = await Promise.allSettled(SOURCES.map(fetchSourceNews));
  const allNews = results.flatMap((r) => r.status === "fulfilled" ? r.value : [])
    .filter((item) => {
    const d = new Date(item.date);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);
    const excludeKeywords = ["フェア", "支店", "受賞", "イベント", "CO2", "開催", "ポップアップ", "キャンペーン", "セミナー", "展示", "説明会", "募集", "採用", "インターン", "表彰", "店舗移転", "ボンド", "調達", "優良法人", "女性活躍", "５つ星", "期間限定", "ネイチャー", "推進企業", "防災"];
    const isExcluded = excludeKeywords.some(kw => item.title.includes(kw));
    return item.title && item.url && d >= cutoff && !isExcluded;
  })
    .sort((a, b) => b.date.localeCompare(a.date));
  console.log(`\n📊 合計 ${allNews.length} 件取得`);
  if (allNews.length === 0) { console.warn("⚠️ 0件のため終了"); process.exit(1); }

  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:G` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A1`, valueInputOption: "RAW",
    requestBody: { values: [["date","company","companyId","category","badge","title","url"], ...allNews.map(i => [i.date,i.company,i.companyId,i.category,i.badge,i.title,i.url])] },
  });
  console.log(`✅ ${allNews.length}件をSheetに書き込みました\n✨ 完了！`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
