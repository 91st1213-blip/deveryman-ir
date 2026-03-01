import https from 'https';
import fs from 'fs';
import AdmZip from 'adm-zip';

// 7社のEDINETコード
const COMPANIES = [
  { name: '三井不動産', edinetCode: 'E03863', secCode: '8801', fiscalMonth: 3 },
  { name: '三菱地所', edinetCode: 'E03896', secCode: '8802', fiscalMonth: 3 },
  { name: '住友不動産', edinetCode: 'E03881', secCode: '8830', fiscalMonth: 3 },
  { name: '東京建物', edinetCode: 'E03880', secCode: '8804', fiscalMonth: 12 },
  { name: '野村不動産HD', edinetCode: 'E05362', secCode: '3231', fiscalMonth: 3 },
  { name: '東急不動産HD', edinetCode: 'E05293', secCode: '3289', fiscalMonth: 3 },
  { name: 'ヒューリック', edinetCode: 'E05495', secCode: '3003', fiscalMonth: 12 }
];

// 決算発表予定日を生成（過去2年分）
function generateEarningsDates(fiscalMonth) {
  const dates = [];
  const currentYear = new Date().getFullYear();
  
  if (fiscalMonth === 3) {
    // 3月決算: Q1=8月, Q2=11月, Q3=2月, 通期=5月
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      // Q1: 8月1日〜15日
      for (let day = 1; day <= 15; day++) {
        dates.push(`${year}-08-${String(day).padStart(2, '0')}`);
      }
      // Q2: 11月1日〜15日
      for (let day = 1; day <= 15; day++) {
        dates.push(`${year}-11-${String(day).padStart(2, '0')}`);
      }
      // Q3: 2月1日〜15日
      for (let day = 1; day <= 15; day++) {
        dates.push(`${year}-02-${String(day).padStart(2, '0')}`);
      }
      // 通期: 5月1日〜20日
      for (let day = 1; day <= 20; day++) {
        dates.push(`${year}-05-${String(day).padStart(2, '0')}`);
      }
    }
  } else if (fiscalMonth === 12) {
    // 12月決算: Q1=5月, Q2=8月, Q3=11月, 通期=2月
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      // Q1: 5月1日〜15日
      for (let day = 1; day <= 15; day++) {
        dates.push(`${year}-05-${String(day).padStart(2, '0')}`);
      }
      // Q2: 8月1日〜15日
      for (let day = 1; day <= 15; day++) {
        dates.push(`${year}-08-${String(day).padStart(2, '0')}`);
      }
      // Q3: 11月1日〜15日
      for (let day = 1; day <= 15; day++) {
        dates.push(`${year}-11-${String(day).padStart(2, '0')}`);
      }
      // 通期: 2月1日〜20日
      for (let day = 1; day <= 20; day++) {
        dates.push(`${year}-02-${String(day).padStart(2, '0')}`);
      }
    }
  }
  
  // 新しい順にソート
  return dates.sort().reverse();
}

