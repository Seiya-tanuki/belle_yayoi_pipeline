const fs = require('fs');
const path = require('path');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const gasDir = 'gas';
const files = fs.readdirSync(gasDir).filter((f) => f.endsWith('.js'));
const geminiPattern = /function\s+(belle_getGeminiConfig|belle_callGeminiOcr)\s*\(/g;
const geminiHost = 'generativelanguage.googleapis.com';

const offenders = [];
let geminiDefs = [];
let hostHits = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(gasDir, file), 'utf8');
  const matches = [];
  let m = null;
  while ((m = geminiPattern.exec(content)) !== null) {
    matches.push(m[1]);
  }
  if (matches.length > 0) {
    if (file === 'Gemini.js') geminiDefs = geminiDefs.concat(matches);
    else offenders.push({ file, names: matches });
  }
  if (content.indexOf(geminiHost) >= 0) {
    hostHits.push(file);
  }
}

expect(geminiDefs.length > 0, 'expected Gemini helpers in gas/Gemini.js');
expect(offenders.length === 0, 'Gemini helpers found outside Gemini.js: ' + JSON.stringify(offenders));
expect(hostHits.length === 1 && hostHits[0] === 'Gemini.js', 'Gemini host should appear only in Gemini.js: ' + JSON.stringify(hostHits));

console.log('OK: test_gemini_module_boundaries');
