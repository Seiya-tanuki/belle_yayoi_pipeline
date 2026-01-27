# PLAN_FALLBACK_EXPORT_v0

## 1. 閭梧勹縺ｨ逶ｮ逧・- 繧ｴ繝ｼ繝ｫ: 荳肴・轤ｹ縺後≠縺｣縺ｦ繧ょｿ・★CSV蛹悶＠縲∽ｿｮ豁｣縺ｯ蠑･逕溷・縺ｧ陦後≧縲・- 逶｣譟ｻ諤ｧ: file_id / drive_url / 逅・罰繧ｳ繝ｼ繝峨ｒ蠑･逕溷・縺ｧ隕九∴繧句ｽ｢縺ｧ谿九☆縲・
## 2. 迴ｾ陦鯉ｼ・eview-sheet-v0・峨・隕∫ｴ・- 繝代う繝励Λ繧､繝ｳ: belle_listFilesInFolder -> belle_queueFolderFilesToSheet -> belle_processQueueOnce -> belle_buildReviewFromDoneQueue -> belle_exportYayoiCsvFromReview
- 繧ｷ繝ｼ繝・ REVIEW_STATE / REVIEW_UI / REVIEW_LOG / EXPORT_LOG / EXPORT_SKIP_LOG

## 3. 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ蜆ｪ蜈育沿 v0 隕∽ｻｶ
- 荳肴・轤ｹ縺後≠縺｣縺ｦ繧・SV縺ｯ蠢・★蜃ｺ縺吶・- 蠑･逕溷・縺ｧ遒ｺ螳溘↓隴伜挨繝ｻ菫ｮ豁｣縺ｧ縺阪ｋ繧医≧縲［emo/鞫倩ｦ√↓逅・罰繧ｳ繝ｼ繝・+ file_id + file_name 繧呈ｮ九☆縲・- REVIEW_UI/REVIEW_STATE 縺ｯ蜴溷援菴ｿ繧上↑縺・婿驥晢ｼ育屮譟ｻ縺ｨ蜀榊ｮ溯｡梧紛蜷域ｧ縺ｯ邯ｭ謖・ｼ峨・
## 4. 蟾ｮ蛻・婿驥晢ｼ域ｮ九☆/鄂ｮ謠・蜑企勁・・- 谿九☆:
  - belle_queueFolderFilesToSheet / belle_processQueueOnce / EXPORT_LOG / EXPORT_SKIP_LOG
- 鄂ｮ謠・
  - belle_exportYayoiCsvFromReview 繧偵ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ蜆ｪ蜈医↓螟画峩
- 蜑企勁/辟｡蜉ｹ蛹・
  - REVIEW_UI 蜑肴署縺ｮ STRICT_BLOCKED 驕狗畑・医ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ縺ｧ縺ｯ荳崎ｦ・ｼ・- 蜈ｱ蟄俶｡・
  - BELLE_EXPORT_MODE = REVIEW | FALLBACK 繧定ｿｽ蜉縺励∝・蟯舌〒蜈ｱ蟄・
## 5. 螳溯｣・せ繝・ャ繝玲｡・1) export 髢｢謨ｰ縺ｮ蛻・ｲ占ｨｭ險茨ｼ・EVIEW/FALLBACK・・2) 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ逕ｨ縺ｮ memo/鞫倩ｦ∬ｨｭ險茨ｼ育炊逕ｱ繧ｳ繝ｼ繝峨・file_id繝ｻfile_name・・3) EXPORT_LOG / EXPORT_SKIP_LOG 縺ｮ蜃ｺ蜉帙Ν繝ｼ繝ｫ隱ｿ謨ｴ
4) REVIEW_STATE/REVIEW_UI 縺ｮ蜿ら・繧呈怙蟆丞喧
5) docs/WORKFLOW.md / docs/CONFIG.md 繧偵ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ驕狗畑縺ｫ謨ｴ逅・
## 6. 險ｭ螳夲ｼ・cript Properties・画｡・- 霑ｽ蜉譯・
  - BELLE_EXPORT_MODE (REVIEW|FALLBACK)
  - BELLE_FALLBACK_REASON_PREFIX (memo隴伜挨蟄・
- 譌｢蟄伜茜逕ｨ:
  - BELLE_CSV_ENCODING / BELLE_CSV_EOL
  - BELLE_OUTPUT_FOLDER_ID / BELLE_SKIP_LOG_SHEET_NAME

## 7. 逶｣譟ｻ繝ｭ繧ｰ/驕狗畑繝輔Ο繝ｼ
- EXPORT_LOG: 蜃ｺ蜉帶ｸ医∩陦後・蜀榊・蜉幃亟豁｢・・egacy IMPORT_LOG 縺ｯ謇句虚縺ｧ rename・・- EXPORT_SKIP_LOG: 縺昴ｌ縺ｧ繧ょ・蜉帑ｸ崎・縺ｪ萓句､悶□縺題ｨ倬鹸
- memo/鞫倩ｦ√↓ file_id / file_name / reason_code 繧貞ｿ・★谿九☆

## 8. 繝ｪ繧ｹ繧ｯ縺ｨ蟇ｾ遲・- 遞主玄蛻・・證ｫ螳壼､縺ｧ驕主､ｧ謗ｧ髯､縺ｮ諱舌ｌ:
  - 螳牙・蛛ｴ縺ｮ證ｫ螳壼､繧呈治逕ｨ縺励∫炊逕ｱ繧ｳ繝ｼ繝峨〒譏守､ｺ
- 蠑･逕溷・菫ｮ豁｣貍上ｌ:
- memo/鞫倩ｦ√↓隴伜挨蟄撰ｼ・ile_id / file_name・峨ｒ蠢・★谿九☆
- 繝医Ξ繝ｼ繧ｵ繝薙Μ繝・ぅ:
  - file_id -> CSV -> EXPORT_LOG 縺ｮ邏蝉ｻ倥￠繧堤ｶｭ謖・
## 9. 謇句虚繝・せ繝郁ｦｳ轤ｹ
1) 繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ繝｢繝ｼ繝峨〒 CSV 縺悟ｿ・★蜃ｺ繧九％縺ｨ
2) memo/鞫倩ｦ√↓ reason_code + file_id + file_name 縺梧ｮ九ｋ縺薙→
3) EXPORT_LOG 縺ｫ險倬鹸縺輔ｌ繧九％縺ｨ
4) EXPORT_SKIP_LOG 縺ｯ萓句､悶・縺ｿ險倬鹸縺輔ｌ繧九％縺ｨ

## 10. 谺｡繧ｿ繝ｼ繝ｳ螳溯｣・ｯｾ雎｡・井ｺ亥ｮ夲ｼ・- 螟画峩蟇ｾ雎｡繝輔ぃ繧､繝ｫ:
  - gas/Review_v0.js・・xport蛻・ｲ舌・霑ｽ蜉・・  - gas/Code.js・・unner縺ｮexport蛻ｶ蠕｡遒ｺ隱搾ｼ・  - docs/WORKFLOW.md / docs/CONFIG.md・医ヵ繧ｩ繝ｼ繝ｫ繝舌ャ繧ｯ驕狗畑・・- 霑ｽ蜉/螟画峩縺吶ｋ髢｢謨ｰ:
  - belle_exportYayoiCsvFromReview・・EVIEW/FALLBACK蛻・ｲ撰ｼ・  - fallback逕ｨ縺ｮreason/memo逕滓・繝倥Ν繝代・・亥錐遘ｰ縺ｯ螳溯｣・凾縺ｫ遒ｺ螳夲ｼ・