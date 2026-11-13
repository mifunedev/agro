import json
import os
import re
import sys

DROP = [
    re.compile(p) for p in (
        r"/ssh_host_", r"machine-id", r"(^|/)instance-id$", r"previous-instance-id", r"\.log(\.\d+)?$", r"/log/",
        r"token", r"/\.bash_history$", r"/\.lesshst$", r"/\.cache/motd", r"/\.sudo_as_admin_successful$",
    )
]
INSTANCE_DIR = re.compile(r"(/var/lib/cloud/instances/)[^/]+")
CONTENT_PER_INSTANCE = re.compile(r"^/var/lib/cloud/")


def sections(path):
    out, name = {}, None
    with open(path, errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("### "):
                name = line[4:]
                out[name] = []
            elif name and line.strip():
                out[name].append(line)
    return out


def norm_path(p):
    return INSTANCE_DIR.sub(r"\1<IID>", p)


def dropped(p):
    return any(r.search(p) for r in DROP)


def entries(dump):
    s = sections(dump)
    e = {}
    for line in s.get("dpkg", []):
        name, _, ver = line.partition(" ")
        e["pkg:" + name] = ver
    for kind in ("passwd", "group"):
        for line in s.get(kind, []):
            e[f"{kind}:{line.split(':', 1)[0]}"] = line
    for line in s.get("units", []):
        name, _, state = line.partition(" ")
        e["unit:" + name] = state
    for line in s.get("tree", []):
        parts = line.split(" ", 3)
        if len(parts) < 4 or dropped(parts[3]):
            continue
        e["node:" + norm_path(parts[3])] = " ".join(parts[:3])
    for line in s.get("files", []):
        digest, _, p = line.partition("  ")
        if not p or dropped(p):
            continue
        e["file:" + norm_path(p)] = "<per-instance>" if CONTENT_PER_INSTANCE.match(p) else digest
    agro = sorted(norm_path(p) for p in s.get("agro", []) if p and not dropped(p))
    return e, agro


def diff(x, base):
    out = {}
    for k in sorted(set(x) | set(base)):
        if k not in base:
            out[k] = "+ " + x[k]
        elif k not in x:
            out[k] = "- " + base[k]
        elif x[k] != base[k]:
            out[k] = f"~ {base[k]} -> {x[k]}"
    return out


def write(path, d):
    with open(path, "w") as f:
        for k, v in d.items():
            f.write(f"{k} {v}\n")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    cold, nprime, h = (entries(os.path.join(here, n, "dump.txt")) for n in ("cold", "nprime", "h"))
    floor = diff(nprime[0], cold[0])
    h_diff = diff(h[0], cold[0])
    extra = {k: v for k, v in h_diff.items() if k not in floor}
    agro_floor = set(nprime[1]) ^ set(cold[1])
    agro_extra = sorted((set(h[1]) ^ set(cold[1])) - agro_floor)
    write(os.path.join(here, "diff-nprime-vs-cold.txt"), floor)
    write(os.path.join(here, "diff-h-vs-cold.txt"), h_diff)
    write(os.path.join(here, "h-extra.txt"), extra)
    meta = {n: json.load(open(os.path.join(here, n, "node.json"))) for n in ("cold", "nprime", "h")}
    summary = {
        "h_extra_entries": len(extra),
        "h_extra": [f"{k} {v}" for k, v in extra.items()],
        "h_agro_files_extra": agro_extra,
        "noise_floor_entries": len(floor),
        "agro_files": {"cold": len(cold[1]), "nprime": len(nprime[1]), "h": len(h[1])},
        "h_equals_nprime_build": meta["h"]["pool_cloud_init_sha256"] == meta["nprime"]["pool_cloud_init_sha256"]
                                 and meta["h"]["pool_cloud_init_sha256"] is not None,
        "nodes": meta,
        "normalization": "dropped host keys, machine-id, instance-id, logs, tokens, shell history; /var/lib/cloud/instances/<id> -> <IID>; /var/lib/cloud file content treated as per-instance",
    }
    json.dump(summary, open(os.path.join(here, "summary.json"), "w"), indent=1)
    print(json.dumps({k: summary[k] for k in ("h_extra_entries", "h_agro_files_extra", "noise_floor_entries", "h_equals_nprime_build", "agro_files")}))


if __name__ == "__main__":
    main()
