import https from 'https';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fs from 'fs';
import AdmZip from 'adm-zip';

const pipelineAsync = promisify(pipeline);

// 7社のEDINETコード
const COMPANIES = [
  { name: '三井不動産', edinetCode: 'E03863', secCode: '8801' },
  { name: '三菱地所', edinetCode: 'E03896', secCode: '8802' },
  { name: '住友不動産', edinetCode: 'E03881', secCode: '8830' },
  { name: '東京建物', edinetCode: 'E03880', secCode: '8804' },
  { name: '野村不動産HD', edinetCode: 'E05362', secCode: '3231' },
  { name: '東急不動産HD', edinetCode: 'E05293', secCode: '3289' },
  { name: 'ヒューリック', edinetCode: 'E05495', secCode: '3003' }
];

// EDINET API で最新の決算短信を検索
async function searchLatestEarnings(edinetCode, companyName) {
  console.log(`\n📊 ${companyName} の最新決算を検索中...`);
  
  // 過去365日間を検索（1年間）
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365); // 90日 → 365日に変更
  
  const results = [];
  let daysSearched = 0;
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  console.log(`  検索期間: ${startDate.toISOString().split('T')[0]} 〜 ${endDate.toISOString().split('T')[0]} (${totalDays}日間)`);
  
  for (let date = new Date(endDate); date >= startDate; date.setDate(date.getDate() - 1)) {
    const dateStr = date.toISOString().split('T')[0];
    daysSearched++;
    
    // 進捗表示（10日ごと）
    if (daysSearched % 10 === 0) {
      process.stdout.write(`\r  進捗: ${daysSearched}/${totalDays}日 (${Math.round(daysSearched/totalDays*100)}%)`);
    }
    
    try {
      const url = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${dateStr}&type=2`;
      const data = await fetchJSON(url);
      
      if (data.results) {
        const docs = data.results.filter(doc => 
          doc.edinetCode === edinetCode && 
          (doc.docDescription.includes('決算短信') || 
           doc.docDescription.includes('四半期報告書') ||
           doc.docDescription.includes('有価証券報告書'))
        );
        
        if (docs.length > 0) {
          results.push(...docs);
          console.log(`\n  ✅ ${dateStr}: ${docs.length}件発見`);
          docs.forEach(doc => {
            console.log(`     - ${doc.docDescription}`);
            console.log(`       書類ID: ${doc.docID}`);
          });
        }
      }
      
      // レート制限対策: 0.5秒待機
      await sleep(500);
      
    } catch (error) {
      // エラーは無視して次の日付へ
    }
  }
  
  console.log(`\n  検索完了: ${results.length}件の決算書類を発見`);
  
  if (results.length === 0) {
    console.log(`  ⚠️ 過去1年間に決算書類が見つかりませんでした`);
  }
  
  return results[0]; // 最新のものを返す
}

// JSON データを取得
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// 待機
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// XBRL データをダウンロード
async function downloadDocument(docID) {
  console.log(`\n  📥 書類をダウンロード中... (${docID})`);
  
  const url = `https://disclosure.edinet-fsa.go.jp/api/v2/documents/${docID}?type=1`;
  const zipPath = `/tmp/${docID}.zip`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(zipPath);
      res.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`  ✅ ダウンロード完了`);
        resolve(zipPath);
      });
    }).on('error', reject);
  });
}

