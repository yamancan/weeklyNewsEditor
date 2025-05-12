import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from './config.js'; // .js
import { bot } from './bot/bot.js'; // .js
import { addSentNews, hasNewsBeenSent, storeMessageData } from './storage.js'; // .js
import { NewsArticle } from './types.js'; // .js
import { createMainKeyboard, createCancelKeyboard } from './bot/keyboards.js'; // .js
import { v4 as uuidv4 } from 'uuid';

/**
 * Scrapes a single news article page to extract its content.
 * @param url The URL of the news article.
 * @returns The extracted text content or null if scraping fails.
 */
async function scrapeArticleContent(url: string): Promise<string | null> {
    try {
        const response = await axios.get(url, { timeout: 15000 }); // 15 second timeout
        if (response.status !== 200) {
            console.error(`[Scraper] Failed to fetch article ${url}. Status: ${response.status}`);
            return null;
        }
        const $ = cheerio.load(response.data);

        // --- Content Extraction Logic (NEEDS ADJUSTMENT FOR ledgerinsights.com) ---
        // This is a generic example and needs to be tailored to the specific HTML structure of ledgerinsights.com articles.
        // Inspect the website's HTML structure to find the correct selectors for the main content.
        let summary = '';
        // Example: Try to find common content containers
        const contentSelectors = [
            'div.entry-content', 
            'article .post-content', 
            'div.td-post-content', 
            'div.article-content'
        ]; 
        let contentElement = null;
        for (const selector of contentSelectors) {
            contentElement = $(selector);
            if (contentElement.length > 0) break; // Found a potential container
        }

        if (contentElement && contentElement.length > 0) {
             contentElement.find('p').each((_, element) => {
                 const text = $(element).text().trim();
                 // Filter out common boilerplate/ads - ADJUST THESE FILTERS
                 if (text && !text.includes('Follow @LedgerInsightsCopyright') && !text.includes('Learn more about') && text.length > 30) {
                     summary += text + '\n\n';
                 }
             });
        } else {
             console.warn(`[Scraper] Could not find main content container for ${url} using selectors: ${contentSelectors.join(', ')}. Trying all <p> tags.`);
             // Fallback: grab all <p> tags (might be noisy)
             $('p').each((_, element) => {
                const text = $(element).text().trim();
                // Apply filters even in fallback
                if (text && !text.includes('Follow @LedgerInsightsCopyright') && !text.includes('Learn more about') && text.length > 30) {
                    summary += text + '\n\n';
                }
             });
        }

        return summary.trim() || null; // Return null if no meaningful summary extracted
        // --- End Content Extraction Logic ---

    } catch (error) {
        console.error(`[Scraper] Error scraping article content from ${url}:`, error instanceof Error ? error.message : error);
        return null;
    }
}

/**
 * Fetches the main news page, identifies articles, scrapes them, and sends new ones to the bot.
 */
