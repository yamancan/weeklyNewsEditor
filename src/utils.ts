import { Bot, GrammyError } from 'grammy';
import { MyContext } from './types.js'; // Import necessary types

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sends a Telegram message with automatic retry logic for rate limit errors (429).
 * @param bot The Bot instance or API instance to use for sending.
 * @param chatId The target chat ID.
 * @param text The message text.
 * @param options Additional Telegram sendMessage options (like parse_mode, reply_markup).
 * @param maxRetries Maximum number of retry attempts.
 * @param initialDelay Initial delay before the first retry (in ms).
 */
export async function sendMessageWithRetry(
    bot: Bot<MyContext> | Bot<MyContext>['api'], // Allow bot or bot.api
    chatId: number | string,
    text: string,
    options?: Record<string, any>, // Changed from complex Omit type
    maxRetries = 3,
    initialDelay = 1000
): Promise<void> {
    let attempts = 0;
    let currentDelay = initialDelay;
    const api = 'api' in bot ? bot.api : bot; // Get the API object correctly

    while (attempts < maxRetries) {
        try {
            await api.sendMessage(chatId, text, options);
            return; // Success!
        } catch (error) {
            attempts++;
            if (error instanceof GrammyError && error.error_code === 429 && error.parameters.retry_after) {
                const retryAfter = error.parameters.retry_after * 1000; // Convert seconds to ms
                const waitTime = Math.max(retryAfter, currentDelay); // Wait at least the specified time or current delay
                console.warn(`[SendMessageRetry] Rate limit hit (attempt ${attempts}/${maxRetries}). Retrying after ${waitTime / 1000}s...`);
                await delay(waitTime);
                currentDelay *= 2; // Exponential backoff for subsequent retries
            } else if (attempts >= maxRetries) {
                console.error(`[SendMessageRetry] Failed to send message after ${maxRetries} attempts. Error:`, error);
                throw error; // Re-throw the error if max retries reached or it's not a rate limit error
            } else {
                 console.error(`[SendMessageRetry] Non-rate-limit error during send (attempt ${attempts}/${maxRetries}):`, error);
                 throw error; // Re-throw other errors immediately
            }
        }
    }
    // Should not be reached if maxRetries > 0, but satisfies TS
     throw new Error('[SendMessageRetry] Failed to send message after exhausting retries.');
} 