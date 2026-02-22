import { google } from 'googleapis';

// Cloudflare Pages 環境変数から認証情報を取得
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI';

export interface EarningsData {
  company: string;
  companyId: string;
  period: string;
  revenue: number;
  operatingProfit: number;
  ordinaryProfit: number;
  netProfit: number;
  profitMargin: number;
  announcementDate: string;
  irLink: string;
}

export async function getLatestEarnings(): Promise<EarningsData[]> {
  try {
    console.log('[Sheets] Fetching data from Google Sheets...');
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '最新決算!A2:J100', // ヘッダー行（A1:J1）をスキップ
    });

    const rows = response.data.values || [];
    console.log(`[Sheets] Retrieved ${rows.length} rows`);

    return rows.map((row) => ({
      company: row[0] || '',
      companyId: row[1] || '',
      period: row[2] || '',
      revenue: parseFloat(row[3]) || 0,
      operatingProfit: parseFloat(row[4]) || 0,
      ordinaryProfit: parseFloat(row[5]) || 0,
      netProfit: parseFloat(row[6]) || 0,
      profitMargin: parseFloat(row[7]) || 0,
      announcementDate: row[8] || '',
      irLink: row[9] || '',
    }));
  } catch (error) {
    console.error('[Sheets] Error fetching data:', error);
    return [];
  }
}
