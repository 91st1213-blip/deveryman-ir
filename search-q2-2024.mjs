import https from 'https';

const EDINET_CODE = 'E03863'; // 三井不動産

// 2024年11月1日～30日を検索
const dates = [];
for (let day = 1; day <= 30; day++) {
  dates.push(`2024-11-${day.toString().padStart(2, '0')}`);
}

console.log('📊 三井不動産 2024年Q2決算を検索中...');
console.log('検索期間: 2024-11-01 ～ 2024-11-30');
console.log('');

let foundDocs = [];
let checkedCount = 0;

dates.forEach((date, index) => {
  setTimeout(() => {
    const url = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${date}&type=2`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const docs = json.results?.filter(doc => doc.edinetCode === EDINET_CODE) || [];
          
          if (docs.length > 0) {
            console.log(`✅ ${date}: ${docs.length}件発見`);
            docs.forEach(doc => {
              console.log(`   📄 ${doc.docDescription}`);
              console.log(`      書類ID: ${doc.docID}`);
              console.log(`      決算期: ${doc.periodEnd || 'N/A'}`);
              console.log(`      提出者: ${doc.filerName}`);
              console.log('');
            });
            foundDocs.push(...docs);
          }
          
          checkedCount++;
          if (checkedCount === dates.length) {
            console.log(`\n📊 検索完了: 合計 ${foundDocs.length}件`);
            if (foundDocs.length === 0) {
              console.log('\n⚠️  2024年11月に書類なし');
              console.log('💡 次は 2024-08-01 ～ 2024-08-15（Q1決算）を検索しますか？');
            } else {
              console.log('\n✅ 次のステップ: 書類取得APIで決算数値を抽出');
            }
          }
        } catch (e) {
          checkedCount++;
        }
      });
    }).on('error', () => {
      checkedCount++;
    });
  }, index * 200); // APIレート制限対策（200ms間隔）
});
