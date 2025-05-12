import { Bot, GrammyError, HttpError, InlineKeyboard, NextFunction } from 'grammy';
import { MyContext, CallbackQueryData, MyConversation } from '../types';
import { config } from '../config';
import { 
    createMainKeyboard, 
    createGptModelKeyboard, 
    createCancelKeyboard 
} from './keyboards.js';
import { getMessageData, storeMessageData, deleteMessageData } from '../storage.js';
import { generateGptSummary } from '../services/openaiService.js';
import { v4 as uuidv4 } from 'uuid';

// --- Utility Functions ---

/** Checks if the user interacting with the bot is authorized based on config. */
function isUserAuthorized(ctx: MyContext): boolean {
    if (!ctx.from) return false; // Cannot determine sender
    // Allow configured admins OR the listener user (if configured)
    return config.telegram.allowedUserIds.includes(ctx.from.id) || 
           (config.listener.listenerUserId !== undefined && ctx.from.id === config.listener.listenerUserId);
}

/** Sends the main action prompt with keyboard to the editors group */
async function sendActionPrompt(ctx: MyContext, text: string, scrapedContent?: string) {
    const messageStoreId = uuidv4();
    const keyboard = createMainKeyboard(messageStoreId);
    const cancelKeyboard = createCancelKeyboard(messageStoreId);

    storeMessageData(messageStoreId, {
        messageId: messageStoreId,
        originalMessageText: text,
        keyboard: keyboard.inline_keyboard, // Store the actual button structure
        cancelButton: cancelKeyboard.inline_keyboard[0], // Store just the cancel button row
        scrapedMessageContent: scrapedContent,
    });

    try {
        // Send the original/forwarded message content first
        await ctx.api.sendMessage(config.telegram.editorsGroupId, text, { parse_mode: "Markdown" });
        // Then send the prompt with the keyboard
        await ctx.api.sendMessage(config.telegram.editorsGroupId, "Choose an option:", {
            reply_markup: keyboard,
        });
    } catch (error) {
        console.error("Error sending action prompt:", error);
        // Attempt to send just the prompt if the first message failed (e.g., formatting)
        try {
            await ctx.api.sendMessage(config.telegram.editorsGroupId, "Choose an option:", {
                reply_markup: keyboard,
            });
        } catch (error2) {
            console.error("Failed to send even the fallback prompt:", error2);
        }
    }
}

// --- Middleware & Handlers ---

/** Middleware to filter out unauthorized users */
export async function authMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
    if (ctx.chat?.type === 'private' && !isUserAuthorized(ctx)) {
        console.log(`Unauthorized access attempt by user ${ctx.from?.id}`);
        await ctx.reply("You are not authorized to use this bot directly.");
        return; // Stop processing
    }
    // For group messages, check if the sender is authorized if it's a direct command/message to the bot
    // Note: Button clicks in the group don't strictly need this if only authorized users are in the group,
    // but it adds a layer of security for commands.
    if (ctx.message?.text?.startsWith('/') && !isUserAuthorized(ctx)) {
         console.log(`Unauthorized command attempt by user ${ctx.from?.id} in group ${ctx.chat?.id}`);
         // Maybe send a temporary message? Silently ignoring might be better in groups.
         return; 
    }
    await next(); // Proceed to the next handler if authorized
}

/** Handles direct text messages sent to the bot or by authorized users in the editors group */
export async function handleNewMessages(ctx: MyContext): Promise<void> {
    // Ignore messages without text or from outside allowed contexts
    if (!ctx.message?.text || !ctx.from) return;

    // Only process messages from authorized users OR messages in the editors group
    if (ctx.chat?.id === config.telegram.editorsGroupId || (ctx.chat?.type === 'private' && isUserAuthorized(ctx))) {
        // If the message comes from the listener user, treat it as forwarded content
        if (ctx.from.id === config.listener.listenerUserId) {
             console.log(`Received message from listener: ${ctx.message.text.substring(0, 50)}...`);
             await sendActionPrompt(ctx, ctx.message.text); 
        } else if (isUserAuthorized(ctx)) { // Handle messages from other authorized users
            console.log(`Received direct/group message from authorized user ${ctx.from.id}: ${ctx.message.text.substring(0, 50)}...`);
            // Process as potential news item
            await sendActionPrompt(ctx, ctx.message.text);
        } else {
             console.log(`Ignoring message from non-authorized user ${ctx.from.id} in editors group.`);
        }
    } else {
        console.log(`Ignoring message from chat ${ctx.chat?.id} / user ${ctx.from?.id}`);
    }
}

