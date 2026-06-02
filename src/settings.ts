import { App, PluginSettingTab, Setting } from 'obsidian';
import TavernusPlugin from '../main';
import { t } from './locales';

export interface TavernusSettings {
	saveFolderPath: string;
	defaultTags: string;
	dataFolderPath: string;
	language: string;
}

export const DEFAULT_SETTINGS: TavernusSettings = {
	saveFolderPath: '',
	defaultTags: '#tavern, #dnd',
	dataFolderPath: 'TavernData',
	language: 'ru'
}

export class TavernusSettingTab extends PluginSettingTab {
	plugin: TavernusPlugin;

	constructor(app: App, plugin: TavernusPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		const lang = this.plugin.settings.language;

		containerEl.empty();

		new Setting(containerEl)
			.setName(t('settings_language', lang))
			.setDesc(t('settings_language_desc', lang))
			.addDropdown(dropdown => dropdown
				.addOption('ru', 'Русский (Russian)')
				.addOption('en', 'English')
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
					await this.plugin.initDataFolder();
					this.display();
				}));

		new Setting(containerEl)
			.setName(t('settings_save_folder', lang))
			.setDesc(t('settings_save_folder_desc', lang))
			.addText(text => text
				.setPlaceholder('Taverns')
				.setValue(this.plugin.settings.saveFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.saveFolderPath = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_default_tags', lang))
			.setDesc(t('settings_default_tags_desc', lang))
			.addText(text => text
				.setPlaceholder('#tavern, #dnd')
				.setValue(this.plugin.settings.defaultTags)
				.onChange(async (value) => {
					this.plugin.settings.defaultTags = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings_data_folder', lang))
			.setDesc(t('settings_data_folder_desc', lang))
			.addText(text => text
				.setPlaceholder('TavernData')
				.setValue(this.plugin.settings.dataFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.dataFolderPath = value.trim() || 'TavernData';
					await this.plugin.saveSettings();
					await this.plugin.initDataFolder();
					this.display();
				}));

		containerEl.createEl('h3', { text: t('settings_dict_editor', lang), cls: 'tavern-section-title' });
		containerEl.createEl('p', { 
			text: t('settings_dict_editor_desc', lang),
			cls: 'setting-item-description'
		});

		this.renderTabs(containerEl);
	}

	private renderTabs(containerEl: HTMLElement) {
		const lang = this.plugin.settings.language;
		const tabs = [
			{ id: 'tab-menu-food', title: t('settings_tab_food', lang) },
			{ id: 'tab-menu-drinks', title: t('settings_tab_drinks', lang) },
			{ id: 'tab-staff', title: t('settings_tab_staff', lang) },
			{ id: 'tab-locations', title: t('settings_tab_locations', lang) },
			{ id: 'tab-atmosphere', title: t('settings_tab_atmosphere', lang) },
			{ id: 'tab-names', title: t('settings_tab_names', lang) },
			{ id: 'tab-levels', title: t('settings_tab_levels', lang) }
		];

		const tabsContainer = containerEl.createDiv({ cls: 'tavern-settings-tabs' });
		const contentContainer = containerEl.createDiv({ cls: 'tavern-settings-content' });

		let activeTabId = tabs[0].id;
		const tabBtns: HTMLElement[] = [];
		const tabContents: HTMLElement[] = [];

		tabs.forEach(tab => {
			// Tab Button
			const btn = tabsContainer.createEl('button', {
				text: tab.title,
				cls: `tavern-tab-btn ${tab.id === activeTabId ? 'is-active' : ''}`
			});
			tabBtns.push(btn);

			// Tab Content
			const content = contentContainer.createDiv({
				cls: `tavern-tab-content ${tab.id === activeTabId ? 'is-active' : ''}`
			});
			content.id = tab.id;
			tabContents.push(content);

			btn.addEventListener('click', () => {
				tabBtns.forEach(b => b.classList.remove('is-active'));
				tabContents.forEach(c => c.classList.remove('is-active'));
				btn.classList.add('is-active');
				content.classList.add('is-active');
			});
		});

		this.renderTabContents(tabContents);
	}

	private renderTabContents(tabContents: HTMLElement[]) {
		const lang = this.plugin.settings.language;
		const getTab = (id: string) => tabContents.find(c => c.id === id);

		const getArray = (filename: string, jsonKey: string | null) => {
			const { GlobalDataCache } = require('../main');
			const data = GlobalDataCache[filename] || {};
			if (jsonKey === null) return Array.isArray(data) ? data : [];
			return data[jsonKey] || [];
		};

		// 1. Tags UI (For short words)
		const renderTagList = (parent: HTMLElement, label: string, filename: string, jsonKey: string | null) => {
			parent.createDiv({ text: label, cls: 'tavern-dict-label' });
			const container = parent.createDiv({ cls: 'tavern-tags-container' });
			
			const arr = getArray(filename, jsonKey);
			
			const renderTags = () => {
				container.empty();
				arr.forEach((item: string, index: number) => {
					const tagEl = container.createSpan({ cls: 'tavern-tag', text: item });
					const delBtn = tagEl.createSpan({ cls: 'tavern-tag-delete' });
					require('obsidian').setIcon(delBtn, 'x');
					delBtn.addEventListener('click', async () => {
						arr.splice(index, 1);
						await this.saveDataToVault(filename, jsonKey, arr);
						renderTags();
					});
				});
			};
			renderTags();

			const addForm = parent.createDiv({ cls: 'tavern-add-tag-form' });
			const input = addForm.createEl('input', { type: 'text', placeholder: t('placeholder_new_value', lang) });
			const btn = addForm.createEl('button', { text: t('btn_add', lang) });
			
			const onAdd = async () => {
				const val = input.value.trim();
				if (val) {
					arr.push(val);
					await this.saveDataToVault(filename, jsonKey, arr);
					input.value = '';
					renderTags();
				}
			};
			btn.addEventListener('click', onAdd);
			input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onAdd(); });
		};

		// 2. List Item UI (For long sentences and Menu items with prices)
		const renderItemList = (parent: HTMLElement, label: string, filename: string, jsonKey: string | null, hasPriceInput: boolean = false) => {
			parent.createDiv({ text: label, cls: 'tavern-dict-label' });
			const listContainer = parent.createDiv({ cls: 'tavern-list-container' });
			
			const arr = getArray(filename, jsonKey);

			const renderList = () => {
				listContainer.empty();
				arr.forEach((item: string, index: number) => {
					const row = listContainer.createDiv({ cls: 'tavern-settings-list-item' });
					
					let displayName = item;
					let displayPrice = "";
					if (hasPriceInput && item.includes('|')) {
						const parts = item.split('|').map(s => s.trim());
						displayName = parts[0];
						displayPrice = parts[1] || "";
					}

					let displayHtml = displayName;
					if (displayPrice) {
						displayHtml += ` <span style="color: var(--text-muted); font-size: 0.9em; border-left: 1px solid var(--background-modifier-border); padding-left: 6px; margin-left: 6px;">${displayPrice}</span>`;
					}

					const contentDiv = row.createDiv({ cls: 'tavern-list-item-content' });
					contentDiv.innerHTML = displayHtml;
					
					const actionsDiv = row.createDiv({ cls: 'tavern-list-actions' });
					
					const editBtn = actionsDiv.createEl('button');
					require('obsidian').setIcon(editBtn, 'pencil');
					
					const delBtn = actionsDiv.createEl('button', { cls: 'delete-action' });
					require('obsidian').setIcon(delBtn, 'trash-2');

					delBtn.addEventListener('click', async () => {
						arr.splice(index, 1);
						await this.saveDataToVault(filename, jsonKey, arr);
						renderList();
					});

					editBtn.addEventListener('click', () => {
						contentDiv.empty();
						actionsDiv.style.display = 'none';
						
						const form = contentDiv.createDiv({ cls: 'tavern-edit-inline-form' });
						
						const inputName = form.createEl('input', { type: 'text', value: displayName });
						inputName.style.flex = "2";
						
						let inputPrice: HTMLInputElement | null = null;
						if (hasPriceInput) {
							inputPrice = form.createEl('input', { type: 'text', value: displayPrice, placeholder: t('placeholder_price', lang) });
							inputPrice.style.flex = "1";
						}
						
						const saveBtn = form.createEl('button', { text: t('btn_save', lang) });
						
						const onSave = async () => {
							const valName = inputName.value.trim();
							const valPrice = inputPrice ? inputPrice.value.trim() : "";
							
							if (valName) {
								let finalStr = valName;
								if (valPrice) finalStr += ` | ${valPrice}`;
								arr[index] = finalStr;
								await this.saveDataToVault(filename, jsonKey, arr);
							}
							renderList();
						};
						
						saveBtn.addEventListener('click', onSave);
						inputName.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSave(); });
						if (inputPrice) inputPrice.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSave(); });
						
						inputName.focus();
					});
				});
			};
			renderList();

			const addForm = parent.createDiv({ cls: 'tavern-add-item-form' });
			const inputName = addForm.createEl('input', { type: 'text', placeholder: hasPriceInput ? t('placeholder_dish_drink', lang) : t('placeholder_new_record', lang) });
			inputName.style.flex = "2";
			
			let inputPrice: HTMLInputElement | null = null;
			if (hasPriceInput) {
				inputPrice = addForm.createEl('input', { type: 'text', placeholder: t('placeholder_price', lang) });
				inputPrice.style.flex = "1";
			}
			
			const btn = addForm.createEl('button', { text: t('btn_add', lang) });
			
			const onAdd = async () => {
				const valName = inputName.value.trim();
				const valPrice = inputPrice ? inputPrice.value.trim() : "";
				
				if (valName) {
					let finalStr = valName;
					if (valPrice) finalStr += ` | ${valPrice}`;
					arr.push(finalStr);
					await this.saveDataToVault(filename, jsonKey, arr);
					inputName.value = '';
					if (inputPrice) inputPrice.value = '';
					renderList();
				}
			};
			btn.addEventListener('click', onAdd);
			inputName.addEventListener('keydown', (e) => { if (e.key === 'Enter') onAdd(); });
			if (inputPrice) inputPrice.addEventListener('keydown', (e) => { if (e.key === 'Enter') onAdd(); });
		};

		// 1. Еда (menu.json) - Длинные списки
		const foodTab = getTab('tab-menu-food');
		if (foodTab) {
			renderItemList(foodTab, t('dict_cheap_food', lang), 'menu.json', 'cheapFood', true);
			renderItemList(foodTab, t('dict_normal_food', lang), 'menu.json', 'normalFood', true);
			renderItemList(foodTab, t('dict_luxury_food', lang), 'menu.json', 'luxuryFood', true);
			renderItemList(foodTab, t('dict_chef_food', lang), 'menu.json', 'chefSpecials', true);
			renderItemList(foodTab, t('dict_ext_food', lang), 'menu.json', 'meals_extended', true);
		}

		// 2. Напитки (menu.json) - Длинные списки
		const drinksTab = getTab('tab-menu-drinks');
		if (drinksTab) {
			renderItemList(drinksTab, t('dict_cheap_drinks', lang), 'menu.json', 'cheapDrinks', true);
			renderItemList(drinksTab, t('dict_normal_drinks', lang), 'menu.json', 'normalDrinks', true);
			renderItemList(drinksTab, t('dict_luxury_drinks', lang), 'menu.json', 'luxuryDrinks', true);
			renderItemList(drinksTab, t('dict_special_drinks', lang), 'menu.json', 'specialDrinks', true);
			renderItemList(drinksTab, t('dict_ext_drinks', lang), 'menu.json', 'drinks_extended', true);
		}

		// 3. Персонал и Посетители - Короткие (Теги) и Длинные
		const staffTab = getTab('tab-staff');
		if (staffTab) {
			renderTagList(staffTab, t('dict_npc_names', lang), 'npc_names.json', null);
			renderTagList(staffTab, t('dict_races', lang), 'staff_quirks.json', 'races');
			renderItemList(staffTab, t('dict_staff_quirks', lang), 'staff_quirks.json', 'quirks');
			renderItemList(staffTab, t('dict_patron_quirks', lang), 'atmosphere.json', 'patron_quirks');
		}

		// 4. Локации - Списки
		const locTab = getTab('tab-locations');
		if (locTab) {
			renderItemList(locTab, t('dict_global_loc', lang), 'locations.json', 'locations');
			renderItemList(locTab, t('dict_local_loc', lang), 'locations.json', 'territories');
		}

		// 5. Атмосфера - Списки
		const atmTab = getTab('tab-atmosphere');
		if (atmTab) {
			renderItemList(atmTab, t('dict_atmospheres', lang), 'atmosphere.json', 'atmospheres');
			renderItemList(atmTab, t('dict_rumors', lang), 'atmosphere.json', 'rumors');
		}

		// 6. Названия (tavern_names.json) - Короткие (Теги)
		const namesTab = getTab('tab-names');
		if (namesTab) {
			renderTagList(namesTab, t('dict_prefixes', lang), 'tavern_names.json', 'prefixes');
			renderTagList(namesTab, t('dict_adj_f', lang), 'tavern_names.json', 'adjectives_female');
			renderTagList(namesTab, t('dict_adj_m', lang), 'tavern_names.json', 'adjectives_male');
			renderTagList(namesTab, t('dict_adj_n', lang), 'tavern_names.json', 'adjectives_neuter');
			renderTagList(namesTab, t('dict_adj_p', lang), 'tavern_names.json', 'adjectives_plural');
			renderTagList(namesTab, t('dict_noun_f', lang), 'tavern_names.json', 'nouns_female');
			renderTagList(namesTab, t('dict_noun_m', lang), 'tavern_names.json', 'nouns_male');
			renderTagList(namesTab, t('dict_noun_n', lang), 'tavern_names.json', 'nouns_neuter');
			renderTagList(namesTab, t('dict_noun_p', lang), 'tavern_names.json', 'nouns_plural');
		}

		// 7. Таверны (tavern_levels.json) - Короткие/Списки
		const levelsTab = getTab('tab-levels');
		if (levelsTab) {
			renderTagList(levelsTab, t('dict_quality', lang), 'tavern_levels.json', 'quality');
			renderItemList(levelsTab, t('dict_sizes', lang), 'tavern_levels.json', 'size');
			renderItemList(levelsTab, t('dict_prices', lang), 'tavern_levels.json', 'prices');
		}
	}

	private async saveDataToVault(filename: string, jsonKey: string | null, newData: string[]) {
		const { GlobalDataCache } = require('../main');
		const { TFile } = require('obsidian');

		// Обновляем кэш
		if (jsonKey === null) {
			GlobalDataCache[filename] = newData;
		} else {
			if (!GlobalDataCache[filename]) GlobalDataCache[filename] = {};
			GlobalDataCache[filename][jsonKey] = newData;
		}

		// Сохраняем в файл
		const folderPath = `${this.plugin.settings.dataFolderPath}/${this.plugin.settings.language}`;
		const filePath = `${folderPath}/${filename}`;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		
		if (file instanceof TFile) {
			const jsonStr = JSON.stringify(GlobalDataCache[filename], null, 2);
			await this.app.vault.modify(file, jsonStr);
		}
	}
}
