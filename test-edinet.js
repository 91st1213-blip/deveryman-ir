// EDINET API テスト - 三井不動産の最新決算を取得
const https = require('https');

const EDINET_CODE = 'E03863'; // 三井不動産
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');

// 書類一覧API: 過去1ヶ月の提出書類を検索
const searchUrl = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${today.replace(/\//g, '-')}&type=2`;

console.log('📊 EDINET API 接続テスト');
console.log('企業コード:', EDINET_CODE);
console.log('検索URL:', searchUrl);
console.log('');

https.get(searchUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ API接続成功');
      console.log('取得件数:', json.results?.length || 0);
      
      // 三井不動産の書類を検索
      const mitsuiDocs = json.results?.filter(doc => 
        doc.edinetCode === EDINET_CODE
      );
      
      if (mitsuiDocs?.length > 0) {
        console.log('\n📄 三井不動産の最新書類:');
        mitsuiDocs.slice(0, 3).forEach(doc => {
          console.log(`- ${doc.docDescription} (${doc.submitDateTime})`);
          console.log(`  書類ID: ${doc.docID}`);
        });
      } else {
        console.log('\n⚠️  本日の提出書類なし（過去30日で再検索を推奨）');
      }
    } catch (e) {
      console.error('❌ エラー:', e.message);
    }
  });
}).on('error', (e) => {
  console.error('❌ API接続エラー:', e.message);
});
