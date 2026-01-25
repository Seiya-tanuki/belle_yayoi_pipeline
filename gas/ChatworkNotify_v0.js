// @ts-check

// NOTE: Keep comments ASCII only.

function belle_chatwork_parseBool(value, defaultValue) {
  if (value === true || value === false) return value;
  const s = String(value || "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

function belle_chatwork_previewValue_(value) {
  try {
    return JSON.stringify(value).slice(0, 200);
  } catch (e) {
    return String(value).slice(0, 200);
  }
}

function belle_chatwork_requireString_(message, context) {
  if (typeof message !== "string") {
    throw new Error(
      "CHATWORK_MESSAGE_NOT_STRING:" +
        String(context || "UNKNOWN") +
        ":type=" +
        typeof message +
        ":value=" +
        belle_chatwork_previewValue_(message)
    );
  }
  return message;
}

function belle_chatwork_buildPayload(message) {
  const msg = belle_chatwork_requireString_(message, "CHATWORK_MESSAGE");
  return "body=" + encodeURIComponent(msg);
}

function belle_chatwork_buildLatestCsvMessage_(fileName) {
  return "最新のcsvファイルです: " + String(fileName || "");
}

function belle_chatwork_sendMessage(message, opts) {
  belle_chatwork_requireString_(message, "CHATWORK_MESSAGE");
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
  belle_chatwork_requireString_(message, "CHATWORK_FILE_MESSAGE");
  const token = opts && opts.token ? String(opts.token) : "";
  const roomId = opts && opts.roomId ? String(opts.roomId) : "";
  const url = "https://api.chatwork.com/v2/rooms/" + encodeURIComponent(roomId) + "/files";

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    payload: {
      message: message,
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

