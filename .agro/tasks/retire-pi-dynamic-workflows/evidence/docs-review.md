# Documentation review

## Changed files

| File | Change |
|---|---|
| `docs/integrations/pi-dynamic-workflows.md` | Deleted. The dedicated integration page is gone. |
| `docs/README.md` | Removed the Integrations list link to the deleted page. |
| `docs/harnesses/pi.md` | Removed the default-package bullet. Removed the package from the `pi -e ...` example sentence and kept the other five packages. Replaced the `## Dynamic workflows` section with one `## Dynamic workflow retirement` migration note. |
| `docs/installation.md` | Removed the package from the defaults sentence and kept the other listed packages. |
| `docs/integrations/pi-fff.md` | Rewrote the sentence so it states the package-pin approach without citing the retired package as the example. |
| `CHANGELOG.md` | Added one `### Removed` entry under `## [Unreleased]`. The historical entry that records the original addition is unchanged. |

## Migration note content

The note in `docs/harnesses/pi.md` states three facts:

1. `/delegate` is the bounded delegation procedure over the Pi `Agent` tools.
2. A running Pi session keeps the tool until reload or restart.
3. A global installation or an explicit `pi -e` argument also registers the tool, so removing the project pin does not remove every registration source.

The note claims no live removal and bans no operator-managed installation.

## Local link check

A link scan over `docs/**/*.md`, `README.md`, and `CHANGELOG.md` finds no link to the deleted page.
Two broken links remain in unrelated files and predate this change; `references.txt` lists them.
