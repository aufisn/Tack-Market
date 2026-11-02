#!/bin/sh
# Builds the standalone single-file game from src/: sh build.sh
# Writes index.html (served by GitHub Pages) and TackMarket-V3.html (an identical copy to download and open directly).
set -e
cd "$(dirname "$0")"
OUT=index.html
JS="src/engine.js src/broker.js src/analytics.js src/bots.js src/game.js src/help.js src/ui.js"
if grep -n '</script' $JS; then echo "error: '</script' found in JS source" >&2; exit 1; fi
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    '/*@@CSS@@*/') cat src/style.css ;;
    '/*@@JS@@*/') for f in $JS; do cat "$f"; echo; done ;;
    *) printf '%s\n' "$line" ;;
  esac
done < src/shell.html > "$OUT"
cp "$OUT" TackMarket-V3.html
echo "built $OUT and TackMarket-V3.html ($(wc -c < "$OUT" | tr -d ' ') bytes)"