/** Handles messages forwarded to the bot */
export async function handleForwardedMessage(ctx: MyContext): Promise<void> {
    // Forwarded messages might lack ctx.from, use message.forward_from etc.
    // Let's assume for now the Listener Service forwards messages in a way that handleNewMessages catches them
    // If the Listener Service forwards *as the user*, ctx.from might be the original user.
    // If the Listener Service forwards *as the listener account*, ctx.from is the listener.
    // We are relying on the listener forwarding to the bot's private chat or the editors group
    // and handleNewMessages catching it based on the sender ID (listenerUserId).
    console.log("Forwarded message received, relying on handleNewMessages logic.");
    // If direct forwarding to the bot is needed, a specific handler might be required:
    // if (ctx.message?.forward_origin && ctx.message.text) {
    //     if (isUserAuthorized(ctx)) { // Or maybe check if forwarder is listener?
    //         await sendActionPrompt(ctx, ctx.message.text);
    //     }
    // }
}

/** Handles the /gpt command to change the OpenAI model */
export async function handleChangeGptModelCommand(ctx: MyContext): Promise<void> {
    if (!isUserAuthorized(ctx)) {
        await ctx.reply("Unauthorized to change settings.");
        return;
    }
    const keyboard = createGptModelKeyboard();
    await ctx.reply("Choose the default OpenAI model:", { reply_markup: keyboard });
}

