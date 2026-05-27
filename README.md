# Toggle Excluded Folders

Obsidian community plugin that toggles your **Excluded files** list on and off with one click. Useful when you keep an `Archive/` folder (or templates, or anything noisy) out of your file explorer / search / graph by default, but occasionally want to dig into it without losing the configuration.

## How it works

The plugin operates on Obsidian's built-in **Settings → Files and links → Excluded files** list — it doesn't maintain its own. There's no settings tab for the plugin itself; configure what to exclude in the native UI and the plugin just flips it on/off.

- **One click on the ribbon icon** (or the **Toggle visibility** command) — stashes the entire excluded list to plugin storage and clears the native list. Everything becomes visible.
- **Click again** — restores the list from the stash. Exclusions are back in effect.

Works with every filter type Obsidian supports:

- Folder paths: `Archive/`
- Files: `Templates/note.md`
- Tags: `#exclude`
- Regex: `/^_/`

Search and Graph views are refreshed automatically after toggling (File Explorer updates on its own).

## Install

### From community plugins (once published)

Settings → Community plugins → Browse → search "Toggle Excluded Folders" → Install → Enable.

### Manual

Download `main.js` and `manifest.json` from the latest [release](../../releases) and drop them into `<Vault>/.obsidian/plugins/toggle-excluded-folders/`. Reload Obsidian, enable in Community plugins.

## Usage

1. Open **Settings → Files and links → Excluded files** and add the folders/tags/regex you want to be able to hide.
2. Click the ribbon icon (eye/eye-off). First click: hide. Second click: show.

Alternatively, bind the **Toggle visibility** command to a hotkey via Settings → Hotkeys.

### Editing the list while filters are "off"

You can add entries to the native list at any time. Anything you add while filters are off will be **merged in** on the next restore — it won't get lost.

## Caveats

- **Uninstall / disable.** When you disable or uninstall the plugin, it restores its stash back into the native excluded list before unloading, so your exclusions keep working without the plugin installed.

## Compatibility & internal APIs

This plugin reads and writes Obsidian's "Excluded files" list through APIs that are **not part of the public plugin SDK**. They are isolated in two files so the surface area is easy to audit and patch:

- `Vault.getConfig("userIgnoreFilters")` / `Vault.setConfig("userIgnoreFilters", …)` — the only way to access the native excluded-files list programmatically. Used in `src/vault-config.ts`.
- Search view internals — `view.setQuery` / `view.onSearch` / `view.searchComponent` — to make Search re-run after the filter list changes (it doesn't subscribe to `userIgnoreFilters`). Used in `src/refreshers.ts`.
- Graph view internals — `view.dataEngine.update()` / `view.dataEngine.render()` — same reason, for Graph and Local graph views. Used in `src/refreshers.ts`.

Type signatures for everything above live in `src/obsidian-internals.d.ts` as a module augmentation, so the rest of the code reads as plain typed access with no `as any` / `as unknown as` casts at call sites.

### What happens if Obsidian changes these APIs

- **`getConfig` / `setConfig` go away or change shape:** the plugin detects this on load, shows a one-time notice (*"Your Obsidian version lacks the internal config access this plugin needs…"*) and disables itself — no ribbon, no command — instead of crashing.
- **A refresher breaks** (Search or Graph stops refreshing after an Obsidian update): the failing refresher is isolated in a per-refresher `try`/`catch`. The toggle itself keeps working, the *other* refresher still runs, and you get a one-shot notice (*"Couldn't refresh Search/Graph automatically. Reopen the view to apply changes."*) rate-limited to once per 5 minutes per view. **Workaround until a fix ships:** close and reopen the Search / Graph view after toggling.

### Reporting breakage

If a refresh stops working after an Obsidian update, please open an issue with your Obsidian version. A fix usually means updating one entry in `src/refreshers.ts`.

## Development

```bash
npm install
npm run dev    # esbuild watch — writes main.js in place
npm run build  # tsc typecheck + production esbuild
npm run lint
```

Source layout under `src/`:

- `main.ts` — plugin lifecycle, toggle logic, ribbon, command
- `vault-config.ts` — isolated wrapper around the undocumented `Vault.getConfig`/`setConfig` for `userIgnoreFilters`
- `refreshers.ts` — `REFRESHERS` array describing how to nudge each consumer (Search, Graph, …). Add an entry to support a new view or third-party plugin.
- `obsidian-internals.d.ts` — module augmentation + standalone interfaces for every undocumented Obsidian API the plugin touches. Single source of truth for the private surface area.

There is no test framework. Verify manually: reload Obsidian, click the ribbon, confirm folders appear/disappear in File Explorer, Search, and Graph.

## License

See [LICENSE](LICENSE).
