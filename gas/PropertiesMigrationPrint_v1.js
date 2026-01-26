// @ts-check

// NOTE: Keep comments ASCII only.

function belle_properties_migration_sanitizeReport_(report) {
  if (!report || typeof report !== "object") return report;
  const out = {};
  if (typeof report.preview === "boolean") out.preview = report.preview;
  if (report.legacy && typeof report.legacy === "object") out.legacy = report.legacy;
  if (report.canonical && typeof report.canonical === "object") out.canonical = report.canonical;
  if (Array.isArray(report.recommendations)) {
    out.recommendations = report.recommendations.map(function (item) {
      return {
        legacyKey: String(item && item.legacyKey ? item.legacyKey : ""),
        canonicalKey: String(item && item.canonicalKey ? item.canonicalKey : ""),
        action: String(item && item.action ? item.action : "")
      };
    });
  }
  if (Array.isArray(report.copied)) {
    out.copied = report.copied.map(function (item) {
      return {
        from: String(item && item.from ? item.from : ""),
        to: String(item && item.to ? item.to : "")
      };
    });
  }
  if (Array.isArray(report.deleted)) {
    out.deleted = report.deleted.map(function (key) {
      return String(key || "");
    });
  }
  if (Array.isArray(report.skipped)) {
    out.skipped = report.skipped.map(function (key) {
      return String(key || "");
    });
  }
  if (Array.isArray(report.errors)) {
    out.errors = report.errors.map(function (item) {
      return {
        key: String(item && item.key ? item.key : ""),
        message: "<redacted>"
      };
    });
  }
  return out;
}

function belle_properties_migration_logReport_(report) {
  const safe = belle_properties_migration_sanitizeReport_(report);
  const payload = JSON.stringify(safe);
  try {
    if (typeof Logger !== "undefined" && Logger && Logger.log) Logger.log(payload);
  } catch (e) {}
  try {
    if (typeof console !== "undefined" && console && console.log) console.log(payload);
  } catch (e) {}
  return safe;
}

function belle_doctor_properties_canonical_v1_print() {
  const report = belle_doctor_properties_canonical_v1();
  return belle_properties_migration_logReport_(report);
}

function belle_migrate_properties_to_canonical_v1_preview_print() {
  const report = belle_migrate_properties_to_canonical_v1({});
  return belle_properties_migration_logReport_(report);
}
