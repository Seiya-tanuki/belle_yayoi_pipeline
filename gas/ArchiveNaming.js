// @ts-check

// NOTE: Keep comments ASCII only.

function belle_archive_getJstStamp_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
}

function belle_archive_buildName_(suffix) {
  var key = String(suffix || "").trim().toLowerCase();
  if (!key) key = "archive";
  return "belle_yayoi_" + key + "_" + belle_archive_getJstStamp_();
}
