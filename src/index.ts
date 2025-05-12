import dotenv from 'dotenv';
console.log("[Index] Starting script execution..."); // Log 1

dotenv.config(); // Load environment variables from .env file
console.log("[Index] dotenv configured."); // Log 2

// --- Standard Top-Level Imports ---
console.log("[Index] Importing modules..."); // Log 3
import { bot } from './bot/bot.js';
import { startListener } from './listener/telegramListener.js';
import { runScraper, startScrapingScheduler } from './scraper.js';
import { config } from './config.js';
console.log("[Index] Modules imported."); // Log 4

async function main() {
    console.log("[Main] Starting main function..."); // Log 5

    console.log("[Main] Checking Listener config..."); // Log 6
    if (config.listener.apiId && config.listener.apiHash && config.listener.phoneNumber) {
        console.log("[Main] Initializing Telegram Listener..."); // Log 7
        startListener().catch(err => {
             console.error("[Main] Error during Telegram Listener startup:", err);
        });
        console.log("[Main] Telegram Listener setup initiated (runs in background)."); // Log 8
    } else {
        console.warn("[Main] Telegram Listener credentials (API_ID, API_HASH, PHONE_NUMBER) not found in .env. Listener will not start."); // Log 7a
    }

    console.log("[Main] Initializing Scraper..."); // Log 9
    try {
        await runScraper(); 
        console.log("[Main] Initial scrape run completed."); // Log 10
        startScrapingScheduler(); 
        console.log("[Main] Scraping scheduler started."); // Log 11
    } catch (err) {
        console.error("[Main] Error initializing Scraper:", err);
    }
    
    console.log("[Main] Starting GrammY Bot (polling)..."); // Log 12
    try {
        bot.start({ 
            onStart: (botInfo) => {
                console.log(`[Main] GrammY Bot @${botInfo.username} started successfully! Polling active.`); // Log 13
            },
            allowed_updates: ["message", "callback_query", "my_chat_member"],
        });
        console.log("[Main] bot.start() called. Process should stay alive due to polling."); // Log 14
    } catch (err) {
         console.error("[Main] Error starting GrammY Bot:", err);
         process.exit(1); 
    }
}

main().catch((err: Error) => {
    console.error("[Index] Unhandled error during main() execution:", err);
    process.exit(1);
});

console.log("[Index] Script execution finished setup phase. Bot should be polling."); // Log 15 