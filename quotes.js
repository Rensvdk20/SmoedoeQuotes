import "dotenv/config";
import axios from "axios";

// Parse quote and extract the date
function parseQuote(quote) {
	const quoteRegex = /^(.*?)(?:\s*\((\d{1,2}-\d{1,2}-\d{2,4})\))?$/;
	const match = quote.match(quoteRegex);
	return {
		text: match ? match[1].trim() : quote,
		date: match && match[2] ? match[2] : null,
	};
}

// Get data from the spreadsheet and generate the quote
async function getRandomQuote() {
	try {
		const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SPREADSHEET_ID}/values/${process.env.SHEET_NAME}?key=${process.env.SHEETS_API_KEY}`;
		const response = await axios.get(url);

		// Check for valid values
		if (!response.data.values || response.data.values.length < 3) {
			console.error("Invalid data format");
			return;
		}

		const namesRow = response.data.values[2];
		const quoteRows = response.data.values.slice(3);

		const validIndexes = JSON.parse(process.env.NAMES_TO_QUOTE)
			.map((name) => namesRow.indexOf(name))
			.filter((index) => {
				// Check if the name has at least one quote
				const hasQuote = quoteRows.some((row) => Boolean(row[index]));
				return index !== -1 && hasQuote;
			});

		if (validIndexes.length === 0) {
			console.error("No people found to quote");
			return;
		}

		// Randomly select a name and its corresponding quotes
		const randomIndex =
			validIndexes[Math.floor(Math.random() * validIndexes.length)];
		const randomName = namesRow[randomIndex];
		const quotes = response.data.values
			.slice(3)
			.map((row) => row[randomIndex])
			.filter(Boolean);

		// Randomly select a quote and parse it
		const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
		const { text, date } = parseQuote(randomQuote);

		const content = `Name: ${randomName}\nQuote: "${text}"\nDate: ${date}`;

		return content;
	} catch (err) {
		console.error("Error generating quote", err);
	}
}

async function generateQuote() {
	const quote = await getRandomQuote();
	console.log(quote);

	axios.post(process.env.DISCORD_WEBHOOK, {
		content: quote,
	});
}

generateQuote();