export async function runScraper() {
    console.log("[Scraper] Running scraper job...");
    try {
        const homeResponse = await axios.get(config.scraper.homeUrl, { timeout: 20000 }); // 20 sec timeout
        if (homeResponse.status !== 200) {
            console.error(`[Scraper] Failed to fetch home page ${config.scraper.homeUrl}. Status: ${homeResponse.status}`);
            return;
        }

        const $ = cheerio.load(homeResponse.data);
        // --- Article Link/Title Extraction (NEEDS ADJUSTMENT FOR ledgerinsights.com) ---
        // Find the container elements for each article preview on the category page.
        const articles = $('article.type-post'); // Example selector, adjust based on website structure
        console.log(`[Scraper] Found ${articles.length} potential articles on home page.`);
        // --- End Article Link/Title Extraction ---

        for (const element of articles.toArray()) {
            const articleElement = $(element);
            // --- Extract Title and Link (NEEDS ADJUSTMENT) ---
            const titleElement = articleElement.find('h2.entry-title a'); // Example
            const title = titleElement.text()?.trim();
            const link = titleElement.attr('href');
            // --- End Extract Title and Link ---

            if (!title || !link) {
                console.warn("[Scraper] Could not extract title or link from an article element, skipping.");
                continue;
            }

            // Construct preliminary article object (summary is missing)
            let newsItem: Partial<NewsArticle> = {
                title,
                link,
                linkOnlyMessage: `📰 Scraped News:
${title}
Link: ${link}`
            };

            // Create a temporary full message identifier for checking the newsList
            // We check *before* scraping the full content to save resources
            const tempFullIdentifier = `${title}\nLink:${link}`; 
            if (hasNewsBeenSent({ // Use a simplified check object
                    title: newsItem.title!, 
                    link: newsItem.link!, 
                    summary: '', // Not needed for check here
                    fullFormattedMessage: tempFullIdentifier, 
                    linkOnlyMessage: newsItem.linkOnlyMessage! 
                })) 
            {
                // console.log(`[Scraper] Article already sent: ${title}`);
                continue; // Skip if already processed based on title/link
            }

            console.log(`[Scraper] New article found: ${title}. Scraping content...`);
            const summary = await scrapeArticleContent(link);

            if (!summary) {
                console.warn(`[Scraper] Could not scrape content for: ${title} (${link}), skipping.`);
                continue;
            }

            // Complete the NewsArticle object
            newsItem.summary = summary;
            newsItem.fullFormattedMessage = `${title}\n\n${summary}\n\nLink: ${link}`;
            const completeNewsItem = newsItem as NewsArticle; // Cast to full type

            // Double-check with full content identifier before sending
            if (hasNewsBeenSent(completeNewsItem)) {
                console.log(`[Scraper] Article (checked with full content) already sent: ${title}`);
                continue;
            }
            
            // Send to Editors Group and store context
            console.log(`[Scraper] Sending new article to editors group: ${completeNewsItem.title}`);
            
            const messageStoreId = uuidv4();
            const keyboard = createMainKeyboard(messageStoreId);
            const cancelKeyboard = createCancelKeyboard(messageStoreId);

            // Store data including the full scraped content
            storeMessageData(messageStoreId, {
                messageId: messageStoreId,
                originalMessageText: completeNewsItem.linkOnlyMessage, // Send link initially
                keyboard: keyboard.inline_keyboard,
                cancelButton: cancelKeyboard.inline_keyboard[0],
                scrapedMessageContent: completeNewsItem.fullFormattedMessage, // Store full content here!
            });

            try {
                // Send the short message (title + link) first
                await bot.api.sendMessage(config.telegram.editorsGroupId, completeNewsItem.linkOnlyMessage, { parse_mode: "Markdown" });
                // Then send the prompt with the keyboard
                await bot.api.sendMessage(config.telegram.editorsGroupId, "Choose an option for scraped news:", {
                    reply_markup: keyboard,
                });
                 // Mark as sent ONLY after successfully notifying the group
                addSentNews(completeNewsItem);
            } catch (error) {
                console.error(`[Scraper] Failed to send scraped news message to editors group ${config.telegram.editorsGroupId}:`, error);
                // Don't mark as sent if notification failed
                // Remove stored data if sending failed?
                // deleteMessageData(messageStoreId);
            }

            // Optional delay between processing articles
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        console.log("[Scraper] Scraper job finished.");

    } catch (error) {
        console.error("[Scraper] Error during scraper execution:", error);
    }
}

/**
 * Starts the scraper scheduler to run periodically.
 */
export function startScrapingScheduler() {
    console.log(`[Scraper] Initializing scraper scheduler for ${config.scraper.homeUrl}. Interval: ${config.scraper.intervalHours} hours.`);
    // Removed immediate run from here, it's handled in index.ts
    setInterval(runScraper, config.scraper.intervalHours * 60 * 60 * 1000);
    console.log(`[Scraper] Scheduler started. Next run in ${config.scraper.intervalHours} hours.`);
} 