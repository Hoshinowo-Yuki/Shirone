# CLAUDE.md

Project rules live in `AGENTS.md`; read it first. This file tracks in-progress work that is not yet visible from the code or git history, so sessions on different machines stay in sync. Update the status sections whenever work moves forward.

## Context: restoring custom features after the upstream sync

The repo was synced with upstream (`0929f01`) and cleaned with defaults (`167b489`). Custom features added before the sync were dropped and are being restored **one feature at a time**. The working approach is **get it working first, refactor to upstream standards second**, with a read-only audit before each refactor.

Pre-sync history still holds the originals. Use it as the reference when restoring:

- `7db7b94` — `core: migrating remark and rehype plugins` (7 plugins + processor wiring)
- `a511f96` — `fix: address CI failures for remark plugins` (tabs/highlight conflict fixes)
- `2dc89a8` — `refactor: font + chat css` (`src/styles/chat.css`, `HYTMR45W-Compressed.woff2`)

Find other dropped features with `git log --author=星野ゆき` before `0929f01`.

## Environment notes

- Work happens on more than one machine. On Windows use `pnpm.cmd` / `npx.cmd`; on the Linux machine (used from 2026-10-03) plain `pnpm` / `npx` work.
- On the laptop used on 2026-10-02, pnpm was not installed and `node_modules` was missing (Node 26 has no corepack). Install with `npm.cmd i -g pnpm` then `pnpm.cmd install --frozen-lockfile` before validating.
- Linux machine: Playwright's browsers are not installed. For ad-hoc screenshots, launch Chromium with `executablePath: "/usr/bin/brave"`; `pnpm exec playwright test` needs `npx playwright install` first. `gh` is not installed and there are no GitHub push credentials (HTTPS has no helper, the SSH key is not registered), so the user pushes. CI status can be read anonymously from `https://api.github.com/repos/Hoshinowo-Yuki/Shirone/actions/runs?head_sha=<sha>`.
- The dev server (`astro dev`, which daemonises; stop with `astro dev stop`) does not hot-reload Markdown plugin changes. After editing a remark/rehype plugin, stop it, delete `.astro/data-store.json`, and start it again.
- CI's unit step runs every test: `node --test "tests/**/*.test.mjs"`, not only `tests/plugins/markdown/`.
- Demo posts are not committed. Copies of the two demo posts used for visual checks live outside the repo in `/home/neko/projects/shirone-demo-posts/` (`inline-text-extensions.md`, `chat-transcripts.md`); copy one into `src/content/posts/` temporarily to preview, and remove it before committing.

## Feature 1: Markdown plugins (status: done, except tabs)

Refactored to upstream standards in `1c38ca3` after an audit agreed with the user. Each syntax now has a manifest entry, a feature probe, docs in `docs/markdown-extensions.md` (§3.6–3.10), a row in `docs/markdown-plugin-order.md`, and node tests. `src/plugins/markdown/common/` no longer exists.

| Syntax | Author forms | Files |
| --- | --- | --- |
| supersub | `:sup[x]`, `:sub[x]`, `^x^` (no `~sub~`: GFM owns `~x~` as strikethrough) | `remark-supersub.mjs` |
| colored-text | `:red[x]` … `:pink[x]`, `:gray[x]`, `:primary[x]`/`secondary`/`tertiary`/`error`, `:hex-ff5733[x]` | `remark-colored-text.mjs`, `core/colored-text.mjs`, `rehype-component-colored-text.mjs`, `styles/markdown/colored-text.css`, `--content-color-*` in `variables.styl` |
| keyboard | `:keyboard{key="Ctrl"}`, `:keyboard[Esc]`, `{… theme}`, `::keyboard{…}` alone on a line | `remark-keyboard.mjs`, `rehype-component-keyboard.mjs`, `styles/markdown/keyboard.css` |
| furigana | `[漢字]{かんじ}`, `{に.ほん.ご}`, `{=きょう}`, `{a+b}`, `{*}` | `remark-furigana.mjs` (source rewrite like marker), `core/furigana.mjs`, `rehype-component-furigana.mjs` |
| chat | `:::chat` with `[user\|time]`, `[user\|time\|right\|replyTo]`, `[[date]]` dividers, `((note))` | `rehype-component-chat.mjs`, `styles/markdown/chat.css` |

- `remark-highlight` was removed: upstream `remarkMarker` already owns `==text==`.
- `core/directive-source.mjs` restores rejected directives as the author's exact source text.
- Chat warnings (empty block, no headers, unknown position) go to `vfile.message`, which Astro does not print.

Open items for this feature:

- **Packaging:** npm-package mode (`src/integration/`, `docs/packaging-contract.md`) has not been checked with the new plugins.
- **Playwright:** no `tests/site/*.spec.ts` fragments yet for these syntaxes; visual checks were done ad hoc with screenshots.

## Tabs: removed, needs a refactor before it comes back

The restored `remark-tabs.js` and `src/styles/tabs.css` were removed (along with the `main.css` import and processor wiring) because the plugin needs a proper refactor. No post used it. Until it returns, the old author syntax `:::tabs` with `::tab[Title]` lines falls through to upstream option-groups and renders as flat content with unknown `<tab>` elements. Upstream's own `:::tabs` with `@tab` markers (option-groups) is unaffected.

What the original did: radio inputs plus `:has()` CSS to switch panels without JS, one group per `:::tabs`, titles from `::tab[Title]`. Reference it in `7db7b94` / `a511f96`.

Audit findings to address in the refactor:

- **First decide with the user:** make `::tab` another way to write upstream option-groups (which already has M3E tabs, `role="tablist"`, keyboard support and sync), or keep a separate component.
- Tab group IDs and radio `name`s restarted at `tab-group-0` in every document, so on pages rendering several posts one tab group switched another.
- The feature probe recorded it as `option-groups`, loading that pack unnecessarily.
- Tab titles lost inline formatting; the header was built from raw HTML strings.
- No `tablist`/`tab` roles; the CSS only handled 10 tabs.
- If kept separate: follow the same pattern as the other plugins (normalise before `parseDirectiveNode`, rehype component, manifest entry, probe, stylesheet pack, tests).

## Remaining features to restore

Not yet inventoried. Next session: list pre-sync commits by the user and agree the order with them.
