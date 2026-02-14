import { google } from 'googleapis';

// Google Sheets APIの認証設定
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    private_key: (import.meta.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = import.meta.env.GOOGLE_SHEETS_ID;

// データ型の定義
export interface CompanyData {
  companyName: string;
  companyId: string;
  fiscalPeriod: string;
  revenue: number;
  operatingProfit: number;
  ordinaryProfit: number;
  netProfit: number;
  profitMargin: number;
  announcementDate: string;
  irLink: string;
}

// Google Sheetsからデータを取得する関数
export async function getLatestEarnings(): Promise<CompanyData[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '最新決算!A2:J',
    });

    const rows = response.data.values || [];
    
    return rows.map((row) => ({
      companyName: row[0] || '',
      companyId: row[1] || '',
      fiscalPeriod: row[2] || '',
      revenue: parseFloat(row[3]) || 0,
      operatingProfit: parseFloat(row[4]) || 0,
      ordinaryProfit: parseFloat(row[5]) || 0,
      netProfit: parseFloat(row[6]) || 0,
      profitMargin: parseFloat(row[7]) || 0,
      announcementDate: row[8] || '',
      irLink: row[9] || '',
    }));
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error);
    return [];
  }
}
