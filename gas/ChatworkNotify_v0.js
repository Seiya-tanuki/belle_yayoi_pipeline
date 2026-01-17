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
