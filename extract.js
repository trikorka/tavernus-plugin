const fs = require('fs');

const content = fs.readFileSync('temp_tavern/js/tavern.js', 'utf8');

function extractArray(pattern, separator) {
    const match = content.match(pattern);
    if (match) {
        return match[1].split(separator).map(s => s.trim()).filter(s => s);
    }
    return [];
}

const data = {
    location: [
        "Болото", "Большой Город", "Горы", "Деревня", "Заброшенная Дорога",
        "Подземье", "Север", "Порт", "Пустыня", "Равнина", "Тропики", "Леса", "Трущобы"
    ],
    name_components: {
        prefixes: extractArray(/var nl3="([^"]+)"/, ','),
        adjectives_female: extractArray(/var pr_f1="([^"]+)"/, ','),
        adjectives_male: extractArray(/var pr_m1="([^"]+)"/, ','),
        adjectives_neuter: extractArray(/var pr__1="([^"]+)"/, ','),
        adjectives_plural: extractArray(/var pr_all="([^"]+)"/, ','),
        nouns_female: extractArray(/var ln_f1="([^"]+)"/, ','),
        nouns_male: extractArray(/var ln_m1="([^"]+)"/, ','),
        nouns_neuter: extractArray(/var ln__1="([^"]+)"/, ',')
    },
    levels: [],
    prices: [],
    meals: [],
    drinks: [],
	sizes: []
};

// Meals
let mealMatches = content.matchAll(/function dish_[a-z_]+_m\(\)\{[\s\S]*?var nl1="([^"]+)";/g);
for (const match of mealMatches) {
    data.meals.push(...match[1].split(';').map(s => s.trim()).filter(s => s));
}

// Drinks
let drinkMatches = content.matchAll(/function dish_[a-z_]+_d\(\)\{[\s\S]*?var nl2="([^"]+)";/g);
for (const match of drinkMatches) {
    data.drinks.push(...match[1].split(';').map(s => s.trim()).filter(s => s));
}

// Level
data.levels = extractArray(/function tl\([^]*?var ln="([^"]+)"/, ';');

// Sizes
data.sizes = extractArray(/function tavern_size\([^]*?var nl1="([^"]+)"/, '|');

// Price
let priceMatches = content.matchAll(/price="([^"]+)"/g);
for (const match of priceMatches) {
	if (match[1] !== "---") {
		data.prices.push(match[1]);
	}
}

// Save to JSON files
fs.writeFileSync('location.json', JSON.stringify(data.location, null, 2));
fs.writeFileSync('name_components.json', JSON.stringify(data.name_components, null, 2));
fs.writeFileSync('levels.json', JSON.stringify(data.levels, null, 2));
fs.writeFileSync('prices.json', JSON.stringify([...new Set(data.prices)], null, 2));
fs.writeFileSync('meals.json', JSON.stringify([...new Set(data.meals)], null, 2));
fs.writeFileSync('drinks.json', JSON.stringify([...new Set(data.drinks)], null, 2));
fs.writeFileSync('sizes.json', JSON.stringify(data.sizes, null, 2));

console.log("Extraction complete.");
