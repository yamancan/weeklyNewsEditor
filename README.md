# RWAnews-ts Telegram Bot & Scraper

## 1. Overview

This project is a TypeScript-based Telegram bot designed to monitor news sources, process news articles, and interact with users for tasks like content summarization using OpenAI's GPT models. It is a conversion of an original Python application, leveraging the GrammY framework for Telegram bot functionalities, Axios and Cheerio for web scraping, and the official OpenAI SDK for AI-powered text generation.

**Core Functionalities:**

*   **Web Scraping:** Periodically scrapes news articles from a specified website (e.g., Ledger Insights).
*   **Telegram Bot Interaction:**
    *   Receives messages (including forwarded messages) from users.
    *   Allows authorized users to submit news content.
    *   Presents interactive inline keyboards for actions on news items.
    *   Manages conversation flows for tasks like providing new prompts for GPT.
*   **OpenAI GPT Integration:**
    *   Summarizes news content using specified GPT models (e.g., gpt-4o, gpt-3.5-turbo).
    *   Allows users to customize prompts for GPT summarization.
*   **Content Forwarding:** Sends processed news and summaries to a designated main Telegram group.
*   **Dynamic Configuration:** Uses environment variables for critical settings like API keys, bot tokens, and target group IDs.

## 2. Prerequisites

*   Node.js (v18.x or higher recommended)
*   npm (usually comes with Node.js) or yarn
*   A Telegram Bot Token (get this from BotFather on Telegram)
*   An OpenAI API Key
*   Access to a Telegram Group ID where the bot will post messages.

## 3. Setup and Installation

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <your-repository-url>
    cd RWAnews-ts
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Create and configure the environment file:**
    *   Create a `.env` file in the root of the project.
    *   Copy the contents from the example below or from `src/config.ts` structure and fill in your actual values.

    ```env
    # Bot Configuration
    TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
    EDITORS_GROUP_ID="-100xxxxxxxxxx" # Your Editor's Group ID
    NEWS_CHANNEL_ID="-100yyyyyyyyyy" # Your public News Channel ID
    ALLOWED_USER_IDS="123456789,987654321" # Comma-separated Telegram User IDs (Bot Admins)

    # Telegram User Client (Listener) Configuration
    TELEGRAM_API_ID="YOUR_TELEGRAM_API_ID"       # Get from my.telegram.org
    TELEGRAM_API_HASH="YOUR_TELEGRAM_API_HASH"     # Get from my.telegram.org
    TELEGRAM_PHONE_NUMBER="+1234567890"  # Your phone number for the user account
    TELEGRAM_SESSION_PATH="./telegram_session" # Path to store session file (optional)
    SOURCE_CHAT_IDS="-100aaaaaaa,-100bbbbbbb,username_or_id" # Comma-separated IDs/usernames of channels/groups to listen to
    # LISTENER_USER_ID="" # Optional: ID of the user account running the listener (if you want to auto-allow it)

    # OpenAI Configuration
    OPENAI_API_KEY="YOUR_OPENAI_API_KEY"

    # Web Scraper Configuration
    HOME_URL="https://www.ledgerinsights.com/category/news/"
    SCRAPE_INTERVAL_HOURS="4"

    # General
    LOG_LEVEL="info"
    ```

4.  **Review `src/config.ts`:** This file loads and validates the environment variables. Ensure your `.env` file aligns with the expected variables.

## 4. Running the Bot

1.  **Build the TypeScript code:**
    ```bash
    npm run build
    ```
    This command compiles the TypeScript files from `src/` into JavaScript files in the `dist/` directory.

2.  **Start the bot:**
    ```bash
    npm start
    ```
    This command runs the compiled `dist/index.js` file.

3.  **Development Mode (with auto-rebuild and restart):**
    ```bash
    npm run dev
    ```
    This will watch for changes in your TypeScript files, automatically rebuild, and restart the bot using `nodemon`.

## 5. Project Structure

```
RWAnews-ts/
├── .env                    # Local environment variables (ignored by git)
├── package.json            # Project dependencies and scripts
├── tsconfig.json           # TypeScript compiler configuration
├── README.md               # This documentation file
├── src/
│   ├── index.ts            # Main application entry point: initializes and starts the bot & scraper
│   ├── config.ts           # Loads and exports environment variables and constants
│   ├── types.ts            # Shared TypeScript type definitions and interfaces
│   ├── scraper.ts          # Logic for web scraping news articles
│   ├── services/
│   │   └── openaiService.ts  # Handles interactions with the OpenAI API
│   ├── bot/
│   │   ├── bot.ts            # Bot instance creation, session management, middleware registration
│   │   ├── handlers.ts       # Defines handlers for messages, commands, and callback queries
│   │   ├── conversations.ts  # Logic for multi-step conversations (e.g., new prompt input)
│   │   └── keyboards.ts      # Functions to generate inline keyboards for bot messages
│   └── storage.ts            # In-memory storage for message data and scraped news list
└── dist/                     # Compiled JavaScript output (generated by `npm run build`)
```

