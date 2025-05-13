import { Bot, session, MemorySessionStorage } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { MyContext, SessionData } from '../types.js'; // .js extension
import { config } from '../config.js'; // .js extension
import { InlineKeyboard } from 'grammy';
import {
    authMiddleware,
    handleNewMessages,
    handleForwardedMessage, // Keep this, though primary input might be from listener via handleNewMessages
    handleChangeGptModelCommand,
    buttonClickHandler,
    errorHandler
} from './handlers.js'; // .js extension
import { newPromptConversation } from './conversations.js'; // .js extension

// Create the bot instance
export const bot = new Bot<MyContext>(config.telegram.botToken);

// --- Session Middleware ---
// Initialize session data
function initialSessionData(): SessionData {
    return {
        currentGptModel: config.openai.defaultModel, // Set default model initially
        messageStoreIdForNewPrompt: undefined,
    };
}

// Use in-memory storage for sessions (consider persistent storage for production)
// Note: MemorySessionStorage scales poorly.
// Explore `@grammyjs/storage-redis`, `@grammyjs/storage-file`, etc. for better options.
bot.use(session({
    initial: initialSessionData,
    storage: new MemorySessionStorage<SessionData>(),
}));

// --- Conversations Middleware ---
bot.use(conversations());

// --- Register Conversations ---
// Register the conversation functions with the bot.
// The first argument is the identifier used in `ctx.conversation.enter("identifier")`
bot.use(createConversation(newPromptConversation, "newPromptConversation"));

// --- Register Handlers & Middleware ---

// Authentication Middleware (apply before most handlers)
// Note: Apply carefully. It might block necessary interactions if not configured correctly.
// Maybe apply only to commands or private chat initially.
bot.use(authMiddleware);

// Command Handlers
bot.command("gpt", handleChangeGptModelCommand);
// Add other commands here if needed (e.g., /start, /help)
bot.command("start", (ctx) => {
    const keyboard = new InlineKeyboard()
        .text("🚀 Start Scraping", "start_scraping").row()
        .text("❓ Support", "support");
    
    ctx.reply("Welcome! Use the buttons below or forward news items if you are authorized.", {
        reply_markup: keyboard
    });
});

// Message Handlers
// Handle :forward_date first if direct forwarding handling is desired separate from listener
// bot.on(":forward_date", handleForwardedMessage); 
// Handle regular text messages (includes messages sent by listener to bot)
bot.on(":text", handleNewMessages);

// Callback Query Handler (for inline buttons)
bot.on("callback_query:data", buttonClickHandler);

// --- Error Handler ---
// Register the general error handler. This should generally be the last handler.
bot.catch(errorHandler);

// --- Start Function (optional, can be called from index.ts) ---
export async function startBot() {
    // Get bot info
    const botInfo = await bot.api.getMe();
    console.log(`Bot ${botInfo.first_name} (@${botInfo.username}) is starting...`);

    // Set bot commands for the menu
    await bot.api.setMyCommands([
        { command: "start", description: "Starts the bot and shows main actions" },
        { command: "gpt", description: "Change GPT model" },
        // Add other commands here if you want them in the menu
    ]);
    console.log("Bot commands registered with Telegram.");

    // Start polling
    await bot.start({
        drop_pending_updates: true, // Optional: Drop updates received while the bot was offline
        onStart: () => {
            console.log(`Bot @${botInfo.username} started successfully.`);
        },
    });
}

// Export the configured bot instance if needed elsewhere (though usually index.ts just calls startBot)
// export default bot; 