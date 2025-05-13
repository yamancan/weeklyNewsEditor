import OpenAI from 'openai';
import { config } from '../config.js';

/** 
 * OpenAI API client instance.
 * Initialized with the API key from the application configuration.
 */
const gptClient = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Generates a news summary using the configured OpenAI Chat Completions API.
 * 
 * This function sends the provided news content along with a system prompt and a user-defined prompt
 * to the specified GPT model. It then returns the model's generated text.
 *
 * @param content The primary news content or text that needs to be processed/summarized by the model.
 * @param prompt The specific instructions or query for the GPT model regarding the content (e.g., summarize, extract key points, translate).
 * @param model The identifier of the OpenAI GPT model to be used for the completion (e.g., "gpt-4o", "gpt-3.5-turbo").
 * @returns A promise that resolves to the generated text string from the GPT model if successful,
 *          or `null` if an error occurs during the API call or if the response is unexpected.
 * @throws Will not throw directly but logs errors to the console. Consider enhancing error propagation if needed.
 */
export async function generateGptSummary(
    content: string,
    prompt: string,
    model: string
): Promise<string | null> {
    console.log(`[GPT Request] Model: ${model}, Prompt: ${prompt.substring(0, 100)}..., Content Length: ${content.length}`); // Log request details
    try {
        const completion = await gptClient.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: config.openai.systemPrompt, // General system-level instructions for the AI editor
                },
                { 
                    role: "user", 
                    // Combine the original content with the specific prompt for this request
                    content: `${content}\n\n${prompt}` // User's specific request about the content
                },
            ],
        });
        // Safely access the content, returning null if the path is invalid
        const responseContent = completion.choices[0]?.message?.content ?? null;
        if (responseContent) {
            console.log(`[GPT Response] Success. Response Length: ${responseContent.length}`); // Log success and length
        } else {
            console.warn(`[GPT Response] Received null or empty content from API.`); // Log empty response
        }
        return responseContent;
    } catch (error) {
        console.error(`[GPT Error] Error calling OpenAI API with model ${model}:`, error instanceof Error ? error.message : error);
        return null;
    }
} 