// ZIP を解凍して XBRL を解析
function extractFinancialData(zipPath, companyName) {
  console.log(`\n  📂 ZIP ファイルを解凍中...`);
  
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    console.log(`  ファイル数: ${entries.length}件`);
    
    // XBRL ファイルを検索
    const xbrlEntries = entries.filter(entry => entry.entryName.endsWith('.xbrl'));
    console.log(`  XBRL ファイル: ${xbrlEntries.length}件`);
    
    if (xbrlEntries.length === 0) {
      console.log(`  ⚠️ XBRL ファイルが見つかりませんでした`);
      return null;
    }
    
    // 最も大きい XBRL ファイルを選択（通常、決算データを含む）
    const xbrlEntry = xbrlEntries.sort((a, b) => b.header.size - a.header.size)[0];
    console.log(`  📄 XBRL ファイル: ${xbrlEntry.entryName}`);
    
    const xbrlContent = zip.readAsText(xbrlEntry);
    
    // 簡易的な数値抽出（正規表現）
    const extractValue = (patterns) => {
      for (const pattern of patterns) {
        const match = xbrlContent.match(pattern);
        if (match) {
          return parseInt(match[1]);
        }
      }
      return null;
    };
    
    // 営業収益（売上高）- 複数パターンを試行
    const revenue = extractValue([
      /<jpcrp_cor:NetSales[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\d+)<\/jpcrp_cor:NetSales>/,
      /<jpcrp_cor:OperatingRevenue[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\d+)<\/jpcrp_cor:OperatingRevenue>/,
      /<jpcrp_cor:NetSales[^>]*>(\d+)<\/jpcrp_cor:NetSales>/,
      /<jpcrp_cor:OperatingRevenue[^>]*>(\d+)<\/jpcrp_cor:OperatingRevenue>/,
    ]);
    
    // 営業利益
    const operatingProfit = extractValue([
      /<jpcrp_cor:OperatingIncome[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\d+)<\/jpcrp_cor:OperatingIncome>/,
      /<jpcrp_cor:OperatingIncome[^>]*>(\d+)<\/jpcrp_cor:OperatingIncome>/,
    ]);
    
    // 経常利益
    const ordinaryProfit = extractValue([
      /<jpcrp_cor:OrdinaryIncome[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\d+)<\/jpcrp_cor:OrdinaryIncome>/,
      /<jpcrp_cor:OrdinaryIncome[^>]*>(\d+)<\/jpcrp_cor:OrdinaryIncome>/,
    ]);
    
    // 純利益
    const netProfit = extractValue([
      /<jpcrp_cor:ProfitLoss[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\d+)<\/jpcrp_cor:ProfitLoss>/,
      /<jpcrp_cor:NetIncome[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\d+)<\/jpcrp_cor:NetIncome>/,
      /<jpcrp_cor:ProfitLoss[^>]*>(\d+)<\/jpcrp_cor:ProfitLoss>/,
      /<jpcrp_cor:NetIncome[^>]*>(\d+)<\/jpcrp_cor:NetIncome>/,
    ]);
    
    return {
      revenue: revenue ? Math.round(revenue / 100000000) : null,  // 億円単位に変換
      operatingProfit: operatingProfit ? Math.round(operatingProfit / 100000000) : null,
      ordinaryProfit: ordinaryProfit ? Math.round(ordinaryProfit / 100000000) : null,
      netProfit: netProfit ? Math.round(netProfit / 100000000) : null,
    };
  } catch (error) {
    console.error(`  ❌ XBRL 解析エラー:`, error.message);
    return null;
  }
}

// メイン処理
async function main() {
  console.log('🚀 EDINET API から最新決算データを取得します');
  console.log('📅 検索期間: 過去1年間\n');
  
  // テスト: 三井不動産のみ
  const testCompany = COMPANIES[0];
  
  try {
    // 1. 最新の決算書類を検索
    const latestDoc = await searchLatestEarnings(testCompany.edinetCode, testCompany.name);
    
    if (!latestDoc) {
      console.log('\n❌ 決算書類が見つかりませんでした');
      console.log('\n💡 代替案:');
      console.log('  1. 各社の IR ページから手動で取得');
      console.log('  2. 特定の日付を指定して検索（例: 2024-11-08）');
      return;
    }
    
    // 2. 書類をダウンロード
    const zipPath = await downloadDocument(latestDoc.docID);
    
    // 3. XBRL データから財務数値を抽出
    const financialData = extractFinancialData(zipPath, testCompany.name);
    
    if (financialData && financialData.revenue) {
      console.log('\n✅ 財務データ抽出成功:');
      console.log(`  企業名: ${testCompany.name}`);
      console.log(`  営業収益: ${financialData.revenue?.toLocaleString() || 'N/A'}億円`);
      console.log(`  営業利益: ${financialData.operatingProfit?.toLocaleString() || 'N/A'}億円`);
      console.log(`  経常利益: ${financialData.ordinaryProfit?.toLocaleString() || 'N/A'}億円`);
      console.log(`  純利益: ${financialData.netProfit?.toLocaleString() || 'N/A'}億円`);
      
      if (financialData.operatingProfit && financialData.revenue) {
        const profitMargin = (financialData.operatingProfit / financialData.revenue * 100).toFixed(1);
        console.log(`  利益率: ${profitMargin}%`);
      }
      
      console.log('\n📝 このデータを Google Sheets に入力できます');
    } else {
      console.log('\n⚠️ 財務データの抽出に失敗しました');
      console.log('   XBRL のフォーマットが想定と異なる可能性があります');
    }
    
    // クリーンアップ
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
  } catch (error) {
    console.error('\n❌ エラー:', error.message);
    console.error(error.stack);
  }
}

main();
