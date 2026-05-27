import { Notice, Plugin, setIcon } from "obsidian";
import { REFRESHERS } from "./refreshers";
import {
	getExcluded,
	isVaultConfigSupported,
	setExcluded,
} from "./vault-config";

const RIBBON_ICON_VISIBLE = "eye";
const RIBBON_ICON_HIDDEN = "eye-off";

// Cooldown between repeat "couldn't refresh X" notices for the same
// refresher, so a persistently broken internal API doesn't spam the user
// on every toggle.
const REFRESHER_NOTICE_COOLDOWN_MS = 5 * 60 * 1000;

interface ToggleExcludedFoldersSettings {
	stash: string[];
}

const DEFAULT_SETTINGS: ToggleExcludedFoldersSettings = {
	stash: [],
};

function dedupMerge(a: string[], b: string[]): string[] {
	return Array.from(new Set([...a, ...b]));
}

export default class ToggleExcludedFolders extends Plugin {
	settings: ToggleExcludedFoldersSettings;
	private ribbonEl: HTMLElement | null = null;
	private toggling = false;
	private supported = false;
	private refresherNoticeAt = new Map<string, number>();

	async onload() {
		if (!isVaultConfigSupported(this.app.vault)) {
			new Notice(
				"Your Obsidian version lacks the internal config access this plugin needs. Update Obsidian or reinstall the plugin.",
			);
			return;
		}
		this.supported = true;

		await this.loadSettings();

		this.ribbonEl = this.addRibbonIcon(
			RIBBON_ICON_VISIBLE,
			"Toggle excluded files",
			() => this.toggleExcluded(),
		);
		this.updateRibbonState();

		this.addCommand({
			id: "toggle",
			name: "Toggle visibility",
			callback: () => this.toggleExcluded(),
		});
	}

	onunload() {
		// Re-apply stashed filters on plugin disable / Obsidian shutdown /
		// uninstall so exclusions stay in effect even with the plugin gone.
		// Fire-and-forget save: Plugin.onunload is sync void, and on shutdown
		// Obsidian doesn't reliably await async work anyway. `setConfig`
		// writes to vault config which Obsidian flushes on quit.
		if (
			this.supported &&
			this.settings &&
			this.settings.stash.length > 0
		) {
			const current = getExcluded(this.app.vault);
			const merged = dedupMerge(this.settings.stash, current);
			setExcluded(this.app.vault, merged);
			// Refresh before the save so views still exist on plugin disable.
			// On shutdown views may already be torn down — guarded by optional
			// chaining inside refreshDependentViews.
			this.refreshDependentViews();
			this.settings.stash = [];
			this.saveData(this.settings).catch(() => {
				// Best-effort — Obsidian may already be tearing down.
			});
		}
		this.ribbonEl = null;
	}

	async loadSettings() {
		const data = (await this.loadData()) as
			| Partial<ToggleExcludedFoldersSettings>
			| null;
		const rawStash = data?.stash;
		const stash = Array.isArray(rawStash) ? rawStash : [];
		// Explicitly pick known keys so legacy keys (e.g. old `folders` from
		// the pre-redesign data shape) don't get round-tripped back to disk.
		this.settings = { ...DEFAULT_SETTINGS, stash };

		// Reconcile: if every stash entry is already in the native list, the
		// onunload restore ran but saveData didn't flush. Clear the stash now
		// so the next toggle behaves as expected.
		if (this.settings.stash.length > 0) {
			const currentSet = new Set(getExcluded(this.app.vault));
			if (
				currentSet.size > 0 &&
				this.settings.stash.every((s) => currentSet.has(s))
			) {
				this.settings.stash = [];
				await this.saveSettings();
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async toggleExcluded(): Promise<void> {
		if (this.toggling) return;
		this.toggling = true;
		try {
			const current = getExcluded(this.app.vault);
			const hasStash = this.settings.stash.length > 0;

			if (hasStash) {
				// Off → on. Merge stash with whatever the user added to the
				// native list while filters were off, so those additions persist.
				const merged = dedupMerge(this.settings.stash, current);
				setExcluded(this.app.vault, merged);
				this.settings.stash = [];
				await this.saveSettings();
			} else if (current.length > 0) {
				// On → off. Capture current as the stash and clear.
				this.settings.stash = current;
				setExcluded(this.app.vault, []);
				await this.saveSettings();
			} else {
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- literal Obsidian UI path; capitalisation matches the native labels.
				new Notice("Nothing to toggle. Add entries under Settings → Files and links → Excluded files.");
				return;
			}

			this.updateRibbonState();
			this.refreshDependentViews();
		} finally {
			this.toggling = false;
		}
	}

	private refreshDependentViews(): void {
		for (const refresher of REFRESHERS) {
			try {
				refresher.refresh(this.app);
			} catch (e) {
				// One broken refresher must not block the others. Surface a
				// throttled notice so the user knows to refresh that view
				// manually, and log the error for debugging.
				console.error(`[toggle-excluded-folders] refresher "${refresher.name}" failed:`, e);
				this.notifyRefresherFailure(refresher);
			}
		}
	}

	private notifyRefresherFailure(refresher: { name: string; displayName: string }): void {
		const now = Date.now();
		const last = this.refresherNoticeAt.get(refresher.name) ?? 0;
		if (now - last < REFRESHER_NOTICE_COOLDOWN_MS) return;
		this.refresherNoticeAt.set(refresher.name, now);
		new Notice(
			`Couldn't refresh ${refresher.displayName} automatically. Reopen the view to apply changes.`,
		);
	}

	private updateRibbonState(): void {
		if (!this.ribbonEl) return;
		const visible = getExcluded(this.app.vault).length === 0;
		this.ribbonEl.setAttr(
			"aria-label",
			visible
				? "Hide excluded files (currently visible)"
				: "Show excluded files (currently hidden)",
		);
		this.ribbonEl.toggleClass("is-active", visible);
		setIcon(
			this.ribbonEl,
			visible ? RIBBON_ICON_VISIBLE : RIBBON_ICON_HIDDEN,
		);
	}
}
