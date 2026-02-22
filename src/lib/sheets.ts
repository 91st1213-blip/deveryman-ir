import { google } from 'googleapis';

const credentials = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')  // エスケープされた \n を実際の改行に変換
    .trim(),
};

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI';

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
