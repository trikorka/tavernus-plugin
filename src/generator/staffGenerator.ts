import { GlobalDataCache } from '../../main';

function getRandomElement<T>(arr: T[]): T {
	if (!arr || arr.length === 0) return "" as any;
	return arr[Math.floor(Math.random() * arr.length)];
}

export interface NPC {
	name: string;
	race: string;
	role: string;
	quirk: string;
}

export function generateNPC(role: string, usedNames?: Record<string, number>): NPC {
	const names = GlobalDataCache['npc_names.json'] || [];
	const staffData = GlobalDataCache['staff_quirks.json'] || { races: [], quirks: [] };

	let attempts = 0;
	let name = getRandomElement(names);

	if (usedNames) {
		while (usedNames[name] && usedNames[name] >= 2 && attempts < 10) {
			name = getRandomElement(names);
			attempts++;
		}
		usedNames[name] = (usedNames[name] || 0) + 1;
	}

	return {
		name: name || "Неизвестный",
		race: getRandomElement(staffData.races),
		role: role,
		quirk: getRandomElement(staffData.quirks)
	};
}

export function generateStaff(sizeString: string, usedNames?: Record<string, number>): NPC[] {
	const staff: NPC[] = [];
	
	// Владелец
	staff.push(generateNPC("host", usedNames));
	
	// Parse servants
	const servantsMatch = sizeString.match(/(\d+)\+?\s+(обслуживающ[а-я\s]+|waitstaff)/i);
	const servantsCount = servantsMatch ? parseInt(servantsMatch[1]) : 0;

	// Parse bouncers
	const bouncersMatch = sizeString.match(/(\d+)\+?\s+(охран[а-я]+|bouncer)/i);
	const bouncersCount = bouncersMatch ? parseInt(bouncersMatch[1]) : 0;

	for (let i = 0; i < servantsCount; i++) {
		staff.push(generateNPC("servant", usedNames));
	}

	for (let i = 0; i < bouncersCount; i++) {
		staff.push(generateNPC("bouncer", usedNames));
	}

	return staff;
}
