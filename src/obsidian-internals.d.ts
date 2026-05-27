import "obsidian";

// Undocumented Obsidian internals used by this plugin. Centralised here so
// reviewers can see the full surface area we depend on, and so the rest of
// the code reads as plain typed access without inline casts.
//
// Everything here is optional — callers must guard before use. If Obsidian
// ever changes these shapes, this file is the single place to update.

declare module "obsidian" {
	interface Vault {
		getConfig?(key: "userIgnoreFilters"): unknown;
		setConfig?(key: "userIgnoreFilters", value: unknown): void;
	}
}

export interface SearchViewInternal {
	getQuery?(): string;
	setQuery?(q: string): void;
	searchComponent?: {
		getValue(): string;
		setValue(v: string): void;
	};
	onSearch?(): void;
	startSearch?(): void;
}

export interface GraphViewInternal {
	dataEngine?: {
		render?(): void;
		update?(): void;
	};
}
