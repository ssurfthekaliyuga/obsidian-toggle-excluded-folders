import { Vault } from "obsidian";

// Obsidian's "Excluded files" list. Not exposed in the public typings —
// we reach it through `getConfig` / `setConfig` on the vault (declared as
// optional via module augmentation in `obsidian-internals.d.ts`).
export const USER_IGNORE_FILTERS = "userIgnoreFilters";

export function isVaultConfigSupported(vault: Vault): boolean {
	return (
		typeof vault.getConfig === "function" &&
		typeof vault.setConfig === "function"
	);
}

export function getExcluded(vault: Vault): string[] {
	const raw = vault.getConfig?.(USER_IGNORE_FILTERS);
	return Array.isArray(raw) ? [...(raw as string[])] : [];
}

export function setExcluded(vault: Vault, filters: string[]): void {
	vault.setConfig?.(USER_IGNORE_FILTERS, filters);
}
