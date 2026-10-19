#!/bin/bash
# 构建 + 语法自检
set -u
cd "/Users/xlyang/Documents/appZoo/豆藏"
echo "=== VITE BUILD ==="
./node_modules/.bin/vite build 2>&1 | tail -8
echo "=== SYNTAX ==="
for f in electron/main.mjs electron/preload.cjs electron/localServer.cjs electron/productParser.cjs electron/labelParser.cjs electron/excelExport.cjs electron/printTemplate.cjs electron/notifier.cjs electron/ocr/ocrBridge.cjs src/lib/calc.cjs src/lib/calc.js src/lib/stats.js src/lib/shareCard.js src/lib/schema.mjs extension/background.js; do
  node --check "$f" >/dev/null 2>&1 && echo "ok   $f" || echo "FAIL $f"
done
echo "=== REQUIRE ==="
node -e "
for (const n of ['./electron/productParser.cjs','./electron/labelParser.cjs','./electron/excelExport.cjs','./electron/printTemplate.cjs','./electron/notifier.cjs','./electron/localServer.cjs','./electron/ocr/ocrBridge.cjs','./src/lib/calc.cjs']) {
  const m = require(n); console.log('ok  ', n, Object.keys(m).length + ' exports');
}
"
echo DONE
