import { MyContext, MyConversation } from "../types.js";
import { getMessageData } from "../storage.js";
import { generateGptSummary } from "../services/openaiService.js";
import { config } from "../config.js";
import { createCancelKeyboard, createMainKeyboard } from "./keyboards.js";
import { InlineKeyboard } from "grammy";

// Helper to resend action prompt (adjust as needed from handlers.ts or make it reusable)
async function sendActionPromptHelper(ctx: MyContext, text: string, scrapedContent?: string) {
    // This replicates the core logic from handlers.ts sendActionPrompt
    // Ideally, refactor sendActionPrompt in handlers.ts to be importable and reusable
    const { v4: uuidv4 } = await import('uuid'); // Dynamically import uuid
    const { storeMessageData } = await import('../storage.js'); // Dynamically import storage function with .js

    const messageStoreId = uuidv4();
    const keyboard = createMainKeyboard(messageStoreId);
    const cancelKeyboard = createCancelKeyboard(messageStoreId); 

    storeMessageData(messageStoreId, {
        messageId: messageStoreId,
        originalMessageText: text,
        keyboard: keyboard.inline_keyboard, 
        cancelButton: cancelKeyboard.inline_keyboard[0], 
        scrapedMessageContent: scrapedContent,
    });

    try {
        await ctx.api.sendMessage(config.telegram.editorsGroupId, text, { parse_mode: "Markdown" });
        await ctx.api.sendMessage(config.telegram.editorsGroupId, "Choose an option:", {
            reply_markup: keyboard,
        });
    } catch (error) {
        console.error("[Conversation] Error sending action prompt:", error);
        try {
            await ctx.api.sendMessage(config.telegram.editorsGroupId, "Choose an option:", {
                reply_markup: keyboard,
            });
        } catch (error2) {
            console.error("[Conversation] Failed to send fallback prompt:", error2);
        }
    }
}

/**
 * Conversation handler for getting a new prompt from the user for GPT processing.
 * 
 * Triggered when the user clicks the "New Prompt" button.
 * Edits the original message, waits for user input, processes with GPT, and sends the result.
 */
export async function newPromptConversation(conversation: MyConversation, ctx: MyContext) {
    const messageStoreId = ctx.session.messageStoreIdForNewPrompt;

    if (!messageStoreId) {
        console.error("Conversation started without messageStoreId in session.");
        await ctx.reply("Error: Could not find the context for the new prompt. Please try again.");
        return;
    }

    const messageData = getMessageData(messageStoreId);
    if (!messageData) {
        console.error(`Conversation: MessageData not found for ID: ${messageStoreId}`);
        await ctx.reply("Error: Could not find the original message context. It might be too old.");
        // Try to clean up the potentially dangling buttons if ctx.callbackQuery exists
        if (ctx.callbackQuery) {
            try {
                await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
            } catch { /* Ignore if message edit fails */ }
        }
        return;
    }

    // Edit the message in the editors group to ask for the prompt
    const cancelKeyboard = createCancelKeyboard(messageStoreId);
    try {
        if (ctx.callbackQuery?.message?.message_id) {
             await ctx.api.editMessageText(
                 config.telegram.editorsGroupId, 
                 ctx.callbackQuery.message.message_id, 
                 "Please enter the new prompt for ChatGPT:"
             );
             await ctx.api.editMessageReplyMarkup(
                 config.telegram.editorsGroupId,
                 ctx.callbackQuery.message.message_id,
                 { reply_markup: cancelKeyboard }
             );
        } else {
             // Fallback if we can't edit the original message
             await ctx.reply("Please enter the new prompt for ChatGPT:", { reply_markup: cancelKeyboard });
        }
    } catch (editError) {
        console.error("Failed to edit message for new prompt request:", editError);
        await ctx.reply("Please enter the new prompt for ChatGPT (failed to edit original message):", { reply_markup: cancelKeyboard });
    }

    // Wait for the user's next message or a cancellation callback
    const promptResult = await conversation.waitFor(":text"); // Wait specifically for a text message
    
    // Check if cancelled implicitly (e.g., user clicked cancel on a *different* message or timeout)
    // We need a more robust cancellation mechanism if needed, maybe listening for the specific callback query.

    if (promptResult.message?.text) {
        const newPrompt = promptResult.message.text;
        await ctx.reply("Processing with new prompt...");

        const contentToSend = messageData.scrapedMessageContent || messageData.originalMessageText;
        const gptModel = ctx.session.currentGptModel || config.openai.defaultModel;

        const gptResult = await conversation.external(() => 
            generateGptSummary(contentToSend, newPrompt, gptModel)
        );

        if (gptResult) {
            // Send the new result using the helper
            await sendActionPromptHelper(ctx, gptResult);
        } else {
            await ctx.reply("Sorry, failed to get a response from OpenAI with the new prompt.");
            // Restore original keyboard?
            try {
                 if (ctx.callbackQuery?.message?.message_id && messageData.keyboard) {
                     await ctx.api.editMessageText(config.telegram.editorsGroupId, ctx.callbackQuery.message.message_id, "Failed. Choose an option:");
                     await ctx.api.editMessageReplyMarkup(config.telegram.editorsGroupId, ctx.callbackQuery.message.message_id, { reply_markup: { inline_keyboard: messageData.keyboard }});
                 }
             } catch { /* ignore */}
        }
    } else {
        await ctx.reply("Did not receive a valid prompt. Cancelling.");
         // Restore original keyboard
         try {
             if (ctx.callbackQuery?.message?.message_id && messageData.keyboard) {
                 await ctx.api.editMessageText(config.telegram.editorsGroupId, ctx.callbackQuery.message.message_id, "Cancelled. Choose an option:");
                 await ctx.api.editMessageReplyMarkup(config.telegram.editorsGroupId, ctx.callbackQuery.message.message_id, { reply_markup: { inline_keyboard: messageData.keyboard }});
             }
         } catch { /* ignore */}
    }

    // Clean up session data regardless of outcome
    ctx.session.messageStoreIdForNewPrompt = undefined;
}

// You can add more conversation functions here if needed 