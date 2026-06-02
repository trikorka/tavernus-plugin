import { ItemView, WorkspaceLeaf, Notice, setIcon, TFile, TFolder } from "obsidian";
import { generateTavern, Tavern, generateSinglePatron, generateSingleRumor, generateSingleRoom, parsePrices } from "./generator/tavernGenerator";
import { generateNPC } from "./generator/staffGenerator";
import { generateSingleFood, generateSingleDrink } from "./generator/menuGenerator";
import TavernGeneratorPlugin from "../main";
import { GlobalDataCache } from "../main";

export const TAVERN_VIEW_TYPE = "tavern-generator-view";

export class TavernGeneratorView extends ItemView {
	private currentTavern: Tavern | null = null;
	private plugin: TavernGeneratorPlugin;
	private isEditMode: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: TavernGeneratorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return TAVERN_VIEW_TYPE;
	}

	getDisplayText() {
		return "Tavern Generator";
	}

	getIcon(): string {
		return "beer";
	}
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("tavern-generator-view");

		const controls = container.createDiv({ cls: "tavern-controls-container" });
		const selectsDiv = controls.createDiv({ cls: "tavern-controls" });
		
		const locationsData = GlobalDataCache['locations.json'] || { locations: [] };
		const levelsData = GlobalDataCache['tavern_levels.json'] || { quality: [] };

		const locationSelect = selectsDiv.createEl("select", { cls: "dropdown" });
		locationSelect.createEl("option", { text: "Локация: Случайно", value: "Случайно" });
		(locationsData.locations || []).forEach((loc: string) => locationSelect.createEl("option", { text: loc, value: loc }));

		const qualitySelect = selectsDiv.createEl("select", { cls: "dropdown" });
		qualitySelect.createEl("option", { text: "Качество: Случайно", value: "Случайно" });
		(levelsData.quality || []).forEach((q: string) => qualitySelect.createEl("option", { text: q, value: q }));

		const actionBtnsDiv = selectsDiv.createDiv({ attr: { style: "display: flex; gap: 4px;" } });

		const editBtn = actionBtnsDiv.createEl("button", { cls: "tavern-edit-btn", attr: { title: "Редактировать таверну" } });
		setIcon(editBtn, "pencil");
		if (this.isEditMode) editBtn.addClass("is-active");
		editBtn.onclick = () => {
			this.isEditMode = !this.isEditMode;
			this.renderTavern(container);
		};

		const saveBtn = actionBtnsDiv.createEl("button", { cls: "tavern-edit-btn", attr: { title: "Сохранить в заметку" } });
		setIcon(saveBtn, "save");
		saveBtn.onclick = async () => {
			if (this.currentTavern) {
				await this.saveTavernToNote();
			} else {
				new Notice("Сначала сгенерируйте таверну!");
			}
		};

		const generateBtn = controls.createEl("button", { text: "Сгенерировать таверну", cls: "mod-cta" });
		generateBtn.onclick = () => {
			const loc = locationSelect.value;
			const qual = qualitySelect.value;
			this.currentTavern = generateTavern(loc, qual);
			this.renderTavern(container);
		};

		// Placeholder for tavern content
		container.createDiv({ cls: "tavern-content-container" });
	}

	private renderTavern(container: Element) {
		let contentContainer = container.querySelector(".tavern-content-container");
		if (!contentContainer) {
			contentContainer = container.createDiv({ cls: "tavern-content-container" });
		}
		contentContainer.empty();

		if (!this.currentTavern) return;
		const tavern = this.currentTavern;

		const quality = tavern.level.split(" (")[0];
		const roomsCount = tavern.rooms.reduce((acc, r) => acc + (r.count ?? 1), 0);
		const servantsCount = tavern.staff.filter(s => s.role === "Прислуга").length;
		const bouncersCount = tavern.staff.filter(s => s.role === "Вышибала").length;

		let roomsStr = roomsCount === 0 ? "без комнат" : roomsCount === 1 ? "1 комната" : (roomsCount >= 2 && roomsCount <= 4) ? `${roomsCount} комнаты` : `${roomsCount} комнат`;
		let servantsStr = servantsCount === 0 ? "нет прислуги" : servantsCount === 1 ? "1 прислуга" : (servantsCount >= 2 && servantsCount <= 4) ? `${servantsCount} прислуги` : `${servantsCount} прислуг`;
		let bouncersStr = bouncersCount === 0 ? "" : bouncersCount === 1 ? ", 1 вышибала" : (bouncersCount >= 2 && bouncersCount <= 4) ? `, ${bouncersCount} вышибалы` : `, ${bouncersCount} вышибал`;
		
		tavern.level = `${quality} (${roomsStr}; ${servantsStr}${bouncersStr})`;

		const card = contentContainer.createDiv({ cls: "tavern-card" });
		
		card.createEl("div", { text: tavern.name, cls: "tavern-title" });
		const subtitle = card.createDiv({ cls: "tavern-subtitle" });
		subtitle.createSpan({ cls: "tavern-subtitle-badge", text: `${tavern.level}` });
		subtitle.createSpan({ cls: "tavern-subtitle-badge", text: `${tavern.territory}` });

		const self = this;
		
		function makeEditable(el: HTMLElement, onSave: (val: string) => void) {
			if (!self.isEditMode) return;
			el.style.cursor = "text";
			el.title = "Двойной клик для редактирования";
			el.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				const currentText = el.textContent || "";
				const input = el.createEl("input", { type: "text", value: currentText, cls: "tavern-inline-edit" });
				el.textContent = "";
				el.appendChild(input);
				input.focus();
				
				const save = () => {
					const newVal = input.value.trim() || currentText;
					onSave(newVal);
					self.renderTavern(container);
				};
				
				input.addEventListener("blur", save);
				input.addEventListener("keydown", (evt) => {
					if (evt.key === "Enter") save();
					if (evt.key === "Escape") {
						onSave(currentText);
						self.renderTavern(container);
					}
				});
			});
		}

		function renderItemWithControls(
			containerEl: HTMLElement, 
			itemText: string, 
			subtext: string | null, 
			rightText: string | null, 
			onReroll: (() => void) | null, 
			onDelete: (() => void) | null,
			onEditLeft?: (newVal: string) => void,
			onEditSub?: (newVal: string) => void,
			onEditRight?: (newVal: string) => void
		) {
			const item = containerEl.createDiv({ cls: "tavern-item" });
			const left = item.createDiv({ cls: "tavern-item-left" });
			const leftTextEl = left.createSpan({ text: itemText });
			if (onEditLeft) makeEditable(leftTextEl, onEditLeft);

			if (subtext) {
				const subTextEl = left.createSpan({ cls: "tavern-item-subtext", text: subtext });
				if (onEditSub) makeEditable(subTextEl, onEditSub);
			}
			
			const rightContainer = item.createDiv({ attr: { style: "display: flex; align-items: center;" }});
			
			if (rightText) {
				const priceClass = rightText.includes("ЗМ") ? "price-zm" : rightText.includes("СМ") ? "price-sm" : rightText.includes("ММ") ? "price-mm" : "";
				const rightTextEl = rightContainer.createDiv({ cls: `tavern-item-right ${priceClass}`.trim(), text: rightText });
				if (onEditRight) makeEditable(rightTextEl, onEditRight);
			}

			if (self.isEditMode && (onReroll || onDelete)) {
				const controls = rightContainer.createDiv({ cls: "tavern-item-controls" });
				if (onReroll) {
					const btn = controls.createEl("button", { cls: "tavern-icon-btn", attr: { title: "Реролл" } });
					setIcon(btn, "refresh-cw");
					btn.onclick = () => { onReroll(); self.renderTavern(container); };
				}
				if (onDelete) {
					const btn = controls.createEl("button", { cls: "tavern-icon-btn delete-btn", attr: { title: "Удалить" } });
					setIcon(btn, "trash");
					btn.onclick = () => { onDelete(); self.renderTavern(container); };
				}
			}
		}

		function renderAddButton(containerEl: HTMLElement, text: string, onClick: () => void) {
			if (!self.isEditMode) return;
			const btnContainer = containerEl.createDiv({ cls: "add-btn-container" });
			const btn = btnContainer.createEl("button", { cls: "add-item-btn" });
			const iconSpan = btn.createSpan({ cls: "tavern-btn-icon" });
			setIcon(iconSpan, "plus");
			btn.createSpan({ text: text, attr: { style: "margin-left: 6px;" } });
			btn.onclick = () => { onClick(); self.renderTavern(container); };
		}

		function renderRoomItemWithControls(containerEl: HTMLElement, roomIndex: number) {
			const room = tavern.rooms[roomIndex];
			const card = containerEl.createDiv({ cls: "tavern-room-card" });
			if (room.count === 0) card.addClass("is-empty");
			
			const header = card.createDiv({ cls: "tavern-room-header" });
			
			const titleEl = header.createDiv({ cls: "tavern-room-title", text: room.type });
			makeEditable(titleEl, (newVal) => { room.type = newVal; });

			const priceClass = room.price.includes("ЗМ") ? "price-zm" : room.price.includes("СМ") ? "price-sm" : room.price.includes("ММ") ? "price-mm" : "";
			const priceEl = header.createDiv({ cls: `tavern-room-price ${priceClass}`.trim(), text: room.price });
			makeEditable(priceEl, (newVal) => { room.price = newVal; });

			const controlsRow = card.createDiv({ cls: "tavern-room-controls" });
			
			const qtyDiv = controlsRow.createDiv({ cls: "tavern-room-qty" });
			if (self.isEditMode) {
				const minusBtn = qtyDiv.createEl("button", { cls: "tavern-icon-btn", attr: { style: "padding: 0 4px;" } });
				setIcon(minusBtn, "minus");
				minusBtn.onclick = () => {
					if (room.count > 0) {
						room.count--;
					}
					self.renderTavern(container);
				};
			}
			
			qtyDiv.createSpan({ text: `${room.count} шт.`, attr: { style: "font-size: 0.9em; min-width: 32px; text-align: center;" } });

			if (self.isEditMode) {
				const plusBtn = qtyDiv.createEl("button", { cls: "tavern-icon-btn", attr: { style: "padding: 0 4px;" } });
				setIcon(plusBtn, "plus");
				plusBtn.onclick = () => {
					room.count++;
					self.renderTavern(container);
				};
			}
		}

		// Atmosphere
		const atmSection = card.createDiv({ cls: "tavern-section" });
		atmSection.createDiv({ text: "В зале", cls: "tavern-section-title" });
		atmSection.createDiv({ cls: "tavern-text-block", text: tavern.atmosphere });
		
		tavern.patrons.forEach((p, index) => {
			renderItemWithControls(
				atmSection, `${p.name} (${p.race})`, p.quirk, null,
				() => { tavern.patrons[index] = generateSinglePatron(); },
				() => { tavern.patrons.splice(index, 1); },
				(newVal) => {
					const match = newVal.match(/(.*)\s+\((.*)\)/);
					if (match) {
						tavern.patrons[index].name = match[1].trim();
						tavern.patrons[index].race = match[2].trim();
					} else {
						tavern.patrons[index].name = newVal;
					}
				},
				(newVal) => { tavern.patrons[index].quirk = newVal; }
			);
		});
		renderAddButton(atmSection, "Добавить посетителя", () => {
			tavern.patrons.push(generateSinglePatron());
		});

		// Rooms
		const qualityLevel = tavern.level.split(' ')[0];
		const roomsSection = card.createDiv({ cls: "tavern-section" });
		roomsSection.createDiv({ text: "Комнаты и Цены", cls: "tavern-section-title" });
		
		const roomsGrid = roomsSection.createDiv({ cls: "tavern-rooms-grid" });
		tavern.rooms.forEach((room, index) => {
			renderRoomItemWithControls(roomsGrid, index);
		});

		// Staff
		const staffSection = card.createDiv({ cls: "tavern-section" });
		staffSection.createDiv({ text: "Персонал", cls: "tavern-section-title" });
		
		const hosts = tavern.staff.filter(npc => npc.role === "Хозяин / Бармен");
		const servants = tavern.staff.filter(npc => npc.role === "Прислуга");
		const bouncers = tavern.staff.filter(npc => npc.role === "Вышибала");

		if (hosts.length > 0) {
			hosts.forEach((npc, index) => {
				const globalIndex = tavern.staff.indexOf(npc);
				renderItemWithControls(
					staffSection, `${npc.name} (${npc.race})`, `Роль: ${npc.role} | Особенность: ${npc.quirk}`, null,
					() => { tavern.staff[globalIndex] = generateNPC(npc.role); },
					() => { tavern.staff.splice(globalIndex, 1); },
					(newVal) => {
						const match = newVal.match(/(.*)\s+\((.*)\)/);
						if (match) {
							tavern.staff[globalIndex].name = match[1].trim();
							tavern.staff[globalIndex].race = match[2].trim();
						} else {
							tavern.staff[globalIndex].name = newVal;
						}
					}
				);
			});
		}

		const staffColumns = staffSection.createDiv({ cls: "menu-columns" });
		
		const servantsColumn = staffColumns.createDiv({ cls: "menu-column" });
		servantsColumn.createDiv({ text: "Прислуга", cls: "menu-column-title" });
		servants.forEach(npc => {
			const globalIndex = tavern.staff.indexOf(npc);
			renderItemWithControls(
				servantsColumn, `${npc.name} (${npc.race})`, npc.quirk, null,
				() => { tavern.staff[globalIndex] = generateNPC("Прислуга"); },
				() => { tavern.staff.splice(globalIndex, 1); },
				(newVal) => {
					const match = newVal.match(/(.*)\s+\((.*)\)/);
					if (match) {
						tavern.staff[globalIndex].name = match[1].trim();
						tavern.staff[globalIndex].race = match[2].trim();
					} else {
						tavern.staff[globalIndex].name = newVal;
					}
				},
				(newVal) => { tavern.staff[globalIndex].quirk = newVal; }
			);
		});
		renderAddButton(servantsColumn, "Добавить прислугу", () => {
			tavern.staff.push(generateNPC("Прислуга"));
		});

		const bouncersColumn = staffColumns.createDiv({ cls: "menu-column" });
		bouncersColumn.createDiv({ text: "Вышибалы", cls: "menu-column-title" });
		bouncers.forEach(npc => {
			const globalIndex = tavern.staff.indexOf(npc);
			renderItemWithControls(
				bouncersColumn, `${npc.name} (${npc.race})`, npc.quirk, null,
				() => { tavern.staff[globalIndex] = generateNPC("Вышибала"); },
				() => { tavern.staff.splice(globalIndex, 1); },
				(newVal) => {
					const match = newVal.match(/(.*)\s+\((.*)\)/);
					if (match) {
						tavern.staff[globalIndex].name = match[1].trim();
						tavern.staff[globalIndex].race = match[2].trim();
					} else {
						tavern.staff[globalIndex].name = newVal;
					}
				},
				(newVal) => { tavern.staff[globalIndex].quirk = newVal; }
			);
		});
		renderAddButton(bouncersColumn, "Добавить вышибалу", () => {
			tavern.staff.push(generateNPC("Вышибала"));
		});

		// Menu
		const menuSection = card.createDiv({ cls: "tavern-section" });
		menuSection.createDiv({ text: "Меню", cls: "tavern-section-title" });
		
		const menuColumns = menuSection.createDiv({ cls: "menu-columns" });
		
		const foodColumn = menuColumns.createDiv({ cls: "menu-column" });
		foodColumn.createDiv({ text: "Блюда", cls: "menu-column-title" });
		tavern.menu.food.forEach((f, index) => {
			const parts = f.split(" — ");
			renderItemWithControls(
				foodColumn, parts[0], null, parts[1] || null,
				() => { tavern.menu.food[index] = generateSingleFood(qualityLevel); },
				() => { tavern.menu.food.splice(index, 1); },
				(newVal) => { tavern.menu.food[index] = `${newVal} — ${parts[1] || ""}`; },
				undefined,
				(newVal) => { tavern.menu.food[index] = `${parts[0]} — ${newVal}`; }
			);
		});
		renderAddButton(foodColumn, "Добавить блюдо", () => {
			tavern.menu.food.push(generateSingleFood(qualityLevel));
		});

		const drinksColumn = menuColumns.createDiv({ cls: "menu-column" });
		drinksColumn.createDiv({ text: "Напитки", cls: "menu-column-title" });
		tavern.menu.drinks.forEach((d, index) => {
			const parts = d.split(" — ");
			renderItemWithControls(
				drinksColumn, parts[0], null, parts[1] || null,
				() => { tavern.menu.drinks[index] = generateSingleDrink(qualityLevel); },
				() => { tavern.menu.drinks.splice(index, 1); },
				(newVal) => { tavern.menu.drinks[index] = `${newVal} — ${parts[1] || ""}`; },
				undefined,
				(newVal) => { tavern.menu.drinks[index] = `${parts[0]} — ${newVal}`; }
			);
		});
		renderAddButton(drinksColumn, "Добавить напиток", () => {
			tavern.menu.drinks.push(generateSingleDrink(qualityLevel));
		});

		const specialsSection = card.createDiv({ cls: "tavern-section", attr: { style: "margin-top: 15px;" } });
		specialsSection.createDiv({ text: "Особое предложение", cls: "tavern-section-title" });
		
		const chefParts = tavern.menu.chefSpecial.split(" — ");
		renderItemWithControls(
			specialsSection, "Блюдо от шефа", chefParts[0], chefParts[1] || null,
			() => { tavern.menu.chefSpecial = generateSingleFood(qualityLevel); },
			null, // no delete for special
			undefined,
			(newVal) => { tavern.menu.chefSpecial = `${newVal} — ${chefParts[1] || ""}`; },
			(newVal) => { tavern.menu.chefSpecial = `${chefParts[0]} — ${newVal}`; }
		);
		
		const drinkParts = tavern.menu.specialDrink.split(" — ");
		renderItemWithControls(
			specialsSection, "Фирменный напиток", drinkParts[0], drinkParts[1] || null,
			() => { tavern.menu.specialDrink = generateSingleDrink(qualityLevel); },
			null,
			undefined,
			(newVal) => { tavern.menu.specialDrink = `${newVal} — ${drinkParts[1] || ""}`; },
			(newVal) => { tavern.menu.specialDrink = `${drinkParts[0]} — ${newVal}`; }
		);

		// Rumors
		const rumorsSection = card.createDiv({ cls: "tavern-section" });
		rumorsSection.createDiv({ text: "Слухи", cls: "tavern-section-title" });
		tavern.rumors.forEach((r, index) => {
			renderItemWithControls(
				rumorsSection, r, null, null,
				() => { tavern.rumors[index] = generateSingleRumor(); },
				() => { tavern.rumors.splice(index, 1); },
				(newVal) => { tavern.rumors[index] = newVal; }
			);
		});
		renderAddButton(rumorsSection, "Добавить слух", () => {
			tavern.rumors.push(generateSingleRumor());
		});
	}

	private async saveTavernToNote() {
		if (!this.currentTavern) return;
		const tavern = this.currentTavern;

		const hosts = tavern.staff.filter(npc => npc.role === "Хозяин / Бармен");
		const servants = tavern.staff.filter(npc => npc.role === "Прислуга");
		const bouncers = tavern.staff.filter(npc => npc.role === "Вышибала");

		const content = `# ${tavern.name}
**Уровень обслуживания:** ${tavern.level}
**Расположение:** ${tavern.territory}

## В зале
*${tavern.atmosphere}*

**Посетители:**
${tavern.patrons.map(p => `- **Посетитель:** ${p.name} (${p.race}) — *${p.quirk}*`).join('\n')}

## Комнаты и Цены
${tavern.rooms.map(r => `- ${r.count}x ${r.type} — ${r.price}`).join('\n')}

## Персонал
${hosts.map(npc => `- **${npc.role}:** ${npc.name} (${npc.race}) — *${npc.quirk}*`).join('\n')}

| Прислуга | Вышибалы |
| :--- | :--- |
${Array.from({ length: Math.max(servants.length, bouncers.length) }).map((_, i) => {
	const s = servants[i] ? `${servants[i].name} (${servants[i].race}) — *${servants[i].quirk}*` : "";
	const b = bouncers[i] ? `${bouncers[i].name} (${bouncers[i].race}) — *${bouncers[i].quirk}*` : "";
	return `| ${s} | ${b} |`;
}).join('\n')}

## Меню

| Блюда | Напитки |
| :--- | :--- |
${Array.from({ length: Math.max(tavern.menu.food.length, tavern.menu.drinks.length) }).map((_, i) => {
	const f = tavern.menu.food[i] || "";
	const d = tavern.menu.drinks[i] || "";
	return `| ${f} | ${d} |`;
}).join('\n')}

**Особое предложение:**
- **Блюдо от шефа:** ${tavern.menu.chefSpecial}
- **Фирменный напиток:** ${tavern.menu.specialDrink}

## Слухи
${tavern.rumors.map(r => `- ${r}`).join('\n')}

${this.plugin.settings.defaultTags}
`;

		let baseFilename = `Таверна ${tavern.name}.md`;
		baseFilename = baseFilename.replace(/[\\/:"*?<>|]/g, '');
		
		const folderPath = this.plugin.settings.saveFolderPath.trim();
		let fullPath = folderPath ? `${folderPath}/${baseFilename}` : baseFilename;

		if (folderPath) {
			const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folderExists) {
				try {
					await this.app.vault.createFolder(folderPath);
				} catch (e) {
					console.error("Could not create folder. Saving to root.", e);
					fullPath = baseFilename; // fallback to root
				}
			}
		}

		let fileExists = this.app.vault.getAbstractFileByPath(fullPath);
		let counter = 1;
		while (fileExists) {
			const nameWithCounter = `Таверна ${tavern.name} (${counter}).md`.replace(/[\\/:"*?<>|]/g, '');
			fullPath = folderPath ? `${folderPath}/${nameWithCounter}` : nameWithCounter;
			fileExists = this.app.vault.getAbstractFileByPath(fullPath);
			counter++;
		}

		try {
			const newFile = await this.app.vault.create(fullPath, content);
			new Notice(`Таверна сохранена: ${fullPath}`);
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(newFile);
		} catch (error) {
			console.error("Error creating note:", error);
			new Notice("Ошибка при сохранении заметки!");
		}
	}

	async onClose() {
		// Cleanup if needed
	}
}
