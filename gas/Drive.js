// NOTE: Keep comments ASCII only.

/**
 * List files under BELLE_DRIVE_FOLDER_ID.
 * - Filters: image/* and application/pdf
 * - Read-only. No delete/move.
 */
function belle_listFilesInFolder() {
  const props = belle_cfg_getProps_();
  const folderId = belle_cfg_getDriveFolderIdOrThrow_(props);

  const folder = DriveApp.getFolderById(folderId);
  const defs = belle_getDocTypeDefs_();
  const activeDocTypes = belle_ocr_getActiveDocTypes_(props);
  const activeSet = {};
  for (let i = 0; i < activeDocTypes.length; i++) activeSet[activeDocTypes[i]] = true;

  const files = [];
  const filesByDocType = {};
  const skipped = [];

  const rootFiles = folder.getFiles();
  while (rootFiles.hasNext()) {
    const f = rootFiles.next();
    skipped.push({
      file_id: f.getId(),
      file_name: f.getName(),
      drive_url: "https://drive.google.com/file/d/" + f.getId() + "/view",
      reason: "ROOT_LEVEL_FILE",
      detail: "",
      doc_type: "",
      source_subfolder: ""
    });
  }

  const foldersByName = {};
  const unknownFolders = [];
  const folderIt = folder.getFolders();
  while (folderIt.hasNext()) {
    const sub = folderIt.next();
    const name = String(sub.getName() || "");
    const def = belle_ocr_getDocTypeDefBySubfolder_(name);
    if (def) {
      if (!foldersByName[name]) foldersByName[name] = [];
      foldersByName[name].push(sub);
    } else {
      unknownFolders.push(sub);
    }
  }

  for (let i = 0; i < unknownFolders.length; i++) {
    const sub = unknownFolders[i];
    skipped.push({
      file_id: sub.getId(),
      file_name: sub.getName(),
      drive_url: "https://drive.google.com/drive/folders/" + sub.getId(),
      reason: "UNKNOWN_SUBFOLDER",
      detail: "",
      doc_type: "",
      source_subfolder: sub.getName()
    });
  }

  const duplicateDocTypes = {};
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const list = foldersByName[def.subfolder] || [];
    if (list.length > 1) {
      duplicateDocTypes[def.docType] = true;
      const ids = [];
      for (let j = 0; j < list.length; j++) ids.push(list[j].getId());
      skipped.push({
        file_id: "",
        file_name: def.subfolder,
        drive_url: "",
        reason: "DUPLICATE_SUBFOLDER_NAME",
        detail: "count=" + list.length + " ids=" + ids.join(","),
        doc_type: def.docType,
        source_subfolder: def.subfolder
      });
    }
  }

  const inactiveDocTypes = {};
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const list = foldersByName[def.subfolder] || [];
    if (list.length > 0 && !activeSet[def.docType]) {
      inactiveDocTypes[def.docType] = true;
      skipped.push({
        file_id: list[0].getId(),
        file_name: list[0].getName(),
        drive_url: "https://drive.google.com/drive/folders/" + list[0].getId(),
        reason: "DOC_TYPE_INACTIVE",
        detail: "",
        doc_type: def.docType,
        source_subfolder: def.subfolder
      });
    }
  }

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (!activeSet[def.docType]) continue;
    if (duplicateDocTypes[def.docType]) continue;
    const list = foldersByName[def.subfolder] || [];
    if (list.length === 0) continue;
    const sub = list[0];
    const it = sub.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const mime = f.getMimeType();
      const isImage = mime && mime.indexOf("image/") === 0;
      const isPdf = mime === "application/pdf";
      if (!isImage && !isPdf) continue;
      if (isPdf) {
        const skipDetail = belle_queue_checkPdfPageCount_(f, def.docType, def.subfolder);
        if (skipDetail) {
          skipped.push(skipDetail);
          continue;
        }
      }
      const entry = {
        id: f.getId(),
        name: f.getName(),
        mimeType: mime,
        createdAt: f.getDateCreated() ? f.getDateCreated().toISOString() : null,
        url: "https://drive.google.com/file/d/" + f.getId() + "/view",
        doc_type: def.docType,
        source_subfolder: def.subfolder
      };
      files.push(entry);
      if (!filesByDocType[def.docType]) filesByDocType[def.docType] = [];
      filesByDocType[def.docType].push(entry);
    }
  }

  Logger.log({ ok: true, count: files.length });
  return { ok: true, count: files.length, files: files, filesByDocType: filesByDocType, skipped: skipped };
}
