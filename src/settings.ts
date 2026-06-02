import { App, PluginSettingTab, Setting } from 'obsidian';
import TavernGeneratorPlugin from '../main';

export interface TavernGeneratorSettings {
	saveFolderPath: string;
	defaultTags: string;
	dataFolderPath: string;
}

export const DEFAULT_SETTINGS: TavernGeneratorSettings = {
	saveFolderPath: '',
	defaultTags: '#tavern, #dnd',
	dataFolderPath: 'TavernData'
}

export class TavernGeneratorSettingTab extends PluginSettingTab {
	plugin: TavernGeneratorPlugin;

	constructor(app: App, plugin: TavernGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Папка для сохранения')
			.setDesc('Укажите путь к папке (относительно корня хранилища), куда будут сохраняться сгенерированные таверны. Например: Campaigns/Taverns. Оставьте пустым для сохранения в корень.')
			.addText(text => text
				.setPlaceholder('Taverns')
				.setValue(this.plugin.settings.saveFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.saveFolderPath = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Теги по умолчанию')
			.setDesc('Укажите теги (через запятую), которые будут автоматически добавляться в конец заметки.')
			.addText(text => text
				.setPlaceholder('#tavern, #dnd')
				.setValue(this.plugin.settings.defaultTags)
				.onChange(async (value) => {
					this.plugin.settings.defaultTags = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Папка данных (Словари)')
			.setDesc('Папка в вашем хранилище, откуда плагин будет читать JSON-словари (имена, еда, слухи). Если папки нет, плагин создаст её с базовыми файлами.')
			.addText(text => text
				.setPlaceholder('TavernData')
				.setValue(this.plugin.settings.dataFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.dataFolderPath = value.trim() || 'TavernData';
					await this.plugin.saveSettings();
					// Trigger reload of data
					await this.plugin.initDataFolder();
					this.display(); // Re-render to show new data
				}));

		containerEl.createEl('h3', { text: 'Редактор словарей', cls: 'tavern-section-title' });
		containerEl.createEl('p', { 
			text: 'Здесь вы можете отредактировать все словари плагина. Каждая строчка — это один элемент. Изменения сохраняются автоматически при снятии фокуса с текстового поля.',
			cls: 'setting-item-description'
		});

		this.renderTabs(containerEl);
	}

	private renderTabs(containerEl: HTMLElement) {
		const tabs = [
			{ id: 'tab-menu-food', title: '🍗 Еда' },
			{ id: 'tab-menu-drinks', title: '🍺 Напитки' },
			{ id: 'tab-staff', title: '👤 Персонал' },
			{ id: 'tab-locations', title: '🗺️ Локации' },
			{ id: 'tab-atmosphere', title: '🎭 Атмосфера' },
			{ id: 'tab-names', title: '📜 Названия' },
			{ id: 'tab-levels', title: '⚙️ Таверны' }
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
			const input = addForm.createEl('input', { type: 'text', placeholder: 'Новое значение...' });
			const btn = addForm.createEl('button', { text: 'Добавить' });
			
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
							inputPrice = form.createEl('input', { type: 'text', value: displayPrice, placeholder: 'Цена (необяз.)' });
							inputPrice.style.flex = "1";
						}
						
						const saveBtn = form.createEl('button', { text: 'Сохранить' });
						
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
			const inputName = addForm.createEl('input', { type: 'text', placeholder: hasPriceInput ? 'Название блюда/напитка...' : 'Новая запись...' });
			inputName.style.flex = "2";
			
			let inputPrice: HTMLInputElement | null = null;
			if (hasPriceInput) {
				inputPrice = addForm.createEl('input', { type: 'text', placeholder: 'Цена (напр. 5 ЗМ)' });
				inputPrice.style.flex = "1";
			}
			
			const btn = addForm.createEl('button', { text: 'Добавить' });
			
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
			renderItemList(foodTab, 'Дешевая еда', 'menu.json', 'cheapFood', true);
			renderItemList(foodTab, 'Обычная еда', 'menu.json', 'normalFood', true);
			renderItemList(foodTab, 'Роскошная еда', 'menu.json', 'luxuryFood', true);
			renderItemList(foodTab, 'Блюда от шефа', 'menu.json', 'chefSpecials', true);
			renderItemList(foodTab, 'Дополнительная еда', 'menu.json', 'meals_extended', true);
		}

		// 2. Напитки (menu.json) - Длинные списки
		const drinksTab = getTab('tab-menu-drinks');
		if (drinksTab) {
			renderItemList(drinksTab, 'Дешевые напитки', 'menu.json', 'cheapDrinks', true);
			renderItemList(drinksTab, 'Обычные напитки', 'menu.json', 'normalDrinks', true);
			renderItemList(drinksTab, 'Роскошные напитки', 'menu.json', 'luxuryDrinks', true);
			renderItemList(drinksTab, 'Фирменные напитки', 'menu.json', 'specialDrinks', true);
			renderItemList(drinksTab, 'Дополнительные напитки', 'menu.json', 'drinks_extended', true);
		}

		// 3. Персонал и Посетители - Короткие (Теги) и Длинные
		const staffTab = getTab('tab-staff');
		if (staffTab) {
			renderTagList(staffTab, 'Имена NPC', 'npc_names.json', null);
			renderTagList(staffTab, 'Расы', 'staff_quirks.json', 'races');
			renderItemList(staffTab, 'Особенности персонала', 'staff_quirks.json', 'quirks');
			renderItemList(staffTab, 'Особенности посетителей', 'atmosphere.json', 'patron_quirks');
		}

		// 4. Локации - Списки
		const locTab = getTab('tab-locations');
		if (locTab) {
			renderItemList(locTab, 'Глобальные регионы', 'locations.json', 'locations');
			renderItemList(locTab, 'Местные территории (внутри города)', 'locations.json', 'territories');
		}

		// 5. Атмосфера - Списки
		const atmTab = getTab('tab-atmosphere');
		if (atmTab) {
			renderItemList(atmTab, 'Описания атмосферы зала', 'atmosphere.json', 'atmospheres');
			renderItemList(atmTab, 'Слухи в таверне', 'atmosphere.json', 'rumors');
		}

		// 6. Названия (tavern_names.json) - Короткие (Теги)
		const namesTab = getTab('tab-names');
		if (namesTab) {
			renderTagList(namesTab, 'Приставки', 'tavern_names.json', 'prefixes');
			renderTagList(namesTab, 'Прилагательные (Женские)', 'tavern_names.json', 'adjectives_female');
			renderTagList(namesTab, 'Прилагательные (Мужские)', 'tavern_names.json', 'adjectives_male');
			renderTagList(namesTab, 'Прилагательные (Средний)', 'tavern_names.json', 'adjectives_neuter');
			renderTagList(namesTab, 'Прилагательные (Множ.)', 'tavern_names.json', 'adjectives_plural');
			renderTagList(namesTab, 'Существительные (Женские)', 'tavern_names.json', 'nouns_female');
			renderTagList(namesTab, 'Существительные (Мужские)', 'tavern_names.json', 'nouns_male');
			renderTagList(namesTab, 'Существительные (Средний)', 'tavern_names.json', 'nouns_neuter');
			renderTagList(namesTab, 'Существительные (Множ.)', 'tavern_names.json', 'nouns_plural');
		}

		// 7. Таверны (tavern_levels.json) - Короткие/Списки
		const levelsTab = getTab('tab-levels');
		if (levelsTab) {
			renderTagList(levelsTab, 'Уровни качества (Дешевый, Обычный, Роскошный)', 'tavern_levels.json', 'quality');
			renderItemList(levelsTab, 'Размеры (X комнат; Y прислуг)', 'tavern_levels.json', 'size');
			renderItemList(levelsTab, 'Цены (Общий зал - X; Обычная - Y...)', 'tavern_levels.json', 'prices');
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
		const folderPath = this.plugin.settings.dataFolderPath;
		const filePath = `${folderPath}/${filename}`;
		const file = this.app.vault.getAbstractFileByPath(filePath);
		
		if (file instanceof TFile) {
			const jsonStr = JSON.stringify(GlobalDataCache[filename], null, 2);
			await this.app.vault.modify(file, jsonStr);
		}
	}
}
