#!/bin/bash
# Aufruf: tests/run.sh            -> alle Tests
#         tests/run.sh e2e56 e2e58 -> einzelne Tests
# Voraussetzung: Node + Playwright (require('playwright')). Sync-Tests brauchen einen Klon des Repos "startseite"
# (Standard: /home/claude/thevizce/startseite, sonst START_DIR setzen; siehe syncharness.js).
cd "$(dirname "$0")" || exit 1
cp ../index.html Ranking.html; cp ../ranker-inbox.js .
list=("$@"); [ ${#list[@]} -eq 0 ] && list=($(ls e2e*.js | sed 's/\.js$//' | sort -V))
fail=0
for t in "${list[@]}"; do
  out=$(timeout 600 node "$t.js" 2>&1); code=$?
  bad=$(echo "$out" | grep -c "✘")
  if [ $code -ne 0 ] || [ "$bad" -gt 0 ]; then echo "FEHLER  $t (Exit $code, $bad ✘)"; fail=1; else echo "ok      $t"; fi
done
rm -f Ranking.html ranker-inbox.js
exit $fail
