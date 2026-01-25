const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/YayoiExport_v0.js', 'utf8');
const sandbox = {
  console,
  Utilities: {
    newBlob: (input) => ({
      getBytes: () => Buffer.from(String(input), 'utf8')
    })
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function build(params) {
  return sandbox.belle_yayoi_buildFallbackMemo(params);
}

const memo1 = build({
  reasonCode: 'OK',
  fileId: 'abc123',
  fileName: 'a|b\n c.jpg'
});
expect(memo1.includes('RID=OK'), 'RID should exist');
expect(memo1.includes('FN=a_b c.jpg'), 'FN should be sanitized');
expect(memo1.endsWith('FID=abc123'), 'FID should be last');

const memo2 = build({
  reasonCode: 'OCR_ISSUES',
  fileId: 'xyz789',
  fileName: 'test.pdf',
  fix: 'OCRに問題あり',
  err: 'ERROR_FINAL'
});
expect(memo2.startsWith('FIX='), 'FIX should be prefix');
expect(memo2.includes('|ERR=ERROR_FINAL'), 'ERR should exist');
expect(memo2.endsWith('FID=xyz789'), 'FID should be last');

const memo4 = build({
  reasonCode: 'DATE_FALLBACK',
  fileId: 'err001',
  fileName: 'e.pdf',
  fix: '誤った取引日',
  dtCode: 'NO_DATE',
  dm: true
});
expect(memo4.includes('RID=OCR_ERROR_FINAL|DM=1'), 'DM should follow RID');
expect(memo4.startsWith('FIX=全データ確認|'), 'FIX should be override');
expect(memo4.includes('|DT=NO_DATE'), 'DT should remain');

const longFix = 'X'.repeat(200);
const longName = 'Y'.repeat(200);
const memo3 = build({
  reasonCode: 'UNUSUAL_FORMAT',
  fileId: 'fid_long_1234567890',
  fileName: longName,
  fix: longFix,
  err: 'ERRCODE'
});
expect(memo3.length <= 180, 'memo should be trimmed');
expect(memo3.includes('RID=UNUSUAL_FORMAT'), 'RID should be preserved');
expect(memo3.includes('FID='), 'FID should be preserved');

console.log('OK: test_memo_format');



