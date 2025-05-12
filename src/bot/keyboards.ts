import { InlineKeyboard } from 'grammy';
import { CallbackQueryData } from '../types.js';

/**
 * Creates the main inline keyboard for news items.
 * 
 * Includes buttons for:
 * - Sending the content to GPT for processing.
 * - Sending the content (original or GPT-processed) to the designated news channel.
 * - Initiating a conversation to provide a new custom prompt for GPT.
 *
 * @param messageStoreId The unique ID of the message context this keyboard is associated with.
 * @returns An `InlineKeyboard` instance.
 */
export function createMainKeyboard(messageStoreId: string): InlineKeyboard {
    const sendGptData: CallbackQueryData = { query: 'sendGpt', messageStoreId };
    const sendChannelData: CallbackQueryData = { query: 'sendChannel', messageStoreId };
    const newPromptData: CallbackQueryData = { query: 'newPrompt', messageStoreId };

    return new InlineKeyboard()
        .text("🤖 Send to GPT", JSON.stringify(sendGptData)).row()
        .text("📰 Send to News Channel", JSON.stringify(sendChannelData)).row()
        .text("✏️ New Prompt", JSON.stringify(newPromptData));
}

/**
 * Creates the inline keyboard for selecting the default GPT model.
 *
 * Includes buttons for GPT-4o, GPT-3.5 Turbo, and a cancel option.
 * Note: `messageStoreId` is not strictly needed here as this is a command reply,
 * but we pass a dummy value or handle it appropriately if needed for context.
 *
 * @returns An `InlineKeyboard` instance.
 */
export function createGptModelKeyboard(): InlineKeyboard {
    // Using a placeholder messageStoreId as this keyboard is for a command, not tied to specific message data
    const placeholderId = 'gpt-model-selection'; 
    const gpt4oData: CallbackQueryData = { query: 'gpt4o', messageStoreId: placeholderId };
    const gpt35Data: CallbackQueryData = { query: 'gpt3.5turbo', messageStoreId: placeholderId };
    const cancelData: CallbackQueryData = { query: 'cancelGptChange', messageStoreId: placeholderId };

    return new InlineKeyboard()
        .text("GPT-4o", JSON.stringify(gpt4oData))
        .text("GPT-3.5 Turbo", JSON.stringify(gpt35Data)).row()
        .text("❌ Cancel", JSON.stringify(cancelData));
}

/**
 * Creates a simple inline keyboard with only a "Cancel" button.
 * Used typically when waiting for user input, like during the "New Prompt" conversation.
 *
 * @param messageStoreId The unique ID of the message context this cancellation is related to.
 * @returns An `InlineKeyboard` instance.
 */
export function createCancelKeyboard(messageStoreId: string): InlineKeyboard {
    const cancelData: CallbackQueryData = { query: 'cancelNewPrompt', messageStoreId };
    return new InlineKeyboard().text("❌ Cancel New Prompt", JSON.stringify(cancelData));
}