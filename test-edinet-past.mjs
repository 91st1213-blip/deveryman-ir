import https from 'https';

const EDINET_CODE = 'E03863'; // 三井不動産
// 2024年11月14日（第2四半期決算発表の想定日）
const targetDate = '2024-11-14';

const searchUrl = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${targetDate}&type=2`;

console.log('📊 EDINET API 過去日検索テスト');
console.log('企業コード:', EDINET_CODE, '（三井不動産）');
console.log('検索日:', targetDate);
console.log('');

https.get(searchUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ API接続成功');
      console.log('全体取得件数:', json.results?.length || 0);
      
      // 三井不動産の書類を検索
      const mitsuiDocs = json.results?.filter(doc => 
        doc.edinetCode === EDINET_CODE
      );
      
      if (mitsuiDocs?.length > 0) {
        console.log('\n📄 三井不動産の書類:');
        mitsuiDocs.forEach(doc => {
          console.log(`\n- ${doc.docDescription}`);
          console.log(`  提出日時: ${doc.submitDateTime}`);
          console.log(`  書類ID: ${doc.docID}`);
          console.log(`  決算期: ${doc.periodEnd || 'N/A'}`);
        });
      } else {
        console.log('\n⚠️  この日に三井不動産の書類なし');
        console.log('\n💡 別の日付で試してみましょう:');
        console.log('- 2024-11-08（Q2決算の可能性）');
        console.log('- 2024-08-08（Q1決算の可能性）');
        console.log('- 2024-05-14（通期決算の可能性）');
      }
    } catch (e) {
      console.error('❌ エラー:', e.message);
    }
  });
}).on('error', (e) => {
  console.error('❌ API接続エラー:', e.message);
});
