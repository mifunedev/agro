# Manual review evidence: random sandbox password

The advisor ran the `remote-sandbox` driver on 2026-10-10 with operator approval. The driver created a new exe.dev VM, ran one check, and destroyed the VM. The log ends with `remaining agro-matrix resources on exedev: 0` and `RUN DONE`. The check never printed the password. Each value below is a length, a status, or a hash prefix.

## Environment

- Host: Ubuntu 24.04.5 LTS, Docker 29.1.3, Node.js v24.21.0.
- Build under test: a clone of `feat/1379-random-sandbox-password` at `f1c4550`. The check built the CLI from the clone and ran `agro sandbox install docker --checkout <clone>`, so the image came from the branch.

## Steps

Prerequisites: an exe.dev account key on the driver host. Runs on the driver host. The check runs in the remote VM.

1. Install a Docker sandbox from the branch:

   ```bash
   node .agro/cli/dist/agro.js sandbox install docker --name pw-review --checkout "$HOME/agro" --yes
   ```

   Output ends with `next: agro shell pw-review`. Exit status: 0, after 70 seconds. The container health became `healthy`.

2. Read the generated password:

   ```bash
   node .agro/cli/dist/agro.js secret get SANDBOX_PASSWORD --sandbox pw-review
   ```

   Exit status: 0. The value has 32 characters from the URL-safe base64 alphabet. Its SHA-256 prefix is `6f44bce1bf02`.

3. Use the value with `sudo` in the sandbox:

   ```bash
   printf '%s\n' "<generated value>" | docker exec -i -u sandbox pw-review sudo -S -k -p '' true
   ```

   Exit status: 0.

4. Failure path. Use the old default with `sudo`:

   ```bash
   printf 'test1234\n' | docker exec -i -u sandbox pw-review sudo -S -k -p '' true
   ```

   Output: `sudo: 1 incorrect password attempt`. Exit status: 1.

5. Check the password state: `docker exec pw-review passwd -S sandbox` reports status `P`.

6. Provision again: a second `agro sandbox install docker --name pw-review --checkout "$HOME/agro" --yes` exits 0. The SHA-256 prefix of `agro secret get SANDBOX_PASSWORD` stays `6f44bce1bf02`.

7. Failure path. Read a key outside the secret list:

   ```bash
   node .agro/cli/dist/agro.js secret get NOT_A_SECRET --sandbox pw-review
   ```

   Output: `NOT_A_SECRET is not a secret — non-secret settings live in agro.json; use `agro config set` instead`. Exit status: 1.

8. `agro secret list --sandbox pw-review` prints a redacted value: `SANDBOX_PASSWORD  <5 characters>***************************`. The raw value does not appear. The redaction shows the first five characters; this file masks them.

9. Cleanup: `agro destroy pw-review --yes` exits 0, and `agro sandbox list` no longer shows `pw-review`.
