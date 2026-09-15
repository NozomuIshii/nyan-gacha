/* CSS の括弧の対応と、閉じ忘れたメディアクエリを検出する */
import fs from "node:fs";
const src = fs.readFileSync("src/NyanGachaSimulator.jsx", "utf8");
const m = src.match(/const CSS = `([\s\S]*?)`;/);
if (!m) { console.error("CSS ブロックが見つかりません"); process.exit(1); }
const css = m[1];
const errors = [];
let depth = 0, line = 1;
const openLines = [];
for (const ch of css) {
  if (ch === "\n") line++;
  else if (ch === "{") { depth++; openLines.push(line); }
  else if (ch === "}") {
    depth--; openLines.pop();
    if (depth < 0) errors.push(line + " 行目: 対応しない } があります");
  }
}
if (depth > 0) errors.push("閉じ括弧が " + depth + " 個不足（開始位置: " + openLines.join(", ") + " 行目付近）");
depth = 0; line = 1;
for (let i = 0; i < css.length; i++) {
  const ch = css[i];
  if (ch === "\n") line++;
  else if (ch === "{") depth++;
  else if (ch === "}") depth--;
  if (css.startsWith("@media", i) && depth !== 0)
    errors.push(line + " 行目: @media が入れ子になっています（閉じ忘れの可能性）");
}
if (errors.length) { console.error("CSS エラー:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("CSS の括弧は正常です");
