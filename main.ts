import { Plugin, WorkspaceLeaf, TFile, TFolder } from 'obsidian';
import { TavernusView, TAVERN_VIEW_TYPE } from './src/view';
import { TavernusSettings, DEFAULT_SETTINGS, TavernusSettingTab } from './src/settings';
import { t } from './src/locales';

export let GlobalDataCache: Record<string, any> = {};

export default class TavernusPlugin extends Plugin {
	settings: TavernusSettings;

	async onload() {
		await this.loadSettings();
		await this.initDataFolder();

		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				const langPath = this.settings.dataFolderPath + '/' + this.settings.language + '/';
				if (file instanceof TFile && file.path.startsWith(langPath)) {
					await this.reloadFileCache(file);
				}
			})
		);

		this.registerView(
			TAVERN_VIEW_TYPE,
			(leaf) => new TavernusView(leaf, this)
		);

		this.addRibbonIcon('beer', t('open_generator', this.settings.language || 'ru'), () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-tavernus',
			name: t('open_sidebar', this.settings.language || 'ru'),
			callback: () => {
				this.activateView();
			}
		});

		this.addSettingTab(new TavernusSettingTab(this.app, this));
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
		const baseFolderPath = this.settings.dataFolderPath;
		const langFolderPath = `${baseFolderPath}/${this.settings.language}`;
		
		let baseFolder = this.app.vault.getAbstractFileByPath(baseFolderPath);
		if (!baseFolder) {
			await this.app.vault.createFolder(baseFolderPath);
			baseFolder = this.app.vault.getAbstractFileByPath(baseFolderPath);
		}

		// Migration: move old JSON files from base to 'ru' folder
		const ruFolderPath = `${baseFolderPath}/ru`;
		let ruFolder = this.app.vault.getAbstractFileByPath(ruFolderPath);
		if (!ruFolder) {
			await this.app.vault.createFolder(ruFolderPath);
			ruFolder = this.app.vault.getAbstractFileByPath(ruFolderPath);
			
			if (baseFolder instanceof TFolder) {
				for (const child of baseFolder.children) {
					if (child instanceof TFile && child.extension === 'json') {
						await this.app.fileManager.renameFile(child, `${ruFolderPath}/${child.name}`);
					}
				}
			}
		}

		let langFolder = this.app.vault.getAbstractFileByPath(langFolderPath);
		if (!langFolder) {
			await this.app.vault.createFolder(langFolderPath);
		}

		const dataFile = require('./src/data/defaultData');
		const dataToLoad = this.settings.language === 'en' ? dataFile.DefaultDataEn : dataFile.DefaultDataRu;

		// Очищаем кэш перед загрузкой новых данных
		GlobalDataCache = {};

		for (const [filename, content] of Object.entries(dataToLoad)) {
			const filePath = `${langFolderPath}/${filename}`;
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
			console.log(`[Tavernus] Reloaded data from ${file.name}`);
		} catch (e) {
			console.error(`[Tavernus] Error parsing JSON in ${file.name}:`, e);
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