## 6. Key Components and Logic

*   **`src/index.ts`:** Initializes `dotenv` to load environment variables, creates the bot instance, sets up the scraper, and starts both.
*   **`src/config.ts`:** Provides type-safe access to all configurations. Crucial for API keys, bot settings, and scraper parameters.
*   **`src/types.ts`:** Centralizes all custom types, including `MyContext` (GrammY context with session and conversation flavors), `MessageData` (for storing state related to messages with interactive buttons), and `CallbackQueryData`.
*   **`src/storage.ts`:** Implements a simple in-memory key-value store (`messageStore`) to track messages for which interactive buttons have been sent. Also maintains a `newsList` set to avoid re-processing/re-sending scraped news.
*   **`src/scraper.ts`:** Uses `axios` to fetch HTML from `config.scraper.homeUrl` and `cheerio` to parse it. It extracts article titles, links, and summaries. It checks against `newsList` before sending a new article link to the bot (via a direct call to a bot method or by simulating a message).
    *   **Note on Channel Listening:** Unlike the Python version's `Telethon` client, this bot (using `GrammY`) cannot directly listen to arbitrary channels as a user. It relies on messages from source channels being *forwarded* to it. The `handleForwardedMessage` in `src/bot/handlers.ts` is designed for this.
*   **`src/services/openaiService.ts`:** Contains the `generateGptSummary` function, which constructs the payload for the OpenAI API and handles the response.
*   **`src/bot/bot.ts`:**
    *   Creates the main `Bot` instance from `grammy`.
    *   Initializes session middleware (`grammy/conversations`) for storing data like the current GPT model or conversation states.
    *   Registers the conversations plugin and the actual conversation functions defined in `src/bot/conversations.ts`.
    *   Registers all command, message, and callback query handlers from `src/bot/handlers.ts`.
*   **`src/bot/handlers.ts`:**
    *   `handleNewMessages`: Processes direct text messages sent to the bot by authorized users.
    *   `handleForwardedMessage`: Processes messages forwarded to the bot.
    *   `buttonClickHandler`: Handles all callback queries originating from inline keyboard buttons.
    *   `handleChangeGptModelCommand`: Handles the `/gpt` command for changing the OpenAI model.
    *   Each handler creates and stores `MessageData` in `storage.ts` and sends messages with appropriate `InlineKeyboardMarkup` from `src/bot/keyboards.ts`.
*   **`src/bot/keyboards.ts`:** Provides functions to generate the `InlineKeyboardMarkup` objects for different scenarios (e.g., main news actions, GPT model selection, cancel buttons).
*   **`src/bot/conversations.ts`:** Implements conversation logic using `@grammyjs/conversations`. For example, the "New Prompt" flow is managed here, waiting for user input after they click the "New Prompt" button.

## 7. Environment Variables

All crucial configuration is managed via environment variables. Ensure the `.env` file is correctly set up in the project root:

*   `TELEGRAM_BOT_TOKEN`: Your Telegram bot's API token.
*   `OPENAI_API_KEY`: Your OpenAI API key.
*   `MAIN_GROUP_ID`: The numeric ID of the Telegram group where the bot will send its primary messages and summaries.
*   `ALLOWED_USER_IDS`: A comma-separated list of numeric Telegram User IDs who are authorized to send commands/messages directly to the bot for processing.
*   `LOG_LEVEL`: Controls the logging verbosity (e.g., `info`, `debug`). (Currently, basic console logging is used).
*   `HOME_URL`: The URL of the news website's homepage/category page to scrape.
*   `SCRAPE_INTERVAL_HOURS`: How often (in hours) the web scraper should run.

## 8. Future Improvements / Considerations

*   **Persistent Storage:** The current `messageStore` and `newsList` are in-memory and will be lost on restart. For production, consider a persistent database (e.g., Redis, PostgreSQL, MongoDB).
*   **Advanced Error Handling:** Implement more robust error handling and reporting, potentially with a logging library like Winston or Pino.
*   **Telethon Equivalent for Channel Listening:** If direct channel listening (not just forwarded messages) is a hard requirement, explore options like using the `grammY` user bot mode (requires running the bot as a user account, which has different implications and setup) or a separate microservice still using something like Telethon (Python) or an equivalent Node.js Telegram client library (if one meets the needs) that then communicates with this bot via an API or message queue.
*   **Unit and Integration Tests:** Add tests to ensure reliability.
*   **More Sophisticated Scraping:** For websites with JavaScript-heavy content or anti-scraping measures, Puppeteer or Playwright might be necessary.
*   **Scalability:** For very high traffic, consider breaking down services further or using a message queue for inter-service communication.

This documentation should provide a good starting point for understanding and developing the `RWAnews-ts` project. 