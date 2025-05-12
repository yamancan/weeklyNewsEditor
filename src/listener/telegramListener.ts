import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js'; // .js extension
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js'; // .js extension
import { config } from '../config.js'; // .js extension
import { bot } from '../bot/bot.js'; // Import the bot instance to send messages to it
import input from 'input'; // For interactive login prompts

// --- Listener Setup ---

// Session string will be stored in memory for this example.
// For production, you MUST save this string securely (e.g., .env file, database, or a local file via TELEGRAM_SESSION_PATH)
// and load it on startup to avoid logging in every time.
// If config.listener.sessionPath is set, we can try to use it (though this example doesn't fully implement file-based session persistence).
let sessionString = process.env.TELEGRAM_SESSION_STRING || ''; // Load from .env if available
const client = new TelegramClient(new StringSession(sessionString), config.listener.apiId, config.listener.apiHash, {
    connectionRetries: 5,
    // You might need to configure baseDC if you have issues connecting
    // baseDC: 2, // For example
});

/**
 * Handles incoming messages from the listened-to channels/groups.
 * Forwards the message text to the main GrammY bot (to its private chat or a specific user ID).
 */
async function handleNewMessageEvent(event: NewMessageEvent) {
    const message = event.message;
    console.log(`[Listener] New message from chat ${message.chatId}: ${message.text?.substring(0, 50)}...`);

    // Ensure message text exists
    if (!message.text) {
        console.log("[Listener] Message has no text, skipping.");
        return;
    }

    try {
        // Send the received message text to our GrammY bot.
        // The bot will then process it via its `handleNewMessages` handler if the sender is the listener.
        // For this to work, the listener's own user ID needs to be known by the bot (config.listener.listenerUserId)
        // and ideally added to config.telegram.allowedUserIds in the bot's config.
        // This sends the message *as the listener user* to the *bot's username*.
        // Replace '@YOUR_BOT_USERNAME' with the actual username of your GrammY bot.
        // Or, find a way to get the bot's ID to send directly.
        // A more robust way might be to send to a specific user ID (e.g., an admin or the listener's own ID if the bot can read its own messages)
        // and have that user/bot forward it to the editors group.
        
        // For simplicity, let's assume the bot can receive messages from this listener user
        // and the handleNewMessages will pick it up based on listenerUserId.
        // We send the message to the bot itself.
        const botUsername = (await bot.api.getMe()).username;
        if (botUsername) {
            await client.sendMessage(`@${botUsername}`, {
                 message: message.text, // Send the plain text
                 // Consider adding more details if needed, e.g., original sender, link to message
            });
            console.log(`[Listener] Forwarded message text to @${botUsername}`);
        } else {
            console.error("[Listener] Could not get bot username to forward message.");
        }

    } catch (error) {
        console.error("[Listener] Error forwarding message to bot:", error);
    }
}

/**
 * Starts the Telegram user client (listener).
 * Handles interactive login if no session string is provided.
 */
export async function startTelegramListener() {
    console.log("[Listener] Starting Telegram User Client...");

    // Register event handler for new messages from specified chats
    // Note: To listen to specific chats, the user client must be a member of those chats.
    // The `chats` filter in `NewMessage` takes an array of chat IDs (numbers) or usernames (strings).
    // Convert string IDs from config to numbers if they are numeric.
    const sourceChatIdsNumericOrString = config.listener.sourceChatIds.map(id => {
        const numId = parseInt(id, 10);
        return isNaN(numId) ? id : numId; // Keep as string if not a valid number (e.g. username)
    });

    client.addEventHandler(handleNewMessageEvent, new NewMessage({ chats: sourceChatIdsNumericOrString }));

    try {
        await client.start({
            phoneNumber: config.listener.phoneNumber,
            phoneCode: async () => await input.text("Please enter the code you received: "),
            onError: (err) => console.error("[Listener] Connection error:", err),
            // Optional: Password for 2FA
            password: async () => {
                const pw = await input.text("Please enter your 2FA password: ");
                return pw;
            },
            // Optional: If `sessionName` is used for file-based sessions by StringSession 
            // (though StringSession primarily uses the string in memory or passed to constructor).
            // sessionName: config.listener.sessionPath 
        });

        console.log("[Listener] User Client connected successfully.");
        console.log("[Listener] Current session string (SAVE THIS SECURELY for TELEGRAM_SESSION_STRING env var):");
        console.log(client.session.save());

        // Keep the listener running
        console.log("[Listener] Listening for new messages in specified chats...");
        // The client will run in the background due to the event handlers.
        // For a script that needs to explicitly stay alive:
        // await new Promise(resolve => setTimeout(resolve, Infinity)); 

    } catch (error) {
        console.error("[Listener] Failed to start or connect user client:", error);
        // process.exit(1); // Exit if connection fails critically
    }
}

// Optional: Graceful shutdown
// process.on('SIGINT', async () => {
//     console.log("[Listener] SIGINT received, disconnecting client...");
//     await client.disconnect();
//     process.exit(0);
// });
// process.on('SIGTERM', async () => {
//     console.log("[Listener] SIGTERM received, disconnecting client...");
//     await client.disconnect();
//     process.exit(0);
// });
