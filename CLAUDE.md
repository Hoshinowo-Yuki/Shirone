# CLAUDE.md

Project rules live in `AGENTS.md`; read it first. This file tracks in-progress work that is not yet visible from the code or git history, so sessions on different machines stay in sync. Update the status sections whenever work moves forward.

## Context: restoring custom features after the upstream sync

The repo was synced with upstream (`0929f01`) and cleaned with defaults (`167b489`). Custom features added before the sync were dropped and are being restored **one feature at a time**. The working approach is **get it working first, refactor to upstream standards second**.

Pre-sync history still holds the originals. Use it as the reference when restoring:

- `7db7b94` — `core: migrating remark and rehype plugins` (7 plugins + processor wiring)
- `a511f96` — `fix: address CI failures for remark plugins` (tabs/highlight conflict fixes)
- `2dc89a8` — `refactor: font + chat css` (`src/styles/chat.css`, `HYTMR45W-Compressed.woff2`)

Find other dropped features with `git log --author=星野ゆき` before `0929f01`.

## Environment notes

- Development machine runs Windows; use `pnpm.cmd` / `npx.cmd`.
- On the laptop used on 2026-10-02, pnpm was not installed and `node_modules` was missing (Node 26 has no corepack). Install with `npm.cmd i -g pnpm` then `pnpm.cmd install --frozen-lockfile` before validating.

## Feature 1: Markdown plugins (status: wired, NOT yet validated)

The plugin files are in `src/plugins/markdown/common/`. Wiring was restored in `src/utils/markdown-processor.mjs` exactly as in `7db7b94`:

| Plugin | Author syntax | Output |
| --- | --- | --- |
| `remark-tabs.js` | `:::tabs` containing `::tab[Title]` lines | radio-driven `.tabs-container` |
| `remark-highlight.js` | `==text==` (skips `==text=={.class}`, owned by marker) | `<mark>` |
| `remark-colored-text.js` | `:red[text]`, `:hex-ff5733[text]` | `<span class="colored-text" style="color:…">` |
| `remark-supersub.js` | `^sup^`, `~sub~` | `<sup>` / `<sub>` |
| `remark-furigana.js` | `[漢字]{かんじ}`, `{*}` dots, `{=…}` literal, `{a+b}` combined, `.`/`|` separators | `<ruby>` |
| `rehype-chat.mjs` (component `chat`) | `:::chat` with `[user|time]`, `[user|time|right|replyTo]` lines | `.chat-container` bubbles |
| `rehype-component-keyboard.js` (component `keyboard`) | `::keyboard{key="Ctrl"}`, add `theme` for primary colour | `<kbd>` |

Styles:

- `src/styles/chat.css` (from `2dc89a8`) is now imported in `src/styles/main.css`.
- `src/styles/tabs.css` is **new**; tabs never had CSS before. It uses `:has()` to switch panels without JS (handles up to 10 tabs, falls back to the first panel) and M3E tokens. Also imported in `main.css`.

Uncommitted changes: `src/utils/markdown-processor.mjs`, `src/styles/main.css`, `src/styles/tabs.css`, this file.

### Next steps

1. Install deps, then render a sample with every syntax through `siteMarkdownProcessor` (see `tests/plugins/markdown/containers/*.test.mjs` for how tests import it).
2. `npx.cmd astro check` (0 errors), `pnpm.cmd build`, and a visual check in `pnpm.cmd astro dev --port 4321`.
3. Commit, e.g. `feat(markdown): restore custom remark/rehype plugins`.

### Known issues to check

- `~sub~` probably conflicts with GFM single-tilde strikethrough (remark-gfm `singleTilde` defaults to true), so `<del>` may win.
- Chat's reply icon uses `<iconify-icon>`, which no page loads, so it renders empty (the `@name` text still shows).
- **Plugin order deviation:** the five remark plugins run *after* `parseDirectiveNode`, against `docs/markdown-plugin-order.md` (which says it must be last). This is required for now because `parseDirectiveNode` unconditionally overwrites `data.hName` on every directive, which would clobber colored-text and tabs. A proper fix makes those plugins run before it and stop it from overwriting their `hName`.
- `:::tabs` is shared with option-groups (`@tab` markers → `OptionGroupsComponent`); remark-tabs only claims blocks containing `::tab` leaf directives.

### Refactor backlog (after everything works)

The user expects tabs to need a refactor, probably others too. Gaps against the current upstream rules:

- **Manifest:** register each syntax in `src/plugins/markdown/manifest.json` (forms, attributes, styles, tests, docs) and pass `pnpm.cmd check:manifest`. See `docs/markdown-syntax-manifest.md`.
- **On-demand CSS:** chat/tabs CSS currently loads globally. Move it to `src/styles/markdown/*.css` stylesheet packs triggered by feature probes (`docs/markdown-on-demand-loading.md`).
- **Tabs:** decide whether to merge into option-groups (which already has an M3E tabs implementation) rather than keep a parallel `:::tabs` dialect. Build it via HAST nodes instead of raw HTML strings, add `role="tablist"` a11y, and drop the 10-tab CSS limit.
- **Chat:** move "No messages" / "No valid messages found" into `src/i18n/i18nKey.ts` + all ten locales. Convert `chat.css` from hex/`white`/`#666` and `--chat-*` vars to M3E surface/on-surface tokens and `--shape-corner-*`. Remove the `!important` (see `rules/css-important.md`). Replace `iconify-icon` with something that renders in SSR.
- **Colored text:** map names to M3E/semantic tokens instead of Tailwind hex values; keep `hex-` custom colours as the documented exception.
- **Keyboard:** `var(--primary)` inline style should become a class.
- **Highlight / supersub / furigana:** emit HAST/mdast nodes instead of `html` string nodes; deduplicate the three copies of `escapeHtml`.
- **Packaging:** confirm npm-package mode works (`src/integration/index.ts` references `utils/markdown-processor.mjs`; see `docs/packaging-contract.md`).
- **Tests:** add node tests under `tests/plugins/markdown/` and a Playwright fragment, plus a demo post.
- Normalise file extensions (`.js` vs `.mjs`) and directory placement to match the other plugins.

## Remaining features to restore

Not yet inventoried. Next session: list pre-sync commits by the user and agree the order with them.
