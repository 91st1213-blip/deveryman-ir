import { google } from 'googleapis';
import fs from 'fs';

// 環境変数または JSON ファイルから認証情報を取得
let credentials: { client_email: string; private_key: string };

if (import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && import.meta.env.GOOGLE_PRIVATE_KEY) {
  // 本番環境：環境変数から取得
  credentials = {
    client_email: import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: import.meta.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
} else {
  // ローカル開発：JSON ファイルから取得
  const jsonFile = '/Users/takumisugimoto/Desktop/deveryman-ir-657d407324c4.json';
  const jsonContent = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  credentials = {
    client_email: jsonContent.client_email,
    private_key: jsonContent.private_key,
  };
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = import.meta.env.GOOGLE_SHEETS_ID || '1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI';

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

export async function getLatestEarnings(): Promise<CompanyData[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '最新決算!A2:J',
    });
    
    const rows = response.data.values || [];
    return rows.map(row => ({
      companyName: row[0] ?? '',
      companyId: row[1] ?? '',
      fiscalPeriod: row[2] ?? '',
      revenue: parseFloat(row[3]) || 0,
      operatingProfit: parseFloat(row[4]) || 0,
      ordinaryProfit: parseFloat(row[5]) || 0,
      netProfit: parseFloat(row[6]) || 0,
      profitMargin: parseFloat(row[7]) || 0,
      announcementDate: row[8] ?? '',
      irLink: row[9] ?? ''
    }));
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error);
    return [];
  }
}
