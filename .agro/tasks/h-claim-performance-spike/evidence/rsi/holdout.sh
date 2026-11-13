#!/usr/bin/env bash
set -uo pipefail
STATE=${RSI_STATE:?RSI_STATE must name the run state directory}
test -s "$STATE/last/usable.json" || { echo "holdout: no metric reading" >&2; exit 1; }
python3 -I - "$STATE/last/usable.json" <<'PY'
import json, math, sys
values = sorted(json.load(open(sys.argv[1])))
rank = max(1, math.ceil(0.9 * len(values)))
print(f"{values[rank - 1]:.3f}")
PY
