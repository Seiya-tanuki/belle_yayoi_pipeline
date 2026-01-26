const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/PropertiesMigration_v1.js', 'utf8');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildProps(initial) {
  const store = Object.assign({}, initial || {});
  return {
    __store: store,
    getProperties: () => Object.assign({}, store),
    getProperty: (key) => store[key] || '',
    setProperty: (key, value) => {
      store[key] = String(value);
    },
    deleteProperty: (key) => {
      delete store[key];
    }
  };
}

function buildSandbox(props) {
  const sandbox = {
    console,
    PropertiesService: {
      getScriptProperties: () => props
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

// S1: legacy present, canonical missing -> copy and delete.
{
  const props = buildProps({
    BELLE_CC_STAGE1_GENCFG_JSON: 'SECRET_CC_STAGE1'
  });
  const sandbox = buildSandbox(props);
  const doctor = sandbox.belle_doctor_properties_canonical_v1();
  const rec = doctor.recommendations.find((entry) => entry.legacyKey === 'BELLE_CC_STAGE1_GENCFG_JSON');
  expect(rec && rec.action === 'copy', 'doctor should recommend copy when canonical missing');

  const report = sandbox.belle_migrate_properties_to_canonical_v1({ confirm: 'MIGRATE' });
  expect(report.preview === false, 'migrate should not be preview when confirmed');
  expect(report.copied.some((item) => item.from === 'BELLE_CC_STAGE1_GENCFG_JSON' && item.to === 'BELLE_OCR_GENCFG_JSON__cc_statement__stage1'), 'should copy legacy to canonical');
  expect(report.deleted.includes('BELLE_CC_STAGE1_GENCFG_JSON'), 'should delete legacy after copy');
  expect(props.__store.BELLE_OCR_GENCFG_JSON__cc_statement__stage1 === 'SECRET_CC_STAGE1', 'canonical value should be set');
  expect(props.__store.BELLE_CC_STAGE1_GENCFG_JSON === undefined, 'legacy key should be deleted');
  expect(JSON.stringify(report).indexOf('SECRET_CC_STAGE1') === -1, 'report should not leak values');
}

// S2: canonical present, legacy present -> skip; delete legacy only if deleteLegacy true.
{
  const props = buildProps({
    BELLE_CC_STAGE2_GENCFG_JSON: 'SECRET_CC_STAGE2',
    BELLE_OCR_GENCFG_JSON__cc_statement__stage2: 'CANON_CC_STAGE2'
  });
  const sandbox = buildSandbox(props);
  const report = sandbox.belle_migrate_properties_to_canonical_v1({ confirm: 'MIGRATE' });
  expect(report.skipped.includes('BELLE_CC_STAGE2_GENCFG_JSON'), 'should skip when canonical exists');
  expect(props.__store.BELLE_CC_STAGE2_GENCFG_JSON === 'SECRET_CC_STAGE2', 'legacy should remain without deleteLegacy');

  const reportDelete = sandbox.belle_migrate_properties_to_canonical_v1({ confirm: 'MIGRATE', deleteLegacy: true });
  expect(reportDelete.deleted.includes('BELLE_CC_STAGE2_GENCFG_JSON'), 'deleteLegacy should remove legacy key');
  expect(props.__store.BELLE_CC_STAGE2_GENCFG_JSON === undefined, 'legacy key should be deleted with deleteLegacy');
  expect(JSON.stringify(reportDelete).indexOf('SECRET_CC_STAGE2') === -1, 'report should not leak values');
}

// S3: confirm missing -> preview only, no changes.
{
  const props = buildProps({
    BELLE_SHEET_NAME: 'SECRET_SHEET'
  });
  const sandbox = buildSandbox(props);
  const report = sandbox.belle_migrate_properties_to_canonical_v1({});
  expect(report.preview === true, 'missing confirm should be preview');
  expect(report.copied.length === 1, 'preview should report copy action');
  expect(props.__store.BELLE_QUEUE_SHEET_NAME === undefined, 'preview should not set canonical value');
  expect(props.__store.BELLE_SHEET_NAME === 'SECRET_SHEET', 'preview should not delete legacy value');
  expect(JSON.stringify(report).indexOf('SECRET_SHEET') === -1, 'report should not leak values');
}

console.log('OK: test_properties_migration_v1');