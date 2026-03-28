#!/usr/bin/env python3
"""
三菱地所・野村不動産HD ニューススクレイパー
毎週金曜日に実行 → Sheets「news」シートに追記
"""
import os, re, json, base64
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SPREADSHEET_ID = "1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI"
SHEET_NAME = "news"
CUTOFF_DAYS = 90

CATEGORY_KEYWORDS = {
    "決算": ["決算", "業績", "財務", "収益", "純利益", "売上", "四半期"],
    "着工": ["着工", "起工", "工事開始"],
    "竣工": ["竣工", "完成", "完工"],
    "開業": ["開業", "オープン", "グランドオープン", "開館", "開店"],
    "資金調達": ["資金調達", "増資", "社債", "借入"],
    "提携": ["提携", "協定", "合意", "アライアンス", "パートナー", "連携"],
    "海外": ["海外", "フィリピン", "インド", "アメリカ", "米国", "テキサス", "中国", "シンガポール"],
}
BADGE_MAP = {"決算": "red", "着工": "yellow", "竣工": "green", "開業": "blue",
             "資金調達": "purple", "提携": "teal", "海外": "orange", "その他": "gray"}

EXCLUDE_KEYWORDS = ["フェア", "受賞", "イベント", "開催", "キャンペーン", "セミナー",
                    "説明会", "募集", "採用", "インターン", "表彰", "ボンド", "女性活躍",
                    "期間限定", "防災", "認証", "放送", "アニメ", "記念", "周年",
                    "マルシェ", "ワークショップ", "実証実験", "WebCM", "人事異動",
                    "組織改正", "役員", "取締役", "自己株式", "消却", "信託",
                    "フォーブス", "スター", "彫刻", "アート", "eco", "出展", "デジタル活用",
                    "交流", "省エネ", "ホテル", "宿泊"]

def detect_category(title):
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(kw in title for kw in kws):
            return cat, BADGE_MAP[cat]
    return "その他", "gray"

def normalize_date(raw):
    raw = raw.strip()
    # 2026/03/27 or 2026年01月30日
    m = re.search(r'(\d{4})[/年](\d{1,2})[/月](\d{1,2})', raw)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    return datetime.now().strftime("%Y-%m-%d")

def is_recent(date_str):
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d >= datetime.now() - timedelta(days=CUTOFF_DAYS)
    except:
        return False

def is_excluded(title):
    return any(kw in title for kw in EXCLUDE_KEYWORDS)

def scrape_mitsubishi(page):
    results = []
    page.goto("https://www.mec.co.jp/j/news/releases/", wait_until="networkidle")
    items = page.query_selector_all("a")
    for item in items:
        text = item.inner_text().strip()
        href = item.get_attribute("href") or ""
        if not re.search(r'\d{4}[/年]\d{1,2}', text):
            continue
        # 日付抽出
        date_match = re.search(r'(\d{4}[/年]\d{1,2}[/月]\d{1,2})', text)
        if not date_match:
            continue
        date = normalize_date(date_match.group(1))
        if not is_recent(date):
            continue
        # タイトル（日付・カテゴリ除去）
        title = re.sub(r'\d{4}[/年]\d{1,2}[/月]\d{1,2}', '', text)
        title = re.sub(r'(オフィスビル|住宅|商業|ホテル|アウトレットモール|適時開示|IR情報)', '', title)
        title = title.strip()
        if not title or is_excluded(title):
            continue
        # URL正規化
        if href.startswith("/"):
            href = "https://www.mec.co.jp" + href
        cat, badge = detect_category(title)
        results.append([date, "三菱地所", "mitsubishi", cat, badge, title, href])
    return results

def scrape_nomura(page):
    results = []
    page.goto("https://www.nomura-re-hd.co.jp/ir/ir-news.html", wait_until="networkidle")
    items = page.query_selector_all("a")
    for item in items:
        text = item.inner_text().strip()
        href = item.get_attribute("href") or ""
        if not re.search(r'\d{4}年\d{1,2}月\d{1,2}日', text):
            continue
        date_match = re.search(r'(\d{4}年\d{1,2}月\d{1,2}日)', text)
        if not date_match:
            continue
        date = normalize_date(date_match.group(1))
        if not is_recent(date):
            continue
        title = re.sub(r'\d{4}年\d{1,2}月\d{1,2}日', '', text)
        title = re.sub(r'IR情報', '', title).strip()
        if not title or is_excluded(title):
            continue
        if href.startswith("/"):
            href = "https://www.nomura-re-hd.co.jp" + href
        cat, badge = detect_category(title)
        results.append([date, "野村不動産HD", "nomura", cat, badge, title, href])
    return results

def get_sheets_service():
    cred_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if cred_json:
        try:
            creds_data = json.loads(base64.b64decode(cred_json).decode("utf-8"))
        except:
            creds_data = json.loads(cred_json)
    else:
        with open("service-account.json") as f:
            creds_data = json.load(f)
    creds = Credentials.from_service_account_info(
        creds_data, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=creds)

def append_to_sheets(service, rows):
    if not rows:
        print("追記するデータなし")
        return
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}!A:G",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": rows}
    ).execute()
    print(f"✅ {len(rows)}件をSheetsに追記しました")

def main():
    print("🏢 三菱地所・野村 スクレイパー起動")
    all_results = []
    with sync_playwright() as p:
        context = p.chromium.launch().new_context(locale="ja-JP")
        page = context.new_page()
        
        print("  三菱地所 スクレイピング中...")
        mec = scrape_mitsubishi(page)
        print(f"  ✅ 三菱地所: {len(mec)}件")
        all_results.extend(mec)
        
        print("  野村不動産HD スクレイピング中...")
        nomura = scrape_nomura(page)
        print(f"  ✅ 野村不動産HD: {len(nomura)}件")
        all_results.extend(nomura)
        
        context.close()
    
    print(f"\n📊 合計 {len(all_results)} 件取得")
    
    service = get_sheets_service()
    append_to_sheets(service, all_results)
    print("✨ 完了！")

if __name__ == "__main__":
    main()
