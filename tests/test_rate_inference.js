const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync("gas/DocTypeRegistry.js", "utf8") + "\n"
  + fs.readFileSync("gas/YayoiExport.js", "utf8");
const context = {};
vm.runInNewContext(code, context, { filename: "YayoiExport.js" });

const sample = JSON.parse(fs.readFileSync("tests/fixtures/sample_2.json", "utf8"));
if (!context.belle_yayoi_determineSingleRate) {
  throw new Error("belle_yayoi_determineSingleRate not found");
}

const info = context.belle_yayoi_determineSingleRate(sample);
if (info.rate !== 10) {
  throw new Error("Expected rate 10, got " + JSON.stringify(info));
}

console.log("OK: rate=10", info);

