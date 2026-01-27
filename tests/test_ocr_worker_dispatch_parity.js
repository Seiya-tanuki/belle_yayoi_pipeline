const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const code = fs.readFileSync('gas/DocTypeRegistry.js', 'utf8')
  + '\n' + fs.readFileSync('gas/OcrWorkerParallel.js', 'utf8');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const calls = [];
const resultTwo = sandbox.belle_ocr_worker_dispatchByPipelineKind_('two_stage', {
  two_stage: () => { calls.push('two'); return { ok: 'two' }; },
  single_stage: () => { calls.push('single'); return { ok: 'single' }; },
  inactive: () => { calls.push('inactive'); return { ok: 'inactive' }; }
});
expect(resultTwo && resultTwo.ok === 'two', 'two_stage should return two handler result');

const resultSingle = sandbox.belle_ocr_worker_dispatchByPipelineKind_('single_stage', {
  two_stage: () => { calls.push('two2'); return { ok: 'two2' }; },
  single_stage: () => { calls.push('single2'); return { ok: 'single2' }; },
  inactive: () => { calls.push('inactive2'); return { ok: 'inactive2' }; }
});
expect(resultSingle && resultSingle.ok === 'single2', 'single_stage should return single handler result');

const resultInactive = sandbox.belle_ocr_worker_dispatchByPipelineKind_('inactive', {
  two_stage: () => { calls.push('two3'); return { ok: 'two3' }; },
  single_stage: () => { calls.push('single3'); return { ok: 'single3' }; },
  inactive: () => { calls.push('inactive3'); return { ok: 'inactive3' }; }
});
expect(resultInactive && resultInactive.ok === 'inactive3', 'inactive should return inactive handler result');

expect(calls.join(',') === 'two,single2,inactive3', 'unexpected dispatch call order: ' + calls.join(','));

console.log('OK: test_ocr_worker_dispatch_parity');
