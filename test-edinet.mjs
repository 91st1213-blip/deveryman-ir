// EDINET API テスト - 三井不動産の最新決算を取得
import https from 'https';

const EDINET_CODE = 'E03863'; // 三井不動産
const today = new Date().toISOString().slice(0, 10);

// 書類一覧API: 本日の提出書類を検索
const searchUrl = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${today}&type=2`;

console.log('📊 EDINET API 接続テスト');
console.log('企業コード:', EDINET_CODE);
console.log('検索日:', today);
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
        console.log('\n⚠️  本日の提出書類なし');
        console.log('💡 過去30日で再検索します...\n');
        
        // 30日前の日付で再検索
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const pastDate = thirtyDaysAgo.toISOString().slice(0, 10);
        
        const pastUrl = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${pastDate}&type=2`;
        console.log('過去検索URL:', pastUrl);
        
        https.get(pastUrl, (res2) => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            const json2 = JSON.parse(data2);
            const pastDocs = json2.results?.filter(doc => 
              doc.edinetCode === EDINET_CODE && 
              (doc.docDescription.includes('有価証券報告書') || 
               doc.docDescription.includes('四半期報告書'))
            );
            
            if (pastDocs?.length > 0) {
              console.log('\n📄 過去30日以内の三井不動産書類:');
              pastDocs.slice(0, 3).forEach(doc => {
                console.log(`- ${doc.docDescription} (${doc.submitDateTime})`);
                console.log(`  書類ID: ${doc.docID}`);
              });
            } else {
              console.log('\n⚠️  過去30日以内にも書類なし');
            }
          });
        });
      }
    } catch (e) {
      console.error('❌ エラー:', e.message);
    }
  });
}).on('error', (e) => {
  console.error('❌ API接続エラー:', e.message);
});
