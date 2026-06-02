import { Plugin, WorkspaceLeaf, TFile } from 'obsidian';
import { TavernGeneratorView, TAVERN_VIEW_TYPE } from './src/view';
import { TavernGeneratorSettings, DEFAULT_SETTINGS, TavernGeneratorSettingTab } from './src/settings';
import { DefaultData } from './src/data/defaultData';

export let GlobalDataCache: Record<string, any> = {};

export default class TavernGeneratorPlugin extends Plugin {
	settings: TavernGeneratorSettings;

	async onload() {
		await this.loadSettings();
		await this.initDataFolder();

		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.dataFolderPath + '/')) {
					await this.reloadFileCache(file);
				}
			})
		);

		this.registerView(
			TAVERN_VIEW_TYPE,
			(leaf) => new TavernGeneratorView(leaf, this)
		);

		this.addRibbonIcon('beer', 'Открыть генератор таверн', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-tavern-generator',
			name: 'Открыть боковую панель',
			callback: () => {
				this.activateView();
			}
		});

		this.addSettingTab(new TavernGeneratorSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(TAVERN_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async initDataFolder() {
		const folderPath = this.settings.dataFolderPath;
		let folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}

		for (const [filename, content] of Object.entries(DefaultData)) {
			const filePath = `${folderPath}/${filename}`;
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file) {
				const jsonStr = JSON.stringify(content, null, 2);
				await this.app.vault.create(filePath, jsonStr);
				GlobalDataCache[filename] = content;
			} else if (file instanceof TFile) {
				await this.reloadFileCache(file);
			}
		}
	}

	async reloadFileCache(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			GlobalDataCache[file.name] = JSON.parse(content);
			console.log(`[Tavern Generator] Reloaded data from ${file.name}`);
		} catch (e) {
			console.error(`[Tavern Generator] Error parsing JSON in ${file.name}:`, e);
		}
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(TAVERN_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: TAVERN_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}
}
