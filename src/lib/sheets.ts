import { google } from 'googleapis';
import fs from 'fs';

const JSON_KEY_PATH = '/Users/takumisugimoto/Desktop/deveryman-ir-657d407324c4.json';

let auth;

if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  console.log('[Sheets] Loading credentials from environment variables (Production)');
  auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
} else if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(JSON_KEY_PATH)) {
  console.log('[Sheets] Loading credentials from JSON file (Local)');
  auth = new google.auth.GoogleAuth({
    keyFile: JSON_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
} else {
  throw new Error('[Sheets] No credentials found.');
}

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1U0OqbrHUcCpvnQeNYvBiOuWJF9U7PgRuf_WAez8gdZI';

export interface EarningsData {
  company: string;
  secCode: string;
  companyId: string;
  period: string;
  announcementDate: string;
  revenue: number;
  operatingProfit: number;
  ordinaryProfit: number;
  netProfit: number;
  profitMargin: number;
  stockPrice: number;
  irLink: string;
}

export async function getLatestEarnings(): Promise<EarningsData[]> {
  try {
    console.log('[Sheets] Fetching data from Google Sheets...');
    console.log('[Sheets] Spreadsheet ID:', SPREADSHEET_ID);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '最新決算!A2:S100',
    });

    const rows = response.data.values || [];
    console.log(`[Sheets] ✅ Successfully retrieved ${rows.length} rows`);

    if (rows.length === 0) {
      console.warn('[Sheets] ⚠️ No data found in sheet');
      return [];
    }

    return rows.map((row) => ({
      company: row[0] || '',
      secCode: row[1] || '',
      companyId: row[2] || '',
      period: row[3] || '',
      announcementDate: row[4] || '',
      revenue: parseFloat(row[5]) || 0,
      operatingProfit: parseFloat(row[6]) || 0,
      ordinaryProfit: parseFloat(row[7]) || 0,
      netProfit: parseFloat(row[8]) || 0,
      profitMargin: parseFloat(row[9]) || 0,
      stockPrice: parseFloat(row[10]) || 0,
      irLink: row[18] || '',
    }));
  } catch (error: any) {
    console.error('[Sheets] ❌ Error:', error.message);
    return [];
  }
}
