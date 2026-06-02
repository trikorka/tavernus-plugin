import { GlobalDataCache } from '../../main';

function getRandomElements<T>(arr: T[], count: number): T[] {
	const shuffled = [...arr].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count);
}

function getRandomElement<T>(arr: T[]): T {
	if (!arr || arr.length === 0) return "" as any;
	return arr[Math.floor(Math.random() * arr.length)];
}

export interface Menu {
	food: string[];
	drinks: string[];
	chefSpecial: string;
	specialDrink: string;
}

function generateRandomPrice(quality: string, type: "food" | "drink"): string {
	let amount = 1;
	let currency = 'ММ';

	if (quality === "Скромная таверна") {
		amount = type === "drink" ? 1 : Math.floor(Math.random() * 2) + 1;
		currency = 'ММ';
	} else if (quality === "Средняя таверна") {
		amount = type === "drink" ? 1 : Math.floor(Math.random() * 3) + 1;
		currency = 'СМ';
	} else if (quality === "Богатая таверна") {
		amount = type === "drink" ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 3) + 2;
		currency = 'ЗМ';
	}
	
	return `${amount} ${currency}`;
}

function getValidMeals() {
	const menuData = GlobalDataCache['menu.json'] || {};
	const allMeals = [
		...(menuData.cheapFood || []),
		...(menuData.normalFood || []),
		...(menuData.luxuryFood || []),
		...(menuData.meals_extended || [])
	];
	return allMeals.length > 0 ? allMeals : ["Похлебка"];
}

function getValidDrinks() {
	const menuData = GlobalDataCache['menu.json'] || {};
	const allDrinks = [
		...(menuData.cheapDrinks || []),
		...(menuData.normalDrinks || []),
		...(menuData.luxuryDrinks || []),
		...(menuData.drinks_extended || [])
	];
	return allDrinks.length > 0 ? allDrinks : ["Вода"];
}

export function generateSingleFood(quality: string): string {
	const validMeals = getValidMeals();
	const foodNameRaw = getRandomElement(validMeals);
	
	if (foodNameRaw.includes('|')) {
		const [name, price] = foodNameRaw.split('|').map(s => s.trim());
		return `${name} — ${price}`;
	}
	
	return `${foodNameRaw} — ${generateRandomPrice(quality, "food")}`;
}

export function generateSingleDrink(quality: string): string {
	const validDrinks = getValidDrinks();
	const drinkNameRaw = getRandomElement(validDrinks);
	
	if (drinkNameRaw.includes('|')) {
		const [name, price] = drinkNameRaw.split('|').map(s => s.trim());
		return `${name} — ${price}`;
	}

	return `${drinkNameRaw} — ${generateRandomPrice(quality, "drink")}`;
}

function processSpecial(itemRaw: string, defaultPrice: string, quality: string, type: "food" | "drink"): string {
	if (itemRaw.includes('|')) {
		const [name, price] = itemRaw.split('|').map(s => s.trim());
		return `${name} — ${price}`;
	}
	if (defaultPrice) {
		return `${itemRaw} — ${defaultPrice}`;
	}
	return `${itemRaw} — ${generateRandomPrice(quality, type)}`;
}

export function generateMenu(specialDishPrice: string, specialDrinkPrice: string, quality: string): Menu {
	const foodCount = Math.floor(Math.random() * 3) + 3; // 3-5 блюд
	const drinkCount = Math.floor(Math.random() * 3) + 3; // 3-5 напитков
	
	const food: string[] = [];
	for (let i = 0; i < foodCount; i++) {
		food.push(generateSingleFood(quality));
	}
	
	const drinks: string[] = [];
	for (let i = 0; i < drinkCount; i++) {
		drinks.push(generateSingleDrink(quality));
	}

	const menuData = GlobalDataCache['menu.json'] || {};
	const chefSpecials = menuData.chefSpecials && menuData.chefSpecials.length > 0 ? menuData.chefSpecials : getValidMeals();
	const specialDrinks = menuData.specialDrinks && menuData.specialDrinks.length > 0 ? menuData.specialDrinks : getValidDrinks();
	
	return {
		food,
		drinks,
		chefSpecial: processSpecial(getRandomElement(chefSpecials), specialDishPrice, quality, "food"),
		specialDrink: processSpecial(getRandomElement(specialDrinks), specialDrinkPrice, quality, "drink")
	};
}
