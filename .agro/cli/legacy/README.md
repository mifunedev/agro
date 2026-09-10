# @mifune/openharness

The compatibility entry point for the AGRO CLI. This package is deprecated.
Install the canonical package instead:

```bash
npm install -g @mifune/agro
```

`@mifune/openharness` ships one file, `bin/oh.js`, which imports the `agro`
bundle from its pinned `@mifune/agro` dependency. It contains no CLI code of its
own. `oh` from this package and `agro` from `@mifune/agro` run the same bundle;
only the invoked name differs, and `oh --help` says so on its last line.

## Coexistence

- The two packages expose disjoint executables: this package installs only `oh`;
  `@mifune/agro` installs only `agro`.
- Installing or uninstalling either package never removes the other's executable.
- Each release pins the exact `@mifune/agro` version this package delegates to, so
  `oh --version` and `agro --version` from the same release agree.

## License

Apache-2.0. See `NOTICE`.
