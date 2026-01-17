// @ts-check

// NOTE: Keep comments ASCII only.

function belle_chatwork_parseBool(value, defaultValue) {
  if (value === true || value === false) return value;
  const s = String(value || "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

function belle_chatwork_buildPayload(message) {
  return "body=" + encodeURIComponent(String(message || ""));
}

function belle_chatwork_sendMessage(message, opts) {
  const token = opts && opts.token ? String(opts.token) : "";
  const roomId = opts && opts.roomId ? String(opts.roomId) : "";
  const url = "https://api.chatwork.com/v2/rooms/" + encodeURIComponent(roomId) + "/messages";
  const payload = belle_chatwork_buildPayload(message);

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: payload,
    headers: {
      "X-ChatWorkToken": token
    },
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const body = res.getContentText() || "";
  if (status >= 200 && status < 300) {
    let messageId = "";
    try {
      const j = JSON.parse(body);
      if (j && j.message_id) messageId = String(j.message_id);
    } catch (e) {
      // ignore parse errors
    }
    return { ok: true, phase: "CHATWORK_SEND", status: status, messageId: messageId, roomId: roomId };
  }

  return { ok: false, phase: "CHATWORK_SEND", status: status, body: body, reason: "CHATWORK_HTTP_ERROR", roomId: roomId };
}

function belle_chatworkSendTestMessage_v0_test() {
  const props = PropertiesService.getScriptProperties();
  const enabled = belle_chatwork_parseBool(props.getProperty("BELLE_CHATWORK_NOTIFY_ENABLED"), false);
  if (!enabled) {
    const res = { ok: true, skipped: true, reason: "CHATWORK_NOTIFY_DISABLED" };
    Logger.log(res);
    return res;
  }

  const token = props.getProperty("BELLE_CHATWORK_API_TOKEN");
  const roomId = props.getProperty("BELLE_CHATWORK_ROOM_ID");
  if (!token || !roomId) {
    const res = { ok: false, reason: "CHATWORK_CONFIG_MISSING" };
    Logger.log(res);
    return res;
  }

  const message = "[BELLE][TEST] Chatwork notify OK " + new Date().toISOString();
  const res = belle_chatwork_sendMessage(message, { token: token, roomId: roomId });
  Logger.log(res);
  return res;
}


function belle_chatwork_selectLatestCsvMeta(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let latest = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it) continue;
    const mime = String(it.mimeType || "");
    const name = String(it.name || "");
    const isCsv = mime === "text/csv" || /.csv$/i.test(name);
    if (!isCsv) continue;
    const createdAt = it.createdAt instanceof Date ? it.createdAt : new Date(it.createdAt);
    if (!createdAt || isNaN(createdAt.getTime())) continue;
    if (!latest || createdAt.getTime() > latest.createdAt.getTime()) {
      latest = { id: it.id, name: name, mimeType: mime, createdAt: createdAt };
    }
  }
  return latest;
}

function belle_chatwork_sendFile(message, fileBlob, opts) {
  const token = opts && opts.token ? String(opts.token) : "";
  const roomId = opts && opts.roomId ? String(opts.roomId) : "";
  const url = "https://api.chatwork.com/v2/rooms/" + encodeURIComponent(roomId) + "/files";

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    payload: {
      message: String(message || ""),
      file: fileBlob
    },
    headers: {
      "X-ChatWorkToken": token
    },
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const body = res.getContentText() || "";
  if (status >= 200 && status < 300) {
    let fileId = "";
    try {
      const j = JSON.parse(body);
      if (j && j.file_id) fileId = String(j.file_id);
    } catch (e) {
      // ignore parse errors
    }
    return { ok: true, phase: "CHATWORK_FILE", status: status, fileId: fileId, roomId: roomId };
  }
  return { ok: false, phase: "CHATWORK_FILE", status: status, body: body, reason: "CHATWORK_HTTP_ERROR", roomId: roomId };
}

function belle_chatwork_sendLatestCsv_test() {
  const props = PropertiesService.getScriptProperties();
  const enabled = belle_chatwork_parseBool(props.getProperty("BELLE_CHATWORK_NOTIFY_ENABLED"), false);
  if (!enabled) {
    const res = { ok: true, skipped: true, reason: "CHATWORK_NOTIFY_DISABLED" };
    Logger.log(res);
    return res;
  }

  const token = props.getProperty("BELLE_CHATWORK_API_TOKEN");
  const roomId = props.getProperty("BELLE_CHATWORK_ROOM_ID");
  const folderId = props.getProperty("BELLE_OUTPUT_FOLDER_ID");
  if (!token || !roomId || !folderId) {
    const res = { ok: false, reason: "CHATWORK_CONFIG_MISSING" };
    Logger.log(res);
    return res;
  }

  const folder = DriveApp.getFolderById(folderId);
  const it = folder.getFiles();
  const files = [];
  while (it.hasNext()) {
    const f = it.next();
    files.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: f.getMimeType(),
      createdAt: f.getDateCreated()
    });
  }

  const latest = belle_chatwork_selectLatestCsvMeta(files);
  if (!latest) {
    const msg = "???????CSV????????? (folderId=" + folderId + ")";
    const res = belle_chatwork_sendMessage(msg, { token: token, roomId: roomId });
    Logger.log(res);
    return res;
  }

  const message = "???csv??????: " + latest.name;
  const msgRes = belle_chatwork_sendMessage(message, { token: token, roomId: roomId });
  Logger.log(msgRes);
  if (!msgRes.ok) {
    throw new Error("CHATWORK_MESSAGE_FAILED");
  }

  const file = DriveApp.getFileById(latest.id);
  const fileRes = belle_chatwork_sendFile(message, file.getBlob(), { token: token, roomId: roomId });
  Logger.log({
    phase: "CHATWORK_LATEST_CSV",
    fileId: latest.id,
    fileName: latest.name,
    createdAt: latest.createdAt ? latest.createdAt.toISOString() : null,
    messageStatus: msgRes.status,
    fileStatus: fileRes.status
  });
  if (!fileRes.ok) {
    throw new Error("CHATWORK_FILE_FAILED");
  }
  return { ok: true, phase: "CHATWORK_LATEST_CSV", fileId: latest.id, fileName: latest.name, roomId: roomId };
}
