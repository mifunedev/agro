hooked_preflight() { fake_preflight; }
hooked_create() { fake_create "$@"; }
hooked_exec() { fake_exec "$@"; }
hooked_destroy() { fake_destroy "$@"; }
hooked_list() { fake_list; }
hooked_row_ssh() { echo "RESULT R10-ssh-inbound PASS hook saw $1"; }
hooked_restart() { echo "restart $1" >>"$FAKE_STATE/restarted"; }
