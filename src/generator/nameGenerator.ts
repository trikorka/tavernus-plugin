import { GlobalDataCache } from '../../main';

function getRandomElement<T>(arr: T[]): T {
	if (!arr || arr.length === 0) return "" as any;
	return arr[Math.floor(Math.random() * arr.length)];
}

export function generateTavernName(): string {
	const NamesData = GlobalDataCache['tavern_names.json'] || {};
	const genders = ['female', 'male', 'neuter', 'plural'] as const;
	const selectedGender = getRandomElement(genders as any) as 'female' | 'male' | 'neuter' | 'plural';

	const adjectives = NamesData[`adjectives_${selectedGender}`] || [];
	const nouns = NamesData[`nouns_${selectedGender}`] || [];
	
	const adj = getRandomElement(adjectives) || "";
	const noun = getRandomElement(nouns) || "";

	// 15% chance to just use a prefix + noun
	if (Math.random() < 0.15 && NamesData.prefixes && NamesData.prefixes.length > 0) {
		const prefix = getRandomElement(NamesData.prefixes);
		return `${prefix} и ${noun}`;
	}

	return `${adj} ${noun}`.trim();
}
