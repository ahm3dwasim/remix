# OSS Report — remix-run/remix #11996

**Issue:** [New Remix 3 projects can't run any script on Windows: 'NODE_ENV' is not recognized](https://github.com/remix-run/remix/issues/11996)
**Status at pickup:** open, no assignee, no linked/related PR ("No branches or pull requests", "None yet"). Still free.

## FLAG: SMALL FIX

Self-contained scaffold fix: every generated project was unusable on Windows, but the root cause is a few npm-script lines plus one small entry file. No API or runtime behavior changes.

## Root cause (3 lines)

- The `remix new` template's `package.json` sets `NODE_ENV` with the POSIX prefix form `NODE_ENV=value node ...`.
- On Windows, npm runs scripts through `cmd.exe`, which parses the leading `NODE_ENV=...` token as a command name and aborts with `'NODE_ENV' is not recognized as an internal or external command`.
- So newly scaffolded projects fail every script (`dev`, `hmr`, `start`, `test`) on Windows while working on POSIX shells.

## Fix / diff summary

Smallest portable change that keeps the existing dev/prod/test behavior, with no new dependency (no `cross-env`):

- `template/package.json` — drop the POSIX `NODE_ENV=...` prefixes:
  - `dev`/`hmr` rely on the template's existing development default (`app/assets.ts` already does `process.env.NODE_ENV ?? 'development'`).
  - `test` relies on `remix test`, which already does `process.env.NODE_ENV ??= 'test'` (`packages/test/src/cli.ts`).
  - `start` now runs a new `start.ts` entry instead of `server.ts` directly.
- `template/start.ts` (new) — sets `process.env.NODE_ENV = 'production'` and then `await import('./server.ts')`. The assignment runs before the dynamic import, so `app/assets.ts` (which reads `NODE_ENV` at module-eval time) sees `production`. A plain statement in `server.ts` would not work: ESM evaluates static imports before the module body.
- `packages/cli/src/lib/cli.test.ts` — focused regression test: scaffold a project and assert no generated script starts with a `NAME=value` prefix, and that `start.ts` opts into production.
- `packages/cli/.changes/patch.windows-scaffold-scripts.md` — changelog entry per `CONTRIBUTING.md`.

The root `template/` is the source of truth; `scripts/sync-cli-template.ts` copies it into `packages/cli/template`, and `bootstrap-project.ts` copies every template file into the new app, so `start.ts` ships automatically with no manifest update.

```
 packages/cli/.changes/patch.windows-scaffold-scripts.md |  3 +++
 packages/cli/src/lib/cli.test.ts                        | 31 +++++++++++++++
 template/package.json                                   |  8 ++--
 template/start.ts                                       |  8 ++++
 4 files changed, 46 insertions(+), 4 deletions(-)
```

## Test commands and output

Environment: Node 24.22.1 (repo requires `>=24.3.0`; installed via nvm because the box defaulted to Node 22).

1. Reproduce (focused test against the unfixed template):
   ```
   pnpm exec remix test --concurrency 1 src/lib/cli.test.ts   # (in packages/cli)
   ```
   ```
   ✗ generates npm scripts that run on Windows
     Error: the "dev" script uses a POSIX-only inline environment variable:
            NODE_ENV=development node --watch --import remix/node-tsx server.ts
   ℹ tests 32  ℹ pass 31  ℹ fail 1
   ```

2. After the fix — focused file:
   ```
   ✓ generates npm scripts that run on Windows (14.63ms)
   ℹ tests 32  ℹ pass 32  ℹ fail 0
   ```

3. After the fix — full CLI package suite (`pnpm --filter @remix-run/cli run test`):
   ```
   ℹ files 20  ℹ suites 22  ℹ tests 240  ℹ pass 240  ℹ fail 0
   ```

4. Runtime proof of ESM ordering (ad-hoc): a `start.ts` that sets `NODE_ENV=production` then `await import`s a module printed `imported-module-sees: production`; a dev-style static import left `NODE_ENV` undefined and the module defaulted to `development`.

5. Lint / format / typecheck:
   ```
   pnpm exec oxfmt template/start.ts template/package.json packages/cli/src/lib/cli.test.ts --check   # All matched files use the correct format.
   pnpm exec oxlint template/start.ts packages/cli/src/lib/cli.test.ts --max-warnings=0               # 0 warnings, 0 errors
   pnpm --filter remix-template run typecheck                                                         # tsc --noEmit, clean
   pnpm --filter @remix-run/cli run typecheck                                                         # tsc --noEmit, clean
   pnpm changes:validate                                                                              # All change files are valid!
   ```

## Risks

- `dev`/`hmr` now leave `process.env.NODE_ENV` unset (previously `"development"`). The template's own code reads it only through the `?? 'development'` default, so behavior is identical; user code added later that strictly compares `=== 'development'` would differ. Low risk and consistent with the template's established default.
- Could not run the scripts on a real Windows machine; the fix follows directly from how `cmd.exe` handles the prefix, and the regression test guards the generated output on every platform.
- Demos and docs (`demos/*`, `docs/*`) in the monorepo use the same POSIX prefix but are internal packages run on Linux CI; left untouched to keep the change scoped to what users scaffold.

## Draft PR description

> **Title:** Generate cross-platform npm scripts in new projects
>
> **Summary**
>
> New projects created with `remix new` could not run any npm script on Windows. The scaffolded `package.json` set `NODE_ENV` with the POSIX prefix form (`NODE_ENV=development node ...`). npm runs scripts through `cmd.exe` on Windows, which treats the leading `NODE_ENV=...` as a command and fails with `'NODE_ENV' is not recognized as an internal or external command`. The same project works on Linux/macOS.
>
> **Fix**
>
> Set `NODE_ENV` portably instead of via an inline shell variable, with no new dependency:
> - `dev` and `hmr` rely on the development default already in `app/assets.ts` (`process.env.NODE_ENV ?? 'development'`).
> - `test` relies on `remix test`, which already defaults `NODE_ENV` to `test`.
> - `start` runs a new `start.ts` entry that sets `process.env.NODE_ENV = 'production'` before importing the server, so the asset pipeline still sees production mode.
>
> **Testing**
>
> Added a regression test in `packages/cli` that scaffolds a project and asserts no generated script begins with a POSIX `NAME=value` prefix and that production mode is still opted into. Full CLI suite passes (240 tests), plus lint, format, typecheck, and `changes:validate`.

(No AI attribution / no `Co-Authored-By` trailer anywhere, per repo policy.)

## Estimated cost spent

~ $2.50 of model usage (well under the $5 limit).