/** Handles button clicks from inline keyboards */
export async function buttonClickHandler(ctx: MyContext): Promise<void> {
    if (!ctx.callbackQuery?.data || !ctx.from) {
        await ctx.answerCallbackQuery({ text: "Error: Invalid callback data." });
        return;
    }
    // Only process callbacks from authorized users (important in groups)
    if (!isUserAuthorized(ctx)) {
         await ctx.answerCallbackQuery({ text: "Error: Unauthorized action." });
         return;
    }

    let data: CallbackQueryData;
    try {
        data = JSON.parse(ctx.callbackQuery.data);
    } catch (error) {
        console.error("Failed to parse callback query data:", ctx.callbackQuery.data, error);
        await ctx.answerCallbackQuery({ text: "Error: Invalid callback format." });
        return;
    }

    const messageData = getMessageData(data.messageStoreId);
    if (!messageData) {
        await ctx.answerCallbackQuery({ text: "Error: Original message context not found. It might be too old." });
        await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); // Remove buttons
        return;
    }

    switch (data.query) {
        case 'gpt4o':
            ctx.session.currentGptModel = 'gpt-4o';
            await ctx.answerCallbackQuery({ text: "Model set to GPT-4o" });
            await ctx.editMessageText("Default OpenAI model set to GPT-4o.", { reply_markup: new InlineKeyboard() });
            break;
        case 'gpt3.5turbo':
            ctx.session.currentGptModel = 'gpt-3.5-turbo';
            await ctx.answerCallbackQuery({ text: "Model set to GPT-3.5 Turbo" });
            await ctx.editMessageText("Default OpenAI model set to GPT-3.5 Turbo.", { reply_markup: new InlineKeyboard() });
            break;
        case 'cancelGptChange':
            await ctx.answerCallbackQuery({ text: "Cancelled" });
            await ctx.editMessageText("GPT model selection cancelled.", { reply_markup: new InlineKeyboard() });
            break;

        case 'sendGpt':
            await ctx.answerCallbackQuery({ text: "Processing with GPT..." });
            const contentToSend = messageData.scrapedMessageContent || messageData.originalMessageText;
            const gptModel = ctx.session.currentGptModel || config.openai.defaultModel;
            const gptResult = await generateGptSummary(contentToSend, config.openai.readyPrompt, gptModel);
            
            if (gptResult) {
                // Send the GPT result as a new message with action buttons
                await sendActionPrompt(ctx, gptResult); 
                // Optionally edit the original message to show it was processed
                // await ctx.editMessageText("Original message processed by GPT.", { reply_markup: new InlineKeyboard() });
            } else {
                await ctx.api.sendMessage(config.telegram.editorsGroupId, "Sorry, failed to get a response from OpenAI.");
            }
            // Clean up the original prompt message buttons? Or leave them?
            // deleteMessageData(data.messageStoreId);
            // await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }); // Remove buttons from original
            break;

        case 'sendChannel':
            await ctx.answerCallbackQuery({ text: "Sending to news channel..." });
            const textToSend = messageData.gptGeneratedContent || messageData.originalMessageText;
            try {
                await ctx.api.sendMessage(config.telegram.newsChannelId, textToSend, { parse_mode: "Markdown" });
                await ctx.editMessageText("Sent to news channel!", { reply_markup: new InlineKeyboard() });
                deleteMessageData(data.messageStoreId); // Clean up after successful send
            } catch (error) {
                console.error(`Failed to send message to news channel ${config.telegram.newsChannelId}:`, error);
                await ctx.api.sendMessage(config.telegram.editorsGroupId, `Failed to send message to the news channel. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                await ctx.answerCallbackQuery({ text: "Error sending message!" });
            }
            break;

        case 'newPrompt':
            await ctx.answerCallbackQuery();
            // Start the conversation for getting a new prompt
            ctx.session.messageStoreIdForNewPrompt = data.messageStoreId; // Store context for conversation
            await ctx.conversation.enter("newPromptConversation"); 
            // The conversation handler will edit the message text and keyboard
            break;
        
        case 'cancelNewPrompt': // This might be handled within the conversation now
             await ctx.answerCallbackQuery({ text: "Cancelled" });
             if (messageData.keyboard) {
                await ctx.editMessageText("New prompt cancelled. Choose an option:", {
                    reply_markup: { inline_keyboard: messageData.keyboard }
                });
             } else {
                 await ctx.editMessageText("New prompt cancelled."); // Fallback if keyboard isn't stored right
             }
            break;

        default:
            await ctx.answerCallbackQuery({ text: "Unknown action" });
            console.warn("Unhandled callback query:", data.query);
    }
}

/** General error handler */
export async function errorHandler(err: any): Promise<void> { // Use 'any' for broader compatibility initially
    console.error(`Error caught by handler:`);

    // Attempt to extract context and error details safely
    const ctx = err.ctx;
    const error = err.error ?? err; // Sometimes the error is nested, sometimes it's the top-level object

    if (ctx && ctx.update && ctx.update.update_id) {
        console.error(`While handling update ${ctx.update.update_id}:`);
    } else {
        console.error("Context or update ID not available in the error.");
    }

    if (error instanceof GrammyError) {
        console.error("GrammyError:", error.description);
        console.error("Stack:", error.stack);
    } else if (error instanceof HttpError) {
        console.error("HttpError:", error.message);
        console.error("Stack:", error.stack);
    } else if (error instanceof Error) { // Catch standard JS errors
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    } else {
        // Fallback for unknown error types
        console.error("Unknown error type:", error);
    }

    // Optional: Notify admin
    // if (ctx) { // Only if context is available
    //     try {
    //         await ctx.api.sendMessage(config.telegram.editorsGroupId, `Bot Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    //     } catch (notifyError) {
    //         console.error("Failed to send error notification:", notifyError);
    //     }
    // }
} 