#!/usr/bin/env bash
set -euo pipefail
OUT=${1:-${MATRIX_OUT:-$PWD/matrix-evidence}}
shopt -s nullglob
logs=("$OUT"/*-rows-*.log "$OUT"/*-restart-*.log)
[ ${#logs[@]} -gt 0 ] || { echo "no rows or restart logs in $OUT" >&2; exit 1; }
awk '
  FNR==1 { col=FILENAME; sub(/.*\//,"",col); sub(/\.log$/,"",col); cols[++nc]=col }
  /^== / && match($0,/image=[^ ]+/) { img[col]=substr($0,RSTART+6,RLENGTH-6) }
  /^RESULT / { id=$2; st=$3; if (!(id in seen)) { seen[id]=1; ids[++ni]=id }; cell[id,col]=st }
  END {
    printf "| Row |"; for (c=1;c<=nc;c++) printf " %s (%s) |", cols[c], img[cols[c]]; printf "\n|---|"; for (c=1;c<=nc;c++) printf "---|"; printf "\n"
    no=split("R13-time-to-shell R04-cgroup-delegation R02-workspace R02b-noninteractive-cli R03-docker-engine-host R01-docker R05-sandbox-boot R06-systemd R07-container-restart R08-vm-restart R09-disconnect R10-ssh-inbound R11-https-port R12-egress-tls R14-hermes-install", order, " ")
    for (i=1;i<=ni;i++) { known=0; for (k=1;k<=no;k++) if (order[k]==ids[i]) known=1; if (!known) order[++no]=ids[i] }
    for (i=1;i<=no;i++) { id=order[i]; if (!(id in seen)) continue; printf "| `%s` |", id; for (c=1;c<=nc;c++) { v=cell[id,cols[c]]; printf " %s |", (v==""?"-":v) }; printf "\n" }
  }' "${logs[@]}"
