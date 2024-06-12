# Quote Bot

This Quote Bot is a Node.js application that selects a random quote from a Google Spreadsheet, generates an image with the quote, and posts it to a Discord channel. The bot ensures that quotes are not repeated within a 14-day period.

## Example

 ![Quote example](https://i.imgur.com/aisGrVe.jpg)

## Requirements

To run the code in this repository, you need to have the following:

- Node.js (v14 or higher)
- MongoDB database
- Google Sheets API access
- Discord Webhook URL

## Setup
- Clone this repository:

    ```bash
    git clone https://github.com/Rensvdk20/SmoedoeQuotes.git
    ```

- Install dependencies:

    ```bash
    npm install
    ```

- Environment Setup (Create an .env file)

    ```bash
    MONGODB_CONNECTION_STRING=<Your MongoDB connection string>
    SPREADSHEET_ID=<Your Google Spreadsheet ID>
    SHEET_NAME=<Your Google Sheet name>
    SHEETS_API_KEY=<Your Google Sheets API key>
    NAMES_TO_QUOTE=<JSON array of names to quote, e.g., '["Name1", "Name2"]'>
    DISCORD_WEBHOOK=<Your Discord Webhook URL>
    ```

## Usage

- Run the bot:

    ```bash
    node quotes.js
    ```