vercel_preflight() { : "${VERCEL_SCOPE:?set VERCEL_SCOPE to the Vercel team slug}"; vercel whoami >/dev/null 2>&1 && vercel sandbox list --scope "$VERCEL_SCOPE" >/dev/null 2>&1; }
vercel_create() { vercel sandbox create --scope "$VERCEL_SCOPE" --name "$1" --vcpus 2 --timeout 42m --non-persistent --tag "purpose=$MATRIX_TAG" 2>&1 | tail -2; }
vercel_exec() { local n=$1; shift; vercel sandbox exec "$n" --scope "$VERCEL_SCOPE" --timeout 2m -- bash -c "$*" 2>/dev/null | grep -v '^\$ \|^Vercel CLI'; return "${PIPESTATUS[0]}"; }
vercel_destroy() { vercel sandbox remove "$1" --scope "$VERCEL_SCOPE" 2>&1 | tail -1; }
vercel_list() { vercel sandbox list --scope "$VERCEL_SCOPE" 2>&1 | grep -c "purpose=$MATRIX_TAG" || true; }
vercel_row_ssh() { echo "RESULT R10-ssh-inbound FAIL API exec only, no standard SSH endpoint"; }