// EDINET API で決算書類を検索
async function searchEarnings(edinetCode, companyName, fiscalMonth) {
  console.log(`\n📊 ${companyName} の最新決算を検索中...`);
  
  const targetDates = generateEarningsDates(fiscalMonth);
  console.log(`  検索対象: ${targetDates.length}日分（決算発表予定日のみ）`);
  
  const results = [];
  let daysSearched = 0;
  
  for (const date of targetDates) {
    daysSearched++;
    
    // 進捗表示
    if (daysSearched % 10 === 0) {
      process.stdout.write(`\r  進捗: ${daysSearched}/${targetDates.length}日`);
    }
    
    try {
      const url = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${date}&type=2`;
      const data = await fetchJSON(url);
      
      if (data.results) {
        const docs = data.results.filter(doc => 
          doc.edinetCode === edinetCode && 
          (doc.docDescription.includes('決算短信') || 
           doc.docDescription.includes('四半期報告書') ||
           doc.docDescription.includes('有価証券報告書'))
        );
        
        if (docs.length > 0) {
          results.push(...docs.map(doc => ({ ...doc, searchDate: date })));
          console.log(`\n  ✅ ${date}: ${docs.length}件発見`);
          docs.forEach(doc => {
            console.log(`     - ${doc.docDescription}`);
            console.log(`       書類ID: ${doc.docID}`);
            console.log(`       提出日時: ${doc.submitDateTime}`);
          });
          
          // 最新のものが見つかったら検索終了
          if (docs.some(d => d.docDescription.includes('決算短信'))) {
            console.log(`  🎯 決算短信を発見したため検索を終了`);
            break;
          }
        }
      }
      
      // レート制限対策: 0.3秒待機
      await sleep(300);
      
    } catch (error) {
      // エラーは無視して次の日付へ
    }
  }
  
  console.log(`\n  検索完了: ${results.length}件の決算書類を発見`);
  
  if (results.length === 0) {
    console.log(`  ⚠️ 決算発表予定日に書類が見つかりませんでした`);
    console.log(`  💡 検索対象期間: ${targetDates[targetDates.length - 1]} 〜 ${targetDates[0]}`);
  }
  
  // 決算短信を優先、なければ最新のものを返す
  const tanshin = results.find(r => r.docDescription.includes('決算短信'));
  return tanshin || results[0];
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
function extractFinancialData(zipPath) {
  console.log(`\n  📂 XBRL データを解析中...`);
  
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    // XBRL ファイルを検索
    const xbrlEntries = entries.filter(entry => entry.entryName.endsWith('.xbrl'));
    
    if (xbrlEntries.length === 0) {
      console.log(`  ⚠️ XBRL ファイルが見つかりませんでした`);
      return null;
    }
    
    // 最も大きい XBRL ファイルを選択
    const xbrlEntry = xbrlEntries.sort((a, b) => b.header.size - a.header.size)[0];
    console.log(`  📄 XBRL ファイル: ${xbrlEntry.entryName}`);
    
    const xbrlContent = zip.readAsText(xbrlEntry);
    
    // 簡易的な数値抽出
    const extractValue = (patterns) => {
      for (const pattern of patterns) {
        const matches = xbrlContent.match(new RegExp(pattern, 'g'));
        if (matches) {
          // 複数マッチした場合は最大値を返す（累計ではなく単独の値）
          const values = matches.map(m => {
            const num = m.match(/(\d+)/);
            return num ? parseInt(num[1]) : 0;
          });
          return Math.max(...values);
        }
      }
      return null;
    };
    
    // 営業収益（売上高）
    const revenue = extractValue([
      'NetSales[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\\d+)',
      'OperatingRevenue[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\\d+)',
      'NetSales[^>]*>(\\d+)',
      'OperatingRevenue[^>]*>(\\d+)',
    ]);
    
    // 営業利益
    const operatingProfit = extractValue([
      'OperatingIncome[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\\d+)',
      'OperatingIncome[^>]*>(\\d+)',
    ]);
    
    // 経常利益
    const ordinaryProfit = extractValue([
      'OrdinaryIncome[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\\d+)',
      'OrdinaryIncome[^>]*>(\\d+)',
    ]);
    
    // 純利益
    const netProfit = extractValue([
      'ProfitLoss[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\\d+)',
      'NetIncome[^>]*contextRef="[^"]*CurrentYearDuration[^"]*"[^>]*>(\\d+)',
      'ProfitLoss[^>]*>(\\d+)',
      'NetIncome[^>]*>(\\d+)',
    ]);
    
    return {
      revenue: revenue ? Math.round(revenue / 100000000) : null,
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
  console.log('📅 決算発表予定日のみを検索（高速化）\n');
  
  // テスト: 三井不動産のみ
  const testCompany = COMPANIES[0];
  
  try {
    const latestDoc = await searchEarnings(
      testCompany.edinetCode, 
      testCompany.name,
      testCompany.fiscalMonth
    );
    
    if (!latestDoc) {
      console.log('\n❌ 決算書類が見つかりませんでした');
      return;
    }
    
    const zipPath = await downloadDocument(latestDoc.docID);
    const financialData = extractFinancialData(zipPath);
    
    if (financialData && financialData.revenue) {
      console.log('\n✅ 財務データ抽出成功:');
      console.log(`  企業名: ${testCompany.name}`);
      console.log(`  決算書類: ${latestDoc.docDescription}`);
      console.log(`  提出日: ${latestDoc.submitDateTime}`);
      console.log(`  営業収益: ${financialData.revenue?.toLocaleString() || 'N/A'}億円`);
      console.log(`  営業利益: ${financialData.operatingProfit?.toLocaleString() || 'N/A'}億円`);
      console.log(`  経常利益: ${financialData.ordinaryProfit?.toLocaleString() || 'N/A'}億円`);
      console.log(`  純利益: ${financialData.netProfit?.toLocaleString() || 'N/A'}億円`);
      
      if (financialData.operatingProfit && financialData.revenue) {
        const profitMargin = (financialData.operatingProfit / financialData.revenue * 100).toFixed(1);
        console.log(`  利益率: ${profitMargin}%`);
      }
    } else {
      console.log('\n⚠️ 財務データの抽出に失敗しました');
    }
    
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
  } catch (error) {
    console.error('\n❌ エラー:', error.message);
  }
}

main();
