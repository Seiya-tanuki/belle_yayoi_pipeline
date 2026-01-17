const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/ChatworkNotify_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const items = [
  { id: '1', name: 'a.txt', mimeType: 'text/plain', createdAt: '2026-01-01T00:00:00Z' },
  { id: '2', name: 'b.csv', mimeType: 'text/csv', createdAt: '2026-01-02T00:00:00Z' },
  { id: '3', name: 'c.csv', mimeType: 'text/csv', createdAt: '2026-01-03T00:00:00Z' }
];

const latest = sandbox.belle_chatwork_selectLatestCsvMeta(items);
expect(latest && latest.id === '3', 'should pick newest csv');

const none = sandbox.belle_chatwork_selectLatestCsvMeta([{ id: '4', name: 'x.txt', mimeType: 'text/plain', createdAt: '2026-01-04T00:00:00Z' }]);
expect(none === null, 'should return null when no csv');

const msg = sandbox.belle_chatwork_buildLatestCsvMessage_('sample.csv');
expect(typeof msg === 'string', 'message should be string');
expect(msg.indexOf('最新のcsvファイルです') >= 0, 'message should contain jp text');

console.log('OK: test_chatwork_latest_csv');
