import fs from 'fs';
import path from 'path';

const INDEX_PATH = path.resolve('src/pages/index.astro');

if (!fs.existsSync(INDEX_PATH)) {
  console.error('❌ src/pages/index.astro が見つかりません');
  process.exit(1);
}

let content = fs.readFileSync(INDEX_PATH, 'utf-8');

const IMPORT_LINE = `import CompanyCards from '../components/CompanyCards.astro';`;

if (content.includes(IMPORT_LINE)) {
  console.log('ℹ️  import はすでに存在します');
} else {
  content = content.replace(/^(---\s*\n)/, `$1${IMPORT_LINE}\n`);
  console.log('✅ import を追加しました');
}

const FALLBACK_PATTERN = /(<section[^>]*id="companies"[\s\S]*?<\/section>)/;
if (FALLBACK_PATTERN.test(content)) {
  content = content.replace(
    FALLBACK_PATTERN,
    `<section class="section" id="companies">\n    <div class="container">\n      <CompanyCards />\n    </div>\n  </section>`
  );
  console.log('✅ id="companies" セクションを <CompanyCards /> に置き換えました');
} else {
  console.error('❌ id="companies" セクションが見つかりません');
  process.exit(1);
}

fs.copyFileSync(INDEX_PATH, INDEX_PATH + '.bak2');
fs.writeFileSync(INDEX_PATH, content, 'utf-8');
console.log('✅ index.astro を更新しました（バックアップ: index.astro.bak2）');
