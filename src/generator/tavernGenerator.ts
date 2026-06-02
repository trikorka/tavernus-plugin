import { generateTavernName } from './nameGenerator';
import { generateStaff, NPC } from './staffGenerator';
import { generateMenu, Menu } from './menuGenerator';
import { GlobalDataCache } from '../../main';

export interface Room {
	type: string;
	price: string;
	count: number;
}

export interface Tavern {
	name: string;
	territory: string;
	level: string; // "Дешевый (4 комнаты; 3 прислуги...)"
	rooms: Room[];
	staff: NPC[];
	menu: Menu;
	atmosphere: string;
	patrons: NPC[];
	rumors: string[];
}

function getRandomElement<T>(arr: T[]): T {
	if (!arr || arr.length === 0) return "" as any;
	return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomElements<T>(arr: T[], count: number): T[] {
	const shuffled = [...arr].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count);
}

export function generateSinglePatron(usedNames?: Record<string, number>): NPC {
	const { generateNPC } = require('./staffGenerator');
	const baseNpc = generateNPC("Посетитель", usedNames);
	const atmosphereData = GlobalDataCache['atmosphere.json'] || {};
	baseNpc.quirk = getRandomElement(atmosphereData.patron_quirks || []);
	return baseNpc;
}

export function generateSingleRumor(): string {
	const atmosphereData = GlobalDataCache['atmosphere.json'] || {};
	return getRandomElement(atmosphereData.rumors || []);
}

export function generateSingleRoom(quality: string): Room {
	const levelsData = GlobalDataCache['tavern_levels.json'] || { quality: [], size: [], prices: [] };
	const qualityIndex = levelsData.quality.indexOf(quality) > -1 ? levelsData.quality.indexOf(quality) : 0;
	const priceStr = levelsData.prices[qualityIndex] || levelsData.prices[0] || "";
	const parsedPrices = parsePrices(priceStr);

	const possibleRooms: Omit<Room, 'count'>[] = [];
	if (parsedPrices.commonRoom) possibleRooms.push({ type: "Общая комната", price: parsedPrices.commonRoom });
	if (parsedPrices.normalRoom) possibleRooms.push({ type: "Простая комната", price: parsedPrices.normalRoom });
	if (quality === "Богатая таверна") possibleRooms.push({ type: "Комната для аристократов", price: "15 ЗМ" });
	
	const selected = possibleRooms[Math.floor(Math.random() * possibleRooms.length)];
	return { ...selected, count: 1 };
}

export function parsePrices(priceStr: string) {
	let formatted = priceStr
		.replace(/медяк[а-я]*/gi, 'ММ')
		.replace(/серебрян[а-я]*/gi, 'СМ')
		.replace(/золот[а-я]*/gi, 'ЗМ');

	const commonRoom = formatted.match(/Общая комната\s*-\s*([^,\n]+)/i)?.[1] || "";
	const normalRoom = formatted.match(/Простая комната\s*-\s*([^,\n]+)/i)?.[1] || "";
	const specialDish = formatted.match(/Особое блюдо\s*-\s*([^,\n]+)/i)?.[1] || "";
	const specialDrink = formatted.match(/Особый напиток\s*-\s*([^,\n]+)/i)?.[1] || "";
	return { commonRoom, normalRoom, specialDish, specialDrink };
}

export function generateTavern(preferredLocation?: string, preferredQuality?: string): Tavern {
	const levelsData = GlobalDataCache['tavern_levels.json'] || { quality: [], size: [], prices: [] };
	let qualityIndex = -1;
	
	if (preferredQuality && preferredQuality !== "Случайно") {
		qualityIndex = levelsData.quality.indexOf(preferredQuality);
	}
	
	if (qualityIndex === -1 && levelsData.quality.length > 0) {
		qualityIndex = Math.floor(Math.random() * levelsData.quality.length);
	}

	const quality = levelsData.quality[qualityIndex] || "Средняя таверна";
	const size = getRandomElement(levelsData.size) || "4 комнаты; 2 обслуживающего персонала";
	
	const priceStr = levelsData.prices[qualityIndex] || levelsData.prices[0] || "";
	const parsedPrices = parsePrices(priceStr);

	const name = generateTavernName();
	
	let territory = "";
	const locationsData = GlobalDataCache['locations.json'] || { locations: [], territories: [] };
	if (preferredLocation && preferredLocation !== "Случайно") {
		territory = preferredLocation;
	} else {
		territory = getRandomElement(locationsData.locations) || "";
	}
	
	const rooms: Room[] = [];
	const roomMatch = size.match(/(\d+)\+?\s*комнат[аы]?/i);
	const totalRooms = roomMatch ? parseInt(roomMatch[1], 10) : 0;

	const availableTypes: Room[] = [];
	availableTypes.push({ type: "Общая комната", price: parsedPrices.commonRoom || "2 ММ", count: 0 });
	availableTypes.push({ type: "Простая комната", price: parsedPrices.normalRoom || "5 СМ", count: 0 });
	availableTypes.push({ type: "Комната для аристократов", price: "15 ЗМ", count: 0 });

	if (totalRooms > 0 && availableTypes.length > 0) {
		// Filter only valid types for random distribution
		const validTypesForRandom = availableTypes.filter(t => {
			if (t.type === "Комната для аристократов" && quality !== "Богатая таверна") return false;
			return true;
		});
		
		const pool = validTypesForRandom.length > 0 ? validTypesForRandom : availableTypes;

		for (let i = 0; i < totalRooms; i++) {
			const randomType = pool[Math.floor(Math.random() * pool.length)];
			randomType.count += 1;
		}
	}

	availableTypes.forEach(t => rooms.push(t));

	const usedNames: Record<string, number> = {};
	
	const numPatrons = Math.floor(Math.random() * 2) + 2; // 2-3 patrons
	const generatedPatrons: NPC[] = [];
	for (let i = 0; i < numPatrons; i++) {
		generatedPatrons.push(generateSinglePatron(usedNames));
	}

	const atmosphereData = GlobalDataCache['atmosphere.json'] || {};

	return {
		name,
		territory,
		level: `${quality} (${size})`,
		rooms,
		staff: generateStaff(size, usedNames),
		menu: generateMenu(parsedPrices.specialDish, parsedPrices.specialDrink, quality),
		atmosphere: getRandomElement(atmosphereData.atmospheres || []),
		patrons: generatedPatrons,
		rumors: getRandomElements(atmosphereData.rumors || [], Math.floor(Math.random() * 2) + 1)   // 1-2 rumors
	};
}
