from pathlib import Path
import sys
path = Path(sys.argv[1])
old = sys.argv[2]
new = sys.argv[3]
text = path.read_text()
count = text.count(old)
if count != 1:
    raise SystemExit(f"replacement match count={count}, expected=1: {old!r}")
path.write_text(text.replace(old, new))
