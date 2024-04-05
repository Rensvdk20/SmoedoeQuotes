import "dotenv/config";
import axios from "axios";
import FormData from "form-data";
import cron from "node-cron";
import * as fs from "fs";
import { createCanvas, loadImage } from "canvas";

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

		//Get the indexes that contain quotes under the names
		const validIndexes = JSON.parse(process.env.NAMES_TO_QUOTE)
			.map((name) => namesRow.indexOf(name))
			.filter((index) => {
				// Check if the name has at least one quote
				const hasQuote = quoteRows.some((row) => Boolean(row[index]));
				return index !== -1 && hasQuote;
			});

		//Stop if zero quotes are found
		if (validIndexes.length === 0) {
			console.error("No people found to quote");
			return;
		}

		// Randomly select a name and their quotes
		const randomIndex =
			validIndexes[Math.floor(Math.random() * validIndexes.length)];
		const name = namesRow[randomIndex];
		const quotes = response.data.values
			.slice(3)
			.map((row) => row[randomIndex])
			.filter(Boolean);

		// Randomly select a quote and parse it to get the date
		const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
		const { text, date } = parseQuote(randomQuote);

		return { name, quote: text, date };
	} catch (err) {
		console.error("Error generating quote", err);
	}
}

async function generateImageWithQuote() {
	const imageWidth = 600;
	const imageHeight = 400;
	const canvas = createCanvas(imageWidth, imageHeight);
	const ctx = canvas.getContext("2d");

	//Get the quote
	const quoteData = await getRandomQuote();
	if (!quoteData) {
		throw new Error("Failed to generate quote");
	}

	const { name, quote, date } = quoteData;

	// Set up the canvas with the background image
	ctx.drawImage(await loadImage("https://picsum.photos/600/400"), 0, 0);

	// Prepare text properties and calculate necessary adjustments
	const textProperties = {
		fontSize: 40,
		fontType: "Arial",
		fillStyle: "white",
		strokeStyle: "black",
		lineWidth: 4,
	};

	const maxQuoteWidth = imageWidth - 40;
	const lines = splitQuoteIntoLines(
		quote,
		maxQuoteWidth,
		ctx,
		textProperties
	);

	// Draw the quote text on the canvas
	const finalYPosition = drawTextOnCanvas(
		ctx,
		lines,
		textProperties,
		imageWidth,
		imageHeight
	);

	// Put the name/date under the quote
	appendNameAndDate(
		ctx,
		finalYPosition,
		name,
		date,
		imageWidth,
		textProperties
	);

	return canvas;
}

function splitQuoteIntoLines(
	quote,
	maxQuoteWidth,
	ctx,
	{ fontSize, fontType }
) {
	ctx.font = `${fontSize}px ${fontType}`;
	const words = quote.split(" ");
	const lines = [];
	let currentLine = words[0];

	//Split the quote lines to fit the canvas
	for (let i = 1; i < words.length; i++) {
		const word = words[i];
		const width = ctx.measureText(`${currentLine} ${word}`).width;
		if (width < maxQuoteWidth) {
			currentLine += ` ${word}`;
		} else {
			lines.push(currentLine);
			currentLine = word;
		}
	}

	// Add the last line
	lines.push(currentLine);
	return lines;
}

function drawTextOnCanvas(
	ctx,
	lines,
	{ fontSize, fontType, fillStyle, strokeStyle, lineWidth },
	imageWidth,
	imageHeight
) {
	ctx.font = `${fontSize}px ${fontType}`;
	ctx.fillStyle = fillStyle;
	ctx.strokeStyle = strokeStyle;
	ctx.lineWidth = lineWidth;

	//Center text vertically
	let y = imageHeight / 2 - ((lines.length - 1) * fontSize) / 2;

	lines.forEach((line) => {
		const lineWidth = ctx.measureText(line).width;
		// Center text horizontally
		const x = (imageWidth - lineWidth) / 2;
		ctx.strokeText(line, x, y);
		ctx.fillText(line, x, y);
		// Move to the next line
		y += fontSize;
	});

	// Return the final Y position after drawing the quote
	return y;
}

function appendNameAndDate(
	ctx,
	startY,
	name,
	date,
	canvasWidth,
	{ fontSize, fontType }
) {
	// Smaller font size for author and date
	ctx.font = `${fontSize * 0.75}px ${fontType}`;
	const authorDateText = `- ${name} ${date ? `${date}` : ""}`;
	const textWidth = ctx.measureText(authorDateText).width;
	// Center horizontally
	const x = (canvasWidth - textWidth) / 2;
	// Start below the quote
	const y = startY + fontSize;
	ctx.strokeText(authorDateText, x, y);
	ctx.fillText(authorDateText, x, y);
}

function getCurrentDate() {
	const currentDate = new Date();
	const day = String(currentDate.getDate()).padStart(2, "0");
	const month = String(currentDate.getMonth() + 1).padStart(2, "0");
	const year = currentDate.getFullYear();

	const formattedDate = `${day}-${month}-${year}`;
	return formattedDate;
}

async function sendQuote() {
	try {
		const canvas = await generateImageWithQuote();
		const out = fs.createWriteStream("./quote.jpeg");
		const stream = canvas.createJPEGStream();
		stream.pipe(out);

		await new Promise((resolve, reject) => {
			out.on("finish", resolve);
			out.on("error", reject);
		});

		// Create a form
		let data = new FormData();
		// Add the generated image to the form
		data.append("file1", fs.createReadStream("./quote.jpeg"));
		// Add the message content
		data.append(
			"payload_json",
			JSON.stringify({
				content:
					"--------------------------------------\n٠•● **Smoedoe Quote of The Day** ●•٠\n--------------------------------------",
			})
		);

		let config = {
			method: "post",
			url: process.env.DISCORD_WEBHOOK,
			data: data,
			headers: data.getHeaders(),
		};

		await axios.request(config);
		console.log(`Send quote of the day (${getCurrentDate()})`);
	} catch (error) {
		console.error("Error sending quote", error);
	}
}

cron.schedule("0 20 * * *", () => {
	sendQuote();
});
