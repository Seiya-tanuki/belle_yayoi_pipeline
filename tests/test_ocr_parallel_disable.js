const fs = require('fs');

const code = fs.readFileSync('gas/OcrParallelTrigger_v0.js', 'utf8');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const m = code.match(/function belle_ocr_parallel_disable_fallback_v0\(\)\s*\{([\s\S]*?)\n\}/);
expect(m, 'disable function not found');
const body = m[1];

expect(!/setProperty\(\s*["']BELLE_OCR_PARALLEL_ENABLED["']/.test(body), 'disable should not set BELLE_OCR_PARALLEL_ENABLED');
expect(!/deleteProperty\(\s*["']BELLE_OCR_PARALLEL_ENABLED["']/.test(body), 'disable should not delete BELLE_OCR_PARALLEL_ENABLED');

console.log('OK: test_ocr_parallel_disable');
