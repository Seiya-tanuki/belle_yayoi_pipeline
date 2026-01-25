const fs = require('fs');
const vm = require('vm');

const code = [
  fs.readFileSync('gas/Config_v0.js', 'utf8'),

  fs.readFileSync('gas/DocTypeRegistry_v0.js', 'utf8'),
  fs.readFileSync('gas/Log_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Sheet_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Drive_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Pdf_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8') + '\n' + fs.readFileSync('gas/Queue_v0.js', 'utf8'),
  fs.readFileSync('gas/Export_v0.js', 'utf8'),
  fs.readFileSync('gas/Review_v0.js', 'utf8')
].join('\n');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function expectThrows(fn, msg) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) throw new Error(msg);
}

function normalizeMap(map) {
  const keys = Object.keys(map).sort();
  const out = {};
  for (let i = 0; i < keys.length; i++) out[keys[i]] = map[keys[i]];
  return JSON.stringify(out);
}

function makeSheet(headerRow) {
  let header = Array.isArray(headerRow) ? headerRow.slice() : [];
  let lastRow = header.length > 0 ? 1 : 0;
  return {
    getLastRow: () => lastRow,
    appendRow: (row) => {
      header = Array.isArray(row) ? row.slice() : [];
      lastRow = 1;
    },
    getLastColumn: () => header.length,
    getRange: (row, col, numRows, numCols) => {
      return {
        getValues: () => {
          const width = numCols || header.length;
          return [header.slice(0, width)];
        },
        setValue: (value) => {
          const idx = col - 1;
          while (header.length <= idx) header.push('');
          header[idx] = value;
        }
      };
    }
  };
}

function runBoth(headerRow, baseHeader, extraHeader, opts) {
  const shA = makeSheet(headerRow);
  const shB = makeSheet(headerRow);
  const mapA = sandbox.belle_queue_ensureHeaderMap(shA, baseHeader, extraHeader, opts);
  const mapB = sandbox.belle_queue_ensureHeaderMapForExport(shB, baseHeader, extraHeader, opts);
  return { mapA, mapB };
}

const baseHeader = ['status', 'file_id', 'file_name'];
const extraHeader = ['extra'];

// Exact match.
{
  const headerRow = ['status', 'file_id', 'file_name', 'extra'];
  const out = runBoth(headerRow, baseHeader, extraHeader, null);
  expect(normalizeMap(out.mapA) === normalizeMap(out.mapB), 'exact match map mismatch');
}

// Missing required column should throw when strict.
{
  const headerRow = ['status', 'file_id'];
  const opts = { appendMissing: false, throwOnMissing: true };
  expectThrows(() => runBoth(headerRow, baseHeader, extraHeader, opts), 'missing required should throw');
}

// Extra unknown columns should be preserved in map.
{
  const headerRow = ['status', 'file_id', 'file_name', 'extra', 'unknown'];
  const out = runBoth(headerRow, baseHeader, extraHeader, null);
  expect(normalizeMap(out.mapA) === normalizeMap(out.mapB), 'extra columns map mismatch');
  expect(out.mapA.unknown === out.mapB.unknown, 'extra column index mismatch');
}

// Reordered columns should still map correctly.
{
  const headerRow = ['file_id', 'status', 'extra', 'file_name'];
  const out = runBoth(headerRow, baseHeader, extraHeader, null);
  expect(normalizeMap(out.mapA) === normalizeMap(out.mapB), 'reordered map mismatch');
  expect(out.mapA.status === 1, 'reordered map status index mismatch');
}

console.log('OK: test_queue_header_map_parity');





