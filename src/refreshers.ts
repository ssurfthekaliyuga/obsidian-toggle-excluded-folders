import { App } from "obsidian";
import type { GraphViewInternal, SearchViewInternal } from "./obsidian-internals";

// Built-in views and third-party plugins with their own indexes don't
// react to `userIgnoreFilters` changes on their own. Each refresher below
// is responsible for nudging one consumer. To support a new view or
// plugin, add another entry — no changes to the toggle logic needed.
//
// All calls use undocumented or third-party APIs and may break on
// upstream updates. Per-refresher try/catch (in the orchestrator) keeps a
// broken one from taking down the rest, and surfaces a one-shot Notice so
// the user knows to refresh manually.
export type Refresher = {
	name: string;
	displayName: string;
	refresh(app: App): void;
};

export const REFRESHERS: Refresher[] = [
	{
		name: "search",
		displayName: "Search",
		refresh(app) {
			for (const leaf of app.workspace.getLeavesOfType("search")) {
				const v = leaf.view as SearchViewInternal;
				const q =
					v.getQuery?.() ?? v.searchComponent?.getValue() ?? "";
				v.setQuery?.(q);
				v.searchComponent?.setValue(q);
				v.onSearch?.();
				v.startSearch?.();
			}
		},
	},
	{
		name: "graph",
		displayName: "Graph",
		refresh(app) {
			for (const type of ["graph", "localgraph"]) {
				for (const leaf of app.workspace.getLeavesOfType(type)) {
					const v = leaf.view as GraphViewInternal;
					v.dataEngine?.update?.();
					v.dataEngine?.render?.();
				}
			}
		},
	},
];
