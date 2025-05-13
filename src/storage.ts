import { MessageData, MessageStore, NewsArticle } from './types.js';

/** 
 * In-memory store for `MessageData` objects, keyed by a unique messageStoreId (UUID).
 * This allows associating interactive message states (like active keyboards) with specific messages.
 */
export const messageStore: MessageStore = {};

/** 
 * In-memory set to track scraped news articles that have already been processed or sent.
 * Uses the `fullFormattedMessage` property of `NewsArticle` for ensuring uniqueness to prevent duplicates.
 */
export const newsList: Set<string> = new Set();

/**
 * Stores or updates message data in the `messageStore`.
 * @param id The unique identifier (messageStoreId) for the message data.
 * @param data The `MessageData` object to store.
 */
export function storeMessageData(id: string, data: MessageData): void {
    messageStore[id] = data;
}

/**
 * Retrieves message data from the `messageStore`.
 * @param id The unique identifier (messageStoreId) of the message data to retrieve.
 * @returns The `MessageData` object if found, otherwise `undefined`.
 */
export function getMessageData(id: string): MessageData | undefined {
    return messageStore[id];
}

/**
 * Deletes message data from the `messageStore`.
 * Useful for cleaning up state after an interaction is complete or cancelled.
 * @param id The unique identifier (messageStoreId) of the message data to delete.
 */
export function deleteMessageData(id: string): void {
    delete messageStore[id];
}

/**
 * Adds a scraped news article's identifier to the `newsList` to mark it as sent/processed.
 * @param news The `NewsArticle` object that has been processed.
 */
export function addSentNews(news: NewsArticle): void {
    newsList.add(news.fullFormattedMessage);
}

/**
 * Checks if a scraped news article has already been sent/processed.
 * @param news The `NewsArticle` object to check.
 * @returns `true` if the news article is in `newsList`, otherwise `false`.
 */
export function hasNewsBeenSent(news: NewsArticle): boolean {
    return newsList.has(news.fullFormattedMessage);
} 