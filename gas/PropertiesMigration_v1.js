// @ts-check

// NOTE: Keep comments ASCII only.

function belle_properties_migration_getMappings_() {
  return [
    {
      legacyKey: "BELLE_CC_STAGE1_GENCFG_JSON",
      canonicalKey: "BELLE_OCR_GENCFG_JSON__cc_statement__stage1"
    },
    {
      legacyKey: "BELLE_CC_STAGE2_GENCFG_JSON",
      canonicalKey: "BELLE_OCR_GENCFG_JSON__cc_statement__stage2"
    },
    {
      legacyKey: "BELLE_BANK_STAGE2_GENCFG_JSON",
      canonicalKey: "BELLE_OCR_GENCFG_JSON__bank_statement__stage1"
    },
    {
      legacyKey: "BELLE_SHEET_NAME",
      canonicalKey: "BELLE_QUEUE_SHEET_NAME"
    },
    {
      legacyKey: "BELLE_OCR_CLAIM_CURSOR",
      canonicalKey: "BELLE_OCR_CLAIM_CURSOR__receipt"
    }
  ];
}

function belle_properties_migration_hasValue_(value) {
  if (value === null || value === undefined) return false;
  return String(value) !== "";
}

function belle_doctor_properties_canonical_v1() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const mappings = belle_properties_migration_getMappings_();
  const legacy = {};
  const canonical = {};
  const recommendations = [];

  for (let i = 0; i < mappings.length; i++) {
    const entry = mappings[i];
    const legacyPresent = belle_properties_migration_hasValue_(all[entry.legacyKey]);
    const canonicalPresent = belle_properties_migration_hasValue_(all[entry.canonicalKey]);
    legacy[entry.legacyKey] = legacyPresent;
    canonical[entry.canonicalKey] = canonicalPresent;
    let action = "none";
    if (legacyPresent && !canonicalPresent) action = "copy";
    else if (legacyPresent && canonicalPresent) action = "skip";
    recommendations.push({
      legacyKey: entry.legacyKey,
      canonicalKey: entry.canonicalKey,
      action: action
    });
  }

  return {
    legacy: legacy,
    canonical: canonical,
    recommendations: recommendations
  };
}

function belle_migrate_properties_to_canonical_v1(opt) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const mappings = belle_properties_migration_getMappings_();
  const confirm = opt && opt.confirm === "MIGRATE";
  const deleteLegacy = !!(opt && opt.deleteLegacy === true);
  const report = {
    preview: !confirm,
    copied: [],
    deleted: [],
    skipped: [],
    errors: []
  };

  for (let i = 0; i < mappings.length; i++) {
    const entry = mappings[i];
    const legacyValue = all[entry.legacyKey];
    const canonicalValue = all[entry.canonicalKey];
    const legacyPresent = belle_properties_migration_hasValue_(legacyValue);
    const canonicalPresent = belle_properties_migration_hasValue_(canonicalValue);

    if (!legacyPresent) {
      report.skipped.push(entry.legacyKey);
      continue;
    }

    if (canonicalPresent) {
      report.skipped.push(entry.legacyKey);
      if (confirm && deleteLegacy) {
        try {
          props.deleteProperty(entry.legacyKey);
          report.deleted.push(entry.legacyKey);
        } catch (err) {
          report.errors.push({ key: entry.legacyKey, message: String(err && err.message ? err.message : err) });
        }
      }
      continue;
    }

    report.copied.push({ from: entry.legacyKey, to: entry.canonicalKey });
    if (!confirm) continue;
    try {
      props.setProperty(entry.canonicalKey, String(legacyValue));
      props.deleteProperty(entry.legacyKey);
      report.deleted.push(entry.legacyKey);
    } catch (err) {
      report.errors.push({ key: entry.legacyKey, message: String(err && err.message ? err.message : err) });
    }
  }

  return report;
}