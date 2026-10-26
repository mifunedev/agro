# Manual review: agro node create profile and app flags (#1437)

These steps prove the `--profile`, `--docker`, `--t3`, and `--code-server` flags of `agro node create`. No step creates a console node. No step calls a live console API. No step starts a server. No step creates a resource, so no step needs cleanup.

The outputs below come from observed runs at commit `b47252bef85099d8fdf0820dd7d8da097f3fc05b` with Node v24.22.0.

**A. The help shows the new usage line**

Prerequisites: a checkout of the AGRO harness with the `.agro/cli` dependencies installed. Runs in the sandbox, local.

1. Build the CLI:

   ```bash
   npm --prefix .agro/cli run build
   ```

   Observed output ends with:

   ```text
     dist/agro.js  316.6kb

   ⚡ Done in 21ms
   ```

   Exit status: 0.

2. Print the help of `agro node`:

   ```bash
   node .agro/cli/dist/agro.js node --help
   ```

   Observed output:

   ```text
   agro node — Create, list, and delete agro-console sandbox nodes (remote VMs)

   Usage:
     agro node create --spec <spec> [--profile agro|sandbox] [--docker] [--t3] [--code-server] [--ssh-key <uuid>]... [--name <name>] [--free-tier] [--json]
     agro node list [--json]
     agro node delete <id> [--yes]

   `create` waits up to 15 minutes for the node to reach `running`, then prints
   its SSH command. `--free-tier` requests the console free tier. The spec
   defaults to n4. `--profile` sets the node profile. The profile defaults to
   sandbox. `--docker` turns on Docker. `--t3` turns on T3. `--code-server`
   turns on code-server. Each app flag requires `--profile agro`. When
   AGRO_CONSOLE_TOKEN is set, the verbs use it with AGRO_CONSOLE_URL. Otherwise
   the verbs use the token and the URL from the credentials file that
   `agro auth login` writes. The URL defaults to https://console.mifune.dev.
   ```

   Exit status: 0.

**B. The CLI rejects a bad flag before any API call**

Prerequisites: the build from step A1. Runs in the sandbox, local. `AGRO_CONSOLE_URL` points at `http://127.0.0.1:9`. No service listens on that port. If the CLI sends a request, the output shows `request failed` instead of the flag error.

1. Failure path. Request a profile that the CLI does not accept:

   ```bash
   AGRO_CONSOLE_TOKEN=dummy AGRO_CONSOLE_URL=http://127.0.0.1:9 node .agro/cli/dist/agro.js node create --spec n4 --ssh-key 00000000-0000-0000-0000-000000000000 --profile desktop
   ```

   Observed stderr:

   ```text
   agro node create: --profile must be agro or sandbox
   ```

   Exit status: 1.

2. Failure path. Request T3 with the default profile:

   ```bash
   AGRO_CONSOLE_TOKEN=dummy AGRO_CONSOLE_URL=http://127.0.0.1:9 node .agro/cli/dist/agro.js node create --spec n4 --ssh-key 00000000-0000-0000-0000-000000000000 --t3
   ```

   Observed stderr:

   ```text
   agro node create: --t3 requires --profile agro
   ```

   Exit status: 1.

3. Control. Run the same command with a valid profile and no app flag. This command passes the flag checks and sends a request to the unreachable port:

   ```bash
   AGRO_CONSOLE_TOKEN=dummy AGRO_CONSOLE_URL=http://127.0.0.1:9 node .agro/cli/dist/agro.js node create --spec n4 --ssh-key 00000000-0000-0000-0000-000000000000 --profile sandbox
   ```

   Observed stderr:

   ```text
   agro node create: request failed: fetch failed
   ```

   Exit status: 1. Steps B1 and B2 do not show `request failed`, so they send no request.

**C. The posted request bodies in the stubbed test run**

Prerequisites: a checkout of the AGRO harness with the dependencies installed. Runs in the sandbox, local. The test harness replaces `fetch` with a stub that records each request body (`.agro/cli/src/__tests__/node.test.ts:129-143`). The stub sends no network request.

1. Run the node tests:

   ```bash
   npx vitest run .agro/cli/src/__tests__/node.test.ts --reporter=verbose
   ```

   Observed output, trimmed to the tests that assert the posted bodies and the summary:

   ```text
    ✓ .agro/cli/src/__tests__/node.test.ts > agro node create profile and app flags > posts only the sandbox profile, spec, and keys without a new flag 0ms
    ✓ .agro/cli/src/__tests__/node.test.ts > agro node create profile and app flags > posts docker, t3, and codeServerEnabled with all app flags 0ms
    ✓ .agro/cli/src/__tests__/node.test.ts > agro node create profile and app flags > rejects a profile other than agro or sandbox before any API call 0ms
    ✓ .agro/cli/src/__tests__/node.test.ts > agro node create profile and app flags > rejects --t3 with the default profile before key resolution 0ms

    Test Files  1 passed (1)
         Tests  61 passed (61)
   ```

   Exit status: 0.

2. Compare the bodies that the tests assert.

   The default profile. The command has no new flag. Source `.agro/cli/src/__tests__/node.test.ts:463-467`:

   ```ts
   it("posts only the sandbox profile, spec, and keys without a new flag", async () => {
     const h = harness([RUNNING]);
     expect(await runNode(BASE_CREATE, h.io, h.deps)).toBe(0);
     expect(h.calls[0].body).toEqual({ profile: "sandbox", spec: "n4", sshKeyIds: ["key-1"] });
   });
   ```

   `BASE_CREATE` is `["create", "--spec", "n4", "--ssh-key", "key-1"]` (`node.test.ts:454`). The posted body:

   ```json
   { "profile": "sandbox", "spec": "n4", "sshKeyIds": ["key-1"] }
   ```

   The agro profile with all app flags: `--profile agro --docker --t3 --code-server`. Source `.agro/cli/src/__tests__/node.test.ts:487-499`:

   ```ts
   it("posts docker, t3, and codeServerEnabled with all app flags", async () => {
     const h = harness([RUNNING]);
     const args = [...BASE_CREATE, "--profile", "agro", "--docker", "--t3", "--code-server"];
     expect(await runNode(args, h.io, h.deps)).toBe(0);
     expect(h.calls[0].body).toEqual({
       profile: "agro",
       spec: "n4",
       sshKeyIds: ["key-1"],
       docker: true,
       t3: true,
       runtimeSettings: { codeServerEnabled: true },
     });
   });
   ```

   The posted body:

   ```json
   {
     "profile": "agro",
     "spec": "n4",
     "sshKeyIds": ["key-1"],
     "docker": true,
     "t3": true,
     "runtimeSettings": { "codeServerEnabled": true }
   }
   ```

3. Failure path. The tests also assert that a rejected flag sends no request. Source `.agro/cli/src/__tests__/node.test.ts:507-512` and `:521-528`:

   ```ts
   expect(await runNode([...BASE_CREATE, "--profile", "desktop"], h.io, h.deps)).toBe(1);
   expect(h.stderr()).toContain("--profile must be agro or sandbox");
   expect(h.calls).toHaveLength(0);
   ```

   ```ts
   expect(await runNode(["create", "--spec", "n4", flag], h.io, h.deps)).toBe(1);
   expect(h.stderr()).toContain(`${flag} requires --profile agro`);
   expect(files.reads).toEqual([]);
   expect(h.calls).toHaveLength(0);
   ```

   Each rejected command exits 1, and the stub records no request.
