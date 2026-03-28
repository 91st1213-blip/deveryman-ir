export interface Company {
  id:        string;
  name:      string;
  code:      string;
  stock:     number | null;
  mCap:      number | null;
  roe:       number | null;
  pbr:       number | null;
  divYield:  number | null;
  shares:    number | null;
  prevClose: number | null;
  change:    number | null;
  updatedAt: string | null;
  period:      string | null;
  announcedAt: string | null;
  badge:       string | null;
  revenue:   number | null;
  op:        number | null;
  net:       number | null;
  margin:    number | null;
  revYoy:    number | null;
  ord:       number | null;
  ordYoy:    number | null;
  netYoy:    number | null;
  revFull:   number | null;
  opFull:    number | null;
  netFull:   number | null;
}

const SHEET_ID  = "1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI";
const SHEET_TAB = "companies";

export async function fetchCompanies(): Promise<Company[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GViz fetch error: ${res.status}`);
    const rows = parseCSV(await res.text()).slice(1);
    return rows.map(parseRow).filter((c): c is Company => c !== null);
  } catch (e) {
    console.error("[companies] GViz fetch failed:", e);
    return FALLBACK_COMPANIES;
  }
}

function parseCSV(csv: string): string[][] {
  return csv.trim().split("\n").map(line => {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

function parseRow(row: string[]): Company | null {
  const id = row[0]?.trim(), name = row[1]?.trim(), code = row[2]?.trim();
  if (!id || !name || !code || id === "id") return null;
  const n = (v?: string) => { if (!v?.trim()) return null; const x = parseFloat(v.replace(/,/g,"")); return isNaN(x) ? null : x; };
  return { id, name, code, stock: n(row[15]), mCap: n(row[16]), roe: n(row[17]), pbr: n(row[18]), divYield: n(row[19]), shares: n(row[20]), prevClose: n(row[21]), change: n(row[22]), updatedAt: row[23]?.trim()||null, period: row[3]?.trim()||null, announcedAt: row[4]?.trim()||null, badge: row[5]?.trim()||null, revenue: n(row[6]), op: n(row[9]), net: n(row[13]),
    margin:  n(row[10]),
    revYoy:  n(row[8]),
    ord:     n(row[11]),
    ordYoy:  n(row[12]),
    netYoy:  n(row[14]),
    revFull: null,
    opFull:  null,
    netFull: null,
  };
}

export const FALLBACK_COMPANIES: Company[] = [
  { id:"mitsui",     name:"三井不動産",   code:"8801", stock:null, mCap:null, roe:null, pbr:null, divYield:null, shares:2782189711, prevClose:null, change:null, updatedAt:null, period:null, announcedAt:null, badge:null, revenue:null, op:null, net:null, margin:null, revYoy:null, ord:null, ordYoy:null, netYoy:null, revFull:null, opFull:null, netFull:null },
  { id:"mitsubishi", name:"三菱地所",     code:"8802", stock:null, mCap:null, roe:null, pbr:null, divYield:null, shares:1217233706, prevClose:null, change:null, updatedAt:null, period:null, announcedAt:null, badge:null, revenue:null, op:null, net:null, margin:null, revYoy:null, ord:null, ordYoy:null, netYoy:null, revFull:null, opFull:null, netFull:null },
  { id:"sumitomo",   name:"住友不動産",   code:"8830", stock:null, mCap:null, roe:null, pbr:null, divYield:null, shares:936000000,  prevClose:null, change:null, updatedAt:null, period:null, announcedAt:null, badge:null, revenue:null, op:null, net:null, margin:null, revYoy:null, ord:null, ordYoy:null, netYoy:null, revFull:null, opFull:null, netFull:null },
  { id:"tokyo",      name:"東京建物",     code:"8804", stock:null, mCap:null, roe:null, pbr:null, divYield:null, shares:207978574,  prevClose:null, change:null, updatedAt:null, period:null, announcedAt:null, badge:null, revenue:null, op:null, net:null, margin:null, revYoy:null, ord:null, ordYoy:null, netYoy:null, revFull:null, opFull:null, netFull:null },
  { id:"nomura",     name:"野村不動産HD", code:"3231", stock:null, mCap:null, roe:null, pbr:null, divYield:null, shares:917895685,  prevClose:null, change:null, updatedAt:null, period:null, announcedAt:null, badge:null, revenue:null, op:null, net:null, margin:null, revYoy:null, ord:null, ordYoy:null, netYoy:null, revFull:null, opFull:null, netFull:null },
  { id:"tokyu",      name:"東急不動産HD", code:"3289", stock:null, mCap:null, roe:null, pbr:null, divYield:null, shares:719830974,  prevClose:null, change:null, updatedAt:null, period:null, announcedAt:null, badge:null, revenue:null, op:null, net:null, margin:null, revYoy:null, ord:null, ordYoy:null, netYoy:null, revFull:null, opFull:null, netFull:null },
];

export const changeClass   = (v: number|null) => v===null?"flat":v>0?"up":v<0?"down":"flat";
export const formatPrice   = (v: number|null) => v===null?"---":`¥${v.toLocaleString("ja-JP")}`;
export const formatMCap    = (v: number|null) => v===null?"---":v>=10000?`${(v/10000).toFixed(2)}兆円`:`${v.toLocaleString("ja-JP")}億円`;
export const formatChange  = (v: number|null) => v===null?"---":`${v>=0?"+":""}${v.toFixed(2)}%`;
export const formatPct     = (v: number|null, d=1) => v===null?"---":`${v.toFixed(d)}%`;
export const formatMultiple= (v: number|null) => v===null?"---":`${v.toFixed(2)}x`;
