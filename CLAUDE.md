# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this plugin does

Obsidian community plugin that toggles the vault's entire `userIgnoreFilters` list (Obsidian's "Excluded files" setting) on and off. One click on the ribbon icon — or the `toggle-excluded-folders` command — stashes the current filters away (showing everything) or restores them from the stash (hiding what the user configured).

The user manages their excluded list in the native Settings → Files and links → Excluded files. The plugin has no settings tab of its own — its only state is `stash: string[]` in `data.json`, which holds the filters while they're "off". This works for all filter types Obsidian's `userIgnoreFilters` supports: folder paths, files, and regex (`/pattern/`). Tags (`#foo`) are **not** supported by Obsidian's excluded-files setting itself — the plugin can't add that capability.

## Repository quirk: lives inside a real vault

The working directory **is** the plugin's install location (`<Vault>/.obsidian/plugins/toggle-excluded-folders/`). `npm run dev` writes `main.js` directly here, so reloading Obsidian (or the Hot Reload plugin) picks up changes immediately — no copy step. Beware: `data.json` at the repo root is real user settings, not a fixture.

## Commands

```bash
npm install         # install deps
npm run dev         # esbuild watch — writes main.js in place
npm run build       # tsc typecheck + production esbuild
npm run lint        # eslint (uses eslint-plugin-obsidianmd rules)
```

There is no test framework. Verification is manual: reload Obsidian, click the ribbon, confirm folders appear/disappear from the file explorer / search / graph.

## Architecture

Three files in `src/`:

- **`src/main.ts`** — plugin class: lifecycle (`onload`/`onunload`), settings persistence, toggle logic, ribbon icon, command. Knows nothing about the undocumented APIs directly — those live in the other two files.
- **`src/vault-config.ts`** — isolates the only `as unknown as` cast in the codebase. Exports `USER_IGNORE_FILTERS`, `getExcluded(vault)`, `setExcluded(vault, filters)`. If Obsidian ever breaks `getConfig`/`setConfig`, fix it here.
- **`src/refreshers.ts`** — `Refresher` type and `REFRESHERS` array. Each entry knows how to nudge one consumer (built-in view or third-party plugin) after the excluded list changes. Adding support for a new view/plugin = one new entry, no changes elsewhere.

### Refreshers — undocumented APIs

After toggling `userIgnoreFilters`, the file explorer updates on its own but **Search** and **Graph** views don't. `refreshers.ts` pokes them via internal view APIs (`view.setQuery`, `view.onSearch`, `view.dataEngine.update/render`). These are not part of the public Obsidian API and may break on version updates — if Search or Graph stops refreshing after an Obsidian release, that's the first place to look. Each refresher is wrapped in its own try/catch at the orchestrator level (`main.ts` → `refreshDependentViews`), so one broken refresher won't take down the others.

### State model

Direction is driven by **whether `settings.stash` is non-empty**, not by the current native list (the user can edit that in either state, so it's not a reliable signal on its own).

- `stash` non-empty (we're "off") → click restores `stash`, merging in anything the user added to the native list while filters were off (dedup union). `stash` becomes `[]`.
- `stash` empty AND native list non-empty (we're "on") → click stashes the current list and clears the native list.
- `stash` empty AND native list empty → nothing configured; show a notice pointing the user at native settings.

This handles editing in either direction: additions made in the off state get merged back in on the next restore, additions made in the on state are captured by the next stash. Removals in the on state are preserved (next stash only sees what's still there); removals in the off state aren't possible (list is already empty).

The ribbon icon (`eye` ↔ `eye-off`) mirrors the *current vault state* (`userIgnoreFilters` empty vs non-empty), not the plugin's stash mode — what the user sees in the file explorer.

### Unload behavior + reconcile

On `onunload` (plugin disable, Obsidian shutdown, uninstall) the plugin **restores the stash back into `userIgnoreFilters`**, so exclusions stay applied even with the plugin gone. `setConfig` is sync (flushed to `app.json` by Obsidian on quit); `saveData(stash=[])` is async and may not complete before Obsidian tears down.

To handle the race, `loadSettings` runs a **reconcile** step: if every entry in the loaded `stash` is also present in `userIgnoreFilters`, the unload-restore must have happened but the stash-clear didn't persist — clear it now. Result: the next toggle behaves as expected.

### Double-click guard

`toggleExcluded` is async (awaits `saveSettings`). A `toggling` boolean drops re-entrant calls so a rapid double-click can't corrupt state by reading stale `current` mid-flight.

## Release artifacts

Required at top level for Obsidian to load the plugin: `main.js` and `manifest.json` (`styles.css` is optional and currently not shipped — plugin has no custom styles). `npm run build` produces `main.js`; `manifest.json` is a committed source file. Don't commit `main.js` (it's `.gitignore`d in spirit even if currently tracked — check before adding it to a release).

## Reference

`AGENTS.md` has extensive Obsidian-plugin guidelines (manifest rules, mobile considerations, UX copy style, release process). Consult it for anything touching `manifest.json`, releases, or user-facing strings.
