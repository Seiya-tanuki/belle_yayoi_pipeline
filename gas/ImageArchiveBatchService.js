// @ts-check

// NOTE: Keep comments ASCII only.

function belle_image_archive_batch_parseCutoff_(props) {
  var p = props || belle_cfg_getProps_();
  var cutoffIso = String(p.getProperty("BELLE_LAST_EXPORT_RUN_AT_ISO") || "").trim();
  if (!cutoffIso) {
    return { ok: false, reason: "NO_EXPORT_RUN_TIMESTAMP", message: "Run Export Run before archiving images." };
  }
  var cutoff = new Date(cutoffIso);
  if (isNaN(cutoff.getTime())) {
    return { ok: false, reason: "INVALID_EXPORT_RUN_TIMESTAMP", message: "Invalid export run timestamp.", cutoff_iso: cutoffIso };
  }
  return { ok: true, cutoff: cutoff, cutoff_iso: cutoffIso };
}

function belle_image_archive_batch_getFolderById_(id, reason) {
  try {
    return { ok: true, folder: DriveApp.getFolderById(id) };
  } catch (e) {
    return { ok: false, reason: reason || "FOLDER_OPEN_FAILED", message: "Folder open failed." };
  }
}

function belle_image_archive_batch_getSubfolder_(parent, name) {
  var iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return null;
}

function belle_image_archive_batch_getOrCreateSubfolder_(parent, name) {
  var existing = belle_image_archive_batch_getSubfolder_(parent, name);
  if (existing) return { ok: true, folder: existing, created: false };
  try {
    return { ok: true, folder: parent.createFolder(name), created: true };
  } catch (e) {
    return { ok: false, reason: "ARCHIVE_SUBFOLDER_CREATE_FAILED", message: "Archive subfolder create failed." };
  }
}

function belle_image_archive_batch_run_() {
  var startMs = Date.now();
  var maxFiles = 200;
  var maxMs = 240 * 1000;
  var props = belle_cfg_getProps_();

  var cutoffRes = belle_image_archive_batch_parseCutoff_(props);
  if (!cutoffRes.ok) {
    return {
      ok: false,
      reason: cutoffRes.reason || "NO_EXPORT_RUN_TIMESTAMP",
      message: cutoffRes.message || "Missing export run timestamp.",
      data: { cutoff_iso: cutoffRes.cutoff_iso || "" }
    };
  }

  var driveRootId = belle_cfg_getString_(props, "BELLE_DRIVE_FOLDER_ID", { required: false, defaultValue: "" });
  if (!driveRootId) {
    return { ok: false, reason: "MISSING_DRIVE_FOLDER_ID", message: "Missing BELLE_DRIVE_FOLDER_ID.", data: null };
  }
  var archiveRootId = String(props.getProperty("BELLE_IMAGES_ARCHIVE_FOLDER_ID") || "").trim();
  if (!archiveRootId) {
    return {
      ok: false,
      reason: "IMAGES_ARCHIVE_FOLDER_ID_MISSING",
      message: "Missing BELLE_IMAGES_ARCHIVE_FOLDER_ID.",
      data: { cutoff_iso: cutoffRes.cutoff_iso }
    };
  }

  var sourceRootRes = belle_image_archive_batch_getFolderById_(driveRootId, "DRIVE_FOLDER_OPEN_FAILED");
  if (!sourceRootRes.ok) {
    return { ok: false, reason: sourceRootRes.reason, message: sourceRootRes.message, data: null };
  }
  var archiveRootRes = belle_image_archive_batch_getFolderById_(archiveRootId, "ARCHIVE_FOLDER_OPEN_FAILED");
  if (!archiveRootRes.ok) {
    return { ok: false, reason: archiveRootRes.reason, message: archiveRootRes.message, data: null };
  }

  var activeDocTypes = belle_ocr_getActiveDocTypes_(props);
  var movedByDocType = {};
  var missingSources = [];
  var totalMoved = 0;
  var limitHit = false;
  var timeHit = false;
  var remaining = false;

  function shouldStop_() {
    if (totalMoved >= maxFiles) {
      limitHit = true;
      return true;
    }
    if (Date.now() - startMs >= maxMs) {
      timeHit = true;
      return true;
    }
    return false;
  }

  outer: for (var i = 0; i < activeDocTypes.length; i++) {
    var docType = activeDocTypes[i];
    var spec = belle_docType_getSpec_(docType);
    if (!spec || !spec.source_subfolder_name) continue;
    var subfolderName = String(spec.source_subfolder_name || "");
    if (!subfolderName) continue;

    var sourceFolder = belle_image_archive_batch_getSubfolder_(sourceRootRes.folder, subfolderName);
    if (!sourceFolder) {
      missingSources.push(subfolderName);
      continue;
    }
    var archiveFolderRes = belle_image_archive_batch_getOrCreateSubfolder_(archiveRootRes.folder, subfolderName);
    if (!archiveFolderRes.ok) {
      return {
        ok: false,
        reason: archiveFolderRes.reason,
        message: archiveFolderRes.message,
        data: { subfolder: subfolderName }
      };
    }
    var archiveFolder = archiveFolderRes.folder;

    var files = sourceFolder.getFiles();
    while (files.hasNext()) {
      if (shouldStop_()) {
        remaining = true;
        break outer;
      }
      var file = files.next();
      var updated = file.getLastUpdated();
      if (!updated || updated.getTime() > cutoffRes.cutoff.getTime()) continue;
      try {
        file.moveTo(archiveFolder);
      } catch (e) {
        return {
          ok: false,
          reason: "MOVE_FAILED",
          message: "Failed to move image.",
          data: {
            doc_type: docType,
            file_id: file.getId ? file.getId() : "",
            name: file.getName ? file.getName() : ""
          }
        };
      }
      totalMoved++;
      movedByDocType[docType] = Number(movedByDocType[docType] || 0) + 1;
      if (shouldStop_()) {
        remaining = true;
        break outer;
      }
    }
  }

  var elapsedMs = Date.now() - startMs;
  return {
    ok: true,
    reason: "OK",
    message: "Image archive completed.",
    data: {
      cutoff_iso: cutoffRes.cutoff_iso,
      moved_total: totalMoved,
      moved_by_doc_type: movedByDocType,
      remaining: remaining,
      limit_hit: limitHit,
      time_hit: timeHit,
      missing_sources: missingSources,
      elapsed_ms: elapsedMs
    }
  };
}
