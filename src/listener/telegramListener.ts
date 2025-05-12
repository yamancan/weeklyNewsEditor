import { TelegramClient, sessions } from 'telegram';
const { StringSession } = sessions;
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js'; // .js extension
import { config } from '../config.js'; // .js extension
import { bot } from '../bot/bot.js'; // Import the bot instance to send messages to it
import input from 'input'; // For interactive login prompts

let client: TelegramClient | null = null;

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

    // Check if the client is actually connected before trying to use it
    if (!client || !client.connected) { 
        console.warn("[Listener] Received message, but client is not connected. Skipping forward.");
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
        const botInfo = await bot.api.getMe();
        const botUsername = botInfo.username;

        if (botUsername) {
            // Added null check before using client
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
 * Initializes and starts the Telegram client listener.
 */
export async function startListener() {
    // Only proceed if essential listener config is provided
    if (!config.listener.apiId || !config.listener.apiHash) {
        console.warn('[Listener] TELEGRAM_API_ID or TELEGRAM_API_HASH not provided in .env. Skipping listener initialization.');
        return; // Do not start the listener
    }

    const sessionString = process.env.TELEGRAM_SESSION_STRING; // Load existing session string if available
    const stringSession = new StringSession(sessionString || ''); // Use empty string if no session yet

    console.log('[Listener] Initializing Telegram client...');
    client = new TelegramClient(stringSession, config.listener.apiId, config.listener.apiHash, {
        connectionRetries: 5,
        // deviceModel: "RWANews Bot Listener" // Optional: Identify the client
    });

    try {
        console.log('[Listener] Connecting to Telegram...');
        await client.start({
            phoneNumber: async () => config.listener.phoneNumber || await input.text('Please enter your phone number: '),
            password: async () => await input.text('Please enter your password: '),
            phoneCode: async () => await input.text('Please enter the code you received: '),
            onError: (err) => console.error('[Listener] Connection error:', err),
        });

        console.log('[Listener] Connected successfully!');

        // Save the session string after successful connection
        // Check if client is not null before accessing session
        if (client) { 
            const currentSession = client.session.save(); 
            // Check if save() returned a non-empty string
            if (typeof currentSession === 'string' && currentSession && currentSession !== sessionString) {
                console.log('[Listener] New session string generated. Please update TELEGRAM_SESSION_STRING in your .env file:');
                console.log(currentSession);
            }
        }

        // --- Add Event Handlers --- 
        // Check if client is not null before adding handler
        if(client) {
            client.addEventHandler(handleNewMessageEvent, new NewMessage({ chats: config.listener.sourceChatIds }));
            console.log(`[Listener] Listening for messages in source chats: ${config.listener.sourceChatIds.join(', ')}`);
        }

    } catch (error) {
        console.error('[Listener] Failed to start or connect Telegram client:', error);
        client = null; // Reset client on failure
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
