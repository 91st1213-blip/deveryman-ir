const SHEET_ID = "1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI";
const SHEET_NAME = "projects";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

const COMPANY_META: Record<string, { name: string; color: string }> = {
  mitsui:         { name: "三井不動産",   color: "#4a90d9" },
  mitsubishi:     { name: "三菱地所",     color: "#e85555" },
  sumitomo:       { name: "住友不動産",   color: "#3aaa5c" },
  nomura:         { name: "野村不動産HD", color: "#6a6adc" },
  tokyu:          { name: "東急不動産HD", color: "#28b0b0" },
  tokyo_tatemono: { name: "東京建物",     color: "#d4813a" },
  other:          { name: "その他",       color: "#94a3b8" },
};

function normalizeStatus(raw: string): string {
  const map: Record<string, string> = {
    "計画": "計画中", "着工": "着工済",
    "建設中": "進行中", "竣工": "完成", "開業": "完成",
  };
  return map[raw.trim()] ?? raw.trim();
}

function formatCompletion(completionDate: string, openDate: string): string {
  const d = openDate || completionDate;
  if (!d || d === "—") return "—";
  const [year, month] = d.split("-");
  if (!year || year === "0000") return "—";
  const y = year.slice(2);
  if (!month || month === "00") return `${y}年度`;
  return `${y}年${parseInt(month)}月`;
}

export interface Project {
  id: string;
  company: string;
  companyId: string;
  color: string;
  status: string;
  name: string;
  area: string;
  scale: string;
  usage: string;
  completion: string;
  irLink: string;
  notes: string;
  location: { lat: number; lng: number } | null;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.split("\n").filter(l => l.trim());
    const projects: Project[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const [id, companyId, name, area, category, scale, status, , completionDate, openDate, irLink, notes, latStr, lngStr] = cols;
      if (!id || !name) continue;
      const meta = COMPANY_META[companyId] ?? COMPANY_META["other"];
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      projects.push({
        id, company: meta.name, companyId, color: meta.color,
        status: normalizeStatus(status), name, area,
        scale: scale || "—", usage: category || "複合",
        completion: formatCompletion(completionDate, openDate),
        irLink: irLink || "#", notes: notes || "",
        location: (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null,
      });
    }
    return projects;
  } catch (e) {
    console.warn("[fetchProjects] Sheets fetch failed, using fallback:", e);
    return getFallbackProjects();
  }
}

function getFallbackProjects(): Project[] {
  return [
    { id: "fb01", company: "三井不動産",   companyId: "mitsui",         color: "#4a90d9", status: "進行中", name: "日本橋一丁目中地区市街地再開発",  area: "日本橋", scale: "52F 284m",   usage: "複合", completion: "26年3月", irLink: "https://www.mitsuifudosan.co.jp/", notes: "", location: { lat: 35.6826, lng: 139.7749 } },
    { id: "fb02", company: "三菱地所",     companyId: "mitsubishi",     color: "#e85555", status: "進行中", name: "Torch Tower（TOKYO TORCH B棟）", area: "大手町", scale: "62F 385m",   usage: "複合", completion: "28年3月", irLink: "https://tokyotorch.mec.co.jp/",    notes: "", location: { lat: 35.6851, lng: 139.7689 } },
    { id: "fb03", company: "野村不動産HD", companyId: "nomura",         color: "#6a6adc", status: "完成",   name: "ブルーフロント芝浦 TOWER S",      area: "浜松町", scale: "43F 229m",   usage: "複合", completion: "25年2月", irLink: "https://www.nomura-re.co.jp/",     notes: "", location: { lat: 35.6511, lng: 139.7572 } },
    { id: "fb04", company: "東急不動産HD", companyId: "tokyu",          color: "#28b0b0", status: "進行中", name: "Shibuya Upper West Project",     area: "渋谷",   scale: "34F 156m",   usage: "複合", completion: "29年7月", irLink: "https://www.tokyu.co.jp/",         notes: "", location: { lat: 35.6562, lng: 139.6995 } },
    { id: "fb05", company: "東京建物",     companyId: "tokyo_tatemono", color: "#d4813a", status: "完成",   name: "TOFROM YAESU TOWER",             area: "八重洲", scale: "51F 250m",   usage: "複合", completion: "26年2月", irLink: "https://www.tatemono.com/",        notes: "", location: { lat: 35.6814, lng: 139.7706 } },
    { id: "fb06", company: "三井不動産",   companyId: "mitsui",         color: "#4a90d9", status: "計画中", name: "築地地区まちづくり事業",           area: "築地",   scale: "最高約210m", usage: "複合", completion: "38年度",  irLink: "https://www.mitsuifudosan.co.jp/", notes: "", location: { lat: 35.6643, lng: 139.7699 } },
    { id: "fb07", company: "住友不動産",   companyId: "sumitomo",       color: "#3aaa5c", status: "計画中", name: "三田三・四丁目地区再開発",        area: "三田",   scale: "詳細未公表", usage: "複合", completion: "30年代",  irLink: "https://www.sumitomo-rd.co.jp/",  notes: "", location: { lat: 35.6455, lng: 139.7398 } },
  ];
}
