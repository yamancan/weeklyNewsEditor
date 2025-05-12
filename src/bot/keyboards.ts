import { InlineKeyboard } from 'grammy';

/**
 * Creates the main inline keyboard for news items.
 * Uses a simplified callback_data format: "<action_prefix>:<messageStoreId>"
 */
export function createMainKeyboard(messageStoreId: string): InlineKeyboard {
    // Ensure messageStoreId is a valid UUID format for length assumptions
    if (messageStoreId.length !== 36) {
        console.warn(`[Keyboards] Invalid messageStoreId length for main keyboard: ${messageStoreId}`);
        // Potentially throw error or use a fallback?
    }
    const sendGptData = `gpt:${messageStoreId}`;
    const sendChannelData = `chn:${messageStoreId}`;
    const newPromptData = `prm:${messageStoreId}`;

    return new InlineKeyboard()
        .text("🤖 Send to GPT", sendGptData).row()
        .text("📰 Send to News Channel", sendChannelData).row()
        .text("✏️ New Prompt", newPromptData);
}

/**
 * Creates the inline keyboard for selecting the default GPT model.
 * Callback data is just the model name or cancel action.
 */
export function createGptModelKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
        .text("GPT-4o", "gpt:4o") // Simple identifier
        .text("GPT-3.5 Turbo", "gpt:3.5t").row() // Simple identifier
        .text("❌ Cancel", "gpt:cancel"); // Simple identifier
}

/**
 * Creates a simple inline keyboard with only a "Cancel" button for conversations.
 * Uses format "cnp:<messageStoreId>"
 */
export function createCancelKeyboard(messageStoreId: string): InlineKeyboard {
    // Ensure messageStoreId is a valid UUID format for length assumptions
     if (messageStoreId.length !== 36) {
         console.warn(`[Keyboards] Invalid messageStoreId length for cancel keyboard: ${messageStoreId}`);
     }
    const cancelData = `cnp:${messageStoreId}`;
    return new InlineKeyboard().text("❌ Cancel New Prompt", cancelData);
}