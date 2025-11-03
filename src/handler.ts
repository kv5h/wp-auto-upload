import type { ScheduledEvent } from 'aws-lambda';
import { config } from './config';
import { generatePostFromMessage } from './deepseek';
import {
    acknowledgeTelegramUpdates,
    deleteTelegramMessage,
    extractMessageText,
    fetchTelegramUpdates,
    pickTelegramMessage,
    type TelegramMessage,
    type TelegramUpdate,
} from './telegram';
import { createWordPressPost } from './wordpress';

/**
 * Generates a concise post title derived from the original Telegram message.
 * @param message Raw Telegram message text.
 * @returns Title trimmed to a sensible length for WordPress.
 */
export const buildTitleFromMessage = (message: string): string => {
    const normalized = message.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return 'Telegram Update';
    }

    const maxLength = 80;
    const truncated = normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}…` : normalized;

    return truncated;
};

/**
 * Runtime dependencies required to process Telegram updates.
 */
export interface ProcessUpdatesDependencies {
    /** Updates retrieved from Telegram Bot API. */
    updates: TelegramUpdate[];
    /** Chat identifier used to filter updates. */
    targetChatId: string;
    /** WordPress post status to apply to generated posts. */
    postStatus: string;
    /** Generates article content from a Telegram prompt. */
    generatePost: (prompt: string) => Promise<string>;
    /** Persists generated content to WordPress. */
    createPost: (input: { title: string; content: string; status?: string }) => Promise<{ id: number; link?: string }>;
    /** Deletes processed Telegram messages to avoid duplicates. */
    deleteMessage: (chatId: number | string, messageId: number) => Promise<void>;
    /** Acknowledges the latest processed update. */
    acknowledge: (nextOffset: number) => Promise<void>;
    /** Picks the best candidate message from an update. */
    pickMessage: (update: TelegramUpdate) => TelegramMessage | null;
    /** Extracts textual content from the candidate message. */
    extractText: (update: TelegramUpdate) => string | null;
}

type LogDetails = Record<string, unknown>;

const logInfo = (message: string, details?: LogDetails): void => {
    const payload: LogDetails = { level: 'info', message };
    if (details) {
        payload.details = details;
    }
    console.log(JSON.stringify(payload));
};

const logError = (message: string, details?: LogDetails, error?: unknown): void => {
    const payload: LogDetails = { level: 'error', message };
    if (details) {
        payload.details = details;
    }

    if (error instanceof Error) {
        payload.error = { message: error.message, stack: error.stack };
    } else if (error !== undefined) {
        payload.error = error;
    }

    console.error(JSON.stringify(payload));
};

/**
 * Processes a batch of Telegram updates, generating WordPress posts and deleting handled messages.
 * @param deps Concrete dependencies injected by the Lambda handler or tests.
 * @returns Counts of processed and skipped updates alongside the acknowledged offset.
 */
export const processUpdates = async (
    deps: ProcessUpdatesDependencies,
): Promise<{
    processed: number;
    skipped: number;
    acknowledgedOffset?: number;
}> => {
    let processed = 0;
    let skipped = 0;
    let nextOffset: number | null = null;

    for (const update of deps.updates) {
        const message = deps.pickMessage(update);

        logInfo('update', { update });
        logInfo('message', { message });

        logInfo('Processing Telegram update.', {
            updateId: update.update_id,
            messageId: message?.message_id ?? null,
            chatId: message?.chat.id ?? null,
            hasText: Boolean((message?.text ?? message?.caption)?.trim()),
        });

        if (!message) {
            logInfo('Skipping update without message payload.', { updateId: update.update_id });
            skipped += 1;
            nextOffset = update.update_id + 1;
            continue;
        }

        if (message.date === 0) {
            logInfo('Skipping inaccessible message.', {
                updateId: update.update_id,
                messageId: message.message_id,
            });
            skipped += 1;
            nextOffset = update.update_id + 1;
            continue;
        }

        if (String(message.chat.id) !== deps.targetChatId) {
            logInfo('Skipping update from unexpected chat.', {
                updateId: update.update_id,
                chatId: message.chat.id,
            });
            skipped += 1;
            nextOffset = update.update_id + 1;
            continue;
        }

        const messageText = deps.extractText(update);

        if (!messageText) {
            logInfo('Skipping message without text content.', {
                updateId: update.update_id,
                messageId: message.message_id,
            });
            skipped += 1;
            nextOffset = update.update_id + 1;
            continue;
        }

        try {
            const generatedContent = await deps.generatePost(messageText);
            const postTitle = buildTitleFromMessage(messageText);
            await deps.createPost({
                title: postTitle,
                content: generatedContent,
                status: deps.postStatus,
            });

            await deps.deleteMessage(message.chat.id, message.message_id);

            logInfo('Processed Telegram message.', {
                updateId: update.update_id,
                messageId: message.message_id,
            });

            processed += 1;
            nextOffset = update.update_id + 1;
        } catch (error) {
            logError(
                'Failed to process Telegram message.',
                {
                    updateId: update.update_id,
                    messageId: message.message_id,
                },
                error,
            );
            break;
        }
    }

    if (nextOffset !== null) {
        try {
            await deps.acknowledge(nextOffset);
        } catch (ackError) {
            logError('Failed to acknowledge Telegram updates.', undefined, ackError);
        }
    }

    return {
        processed,
        skipped,
        acknowledgedOffset: nextOffset ?? undefined,
    };
};

/**
 * Lambda entry point that polls Telegram for new prompts, generates WordPress posts,
 * and deletes processed messages to keep the chat clean.
 * @param _event Optional EventBridge schedule payload (unused).
 */
export const handler = async (_event?: ScheduledEvent): Promise<void> => {
    const updates = await fetchTelegramUpdates(config.telegramFetchLimit);

    if (updates.length === 0) {
        logInfo('No Telegram updates to process.');
        return;
    }

    await processUpdates({
        updates,
        targetChatId: config.telegramChatId,
        postStatus: config.wordpressDefaultStatus,
        generatePost: generatePostFromMessage,
        createPost: createWordPressPost,
        deleteMessage: deleteTelegramMessage,
        acknowledge: acknowledgeTelegramUpdates,
        pickMessage: pickTelegramMessage,
        extractText: extractMessageText,
    });
};

// Force configuration validation during initialization to fail fast in Lambda.
void config;
