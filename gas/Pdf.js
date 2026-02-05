// @ts-check

// NOTE: Keep comments ASCII only.

function belle_pdf_countPages_(pdfBlob, out) {
  try {
    if (!pdfBlob || typeof pdfBlob.getBytes !== "function") return null;
    const bytes = pdfBlob.getBytes();
    if (!bytes || !bytes.length) return null;

    const countFromPages = belle_pdf_scanPagesCount_(bytes);
    if (countFromPages !== null) {
      if (out) {
        out.method = "byte_scan:pages_count";
        out.pagesCount = countFromPages;
      }
      return countFromPages;
    }

    const countFromType = belle_pdf_scanTypePageCount_(bytes);
    if (countFromType !== null) {
      if (out) {
        out.method = "byte_scan:type_page_count";
        out.typePageCount = countFromType;
      }
      return countFromType;
    }

    if (out) out.method = "byte_scan:none";
    return null;
  } catch (e) {
    if (out) out.error = String(e);
    return null;
  }
}

function belle_pdf_scanPagesCount_(bytes) {
  const tokens = ["/Type /Pages", "/Type/Pages"];
  for (let t = 0; t < tokens.length; t++) {
    const tokenBytes = belle_pdf_tokenToBytes_(tokens[t]);
    let idx = 0;
    while (idx <= bytes.length - tokenBytes.length) {
      const found = belle_pdf_findTokenIndex_(bytes, tokenBytes, idx);
      if (found < 0) break;
      const count = belle_pdf_findCountNear_(bytes, found + tokenBytes.length, found + tokenBytes.length + 256);
      if (count !== null && count >= 1) return count;
      idx = found + tokenBytes.length;
    }
  }
  return null;
}

function belle_pdf_scanTypePageCount_(bytes) {
  const typeToken = belle_pdf_tokenToBytes_("/Type");
  const pageToken = belle_pdf_tokenToBytes_("/Page");
  let count = 0;
  for (let i = 0; i <= bytes.length - typeToken.length; i++) {
    let match = true;
    for (let j = 0; j < typeToken.length; j++) {
      if (bytes[i + j] !== typeToken[j]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    let k = i + typeToken.length;
    while (k < bytes.length && belle_pdf_isSpaceByte_(bytes[k])) k++;
    if (k + pageToken.length > bytes.length) continue;
    let pageMatch = true;
    for (let j = 0; j < pageToken.length; j++) {
      if (bytes[k + j] !== pageToken[j]) {
        pageMatch = false;
        break;
      }
    }
    if (!pageMatch) continue;
    const nextByte = bytes[k + pageToken.length];
    if (nextByte === 0x73) continue; // "/Pages"
    count++;
    if (count >= 2) return count;
  }
  if (count === 1) return 1;
  return null;
}

function belle_pdf_findCountNear_(bytes, start, end) {
  const max = Math.min(end, bytes.length);
  const token = belle_pdf_tokenToBytes_("/Count");
  for (let i = start; i <= max - token.length; i++) {
    let match = true;
    for (let j = 0; j < token.length; j++) {
      if (bytes[i + j] !== token[j]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    let k = i + token.length;
    while (k < max && belle_pdf_isSpaceByte_(bytes[k])) k++;
    let numStr = "";
    while (k < max) {
      const b = bytes[k];
      if (b >= 0x30 && b <= 0x39) {
        numStr += String.fromCharCode(b);
        k++;
        continue;
      }
      break;
    }
    if (numStr) {
      const n = Number(numStr);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function belle_pdf_findTokenIndex_(bytes, tokenBytes, start) {
  for (let i = start; i <= bytes.length - tokenBytes.length; i++) {
    let match = true;
    for (let j = 0; j < tokenBytes.length; j++) {
      if (bytes[i + j] !== tokenBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function belle_pdf_tokenToBytes_(token) {
  const out = [];
  for (let i = 0; i < token.length; i++) out.push(token.charCodeAt(i));
  return out;
}

function belle_pdf_isSpaceByte_(b) {
  return b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d || b === 0x0c;
}

function belle_queue_checkPdfPageCount_(file, docType, sourceSubfolder) {
  if (!file || typeof file.getMimeType !== "function") return null;
  if (file.getMimeType() !== "application/pdf") return null;
  const info = {};
  const pageCount = belle_pdf_countPages_(file.getBlob && file.getBlob(), info);
  if (pageCount === 1) return null;
  const reason = pageCount ? "MULTI_PAGE_PDF" : "PDF_PAGECOUNT_UNKNOWN";
  const method = info && info.method ? info.method : "byte_scan:none";
  let detail = "method=" + method;
  if (pageCount) detail += " detected_page_count=" + pageCount;
  else detail += " detected_page_count=unknown";
  if (info && info.pagesCount !== undefined) detail += " pages_count=" + info.pagesCount;
  if (info && info.typePageCount !== undefined) detail += " type_page_count=" + info.typePageCount;
  if (info && info.error) {
    detail += " error=" + String(info.error).slice(0, 200);
  }
  const id = typeof file.getId === "function" ? file.getId() : "";
  return {
    file_id: id,
    file_name: typeof file.getName === "function" ? file.getName() : "",
    drive_url: id ? "https://drive.google.com/file/d/" + id + "/view" : "",
    reason: reason,
    detail: detail,
    doc_type: docType || "",
    source_subfolder: sourceSubfolder || ""
  };
}
