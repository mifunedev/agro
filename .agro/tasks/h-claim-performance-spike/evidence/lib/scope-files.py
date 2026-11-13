import glob
import json
import os
import sys

E = sys.argv[1]
ITEMS = ("home", "git_workspace", "filler", "docker_images", "containers", "volumes", "apt_package")
for arm in ("a", "v"):
    for path in sorted(glob.glob(os.path.join(E, "runs", f"e6-{arm}-1g-*.json"))):
        if path.endswith(".state.json"):
            continue
        run = json.load(open(path))
        if run.get("valid") is True and not run.get("failed") and isinstance(run.get("scope"), dict):
            break
    else:
        print(f"no valid e6 {arm} 1g run with a scope")
        continue
    scope = {item: run["scope"].get(item, "lost") for item in ITEMS}
    json.dump(scope, open(os.path.join(E, f"scope-{arm.upper()}.json"), "w"), indent=1)
    rows = "\n".join(f"| `{item}` | {run['scope_before'].get(item)} | {scope[item]} |" for item in ITEMS)
    md = (f"# Scope after restore: arm {arm.upper()}\n\n"
          f"Source: `runs/{os.path.basename(path)}` (first valid e6 {arm} 1g run, node `{run['node_id']}`).\n\n"
          f"| Seeded item | Before pause | After restore |\n|---|---|---|\n{rows}\n")
    open(os.path.join(E, f"scope-{arm.upper()}.md"), "w").write(md)
    print(arm, os.path.basename(path), json.dumps(scope))
