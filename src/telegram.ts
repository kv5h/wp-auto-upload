import { config } from './config';

/**
 * Telegram user profile metadata available on messages.
 */
export interface TelegramUser {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_bot?: boolean;
    language_code?: string;
}

/**
 * Telegram chat descriptor including type and optional title.
 */
export interface TelegramChat {
    id: number;
    title?: string;
    type: string;
}

/**
 * Telegram message payload containing author, chat, and textual content.
 */
export interface TelegramMessage {
    message_id: number;
    date?: number;
    chat: TelegramChat;
    from?: TelegramUser;
    text?: string;
    caption?: string;
}

/**
 * Telegram update envelope that wraps different message variants.
 */
export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    channel_post?: TelegramMessage;
    edited_message?: TelegramMessage;
    edited_channel_post?: TelegramMessage;
}

/**
 * Generic Telegram API response envelope.
 */
interface TelegramApiResponse<T> {
    ok: boolean;
    result: T;
    description?: string;
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;
const TELEGRAM_ALLOWED_UPDATES = ['message', 'channel_post', 'edited_message', 'edited_channel_post'] as const;

/**
 * Invokes the Telegram Bot API and returns the unwrapped `result` field.
 * @param method API method name (e.g. getUpdates, deleteMessage).
 * @param payload Optional payload to send as JSON.
 * @returns Parsed result payload from Telegram.
 */
const callTelegramApi = async <T>(method: string, payload?: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Telegram API ${method} failed with status ${response.status}: ${text}`);
    }

    const data = (await response.json()) as TelegramApiResponse<T>;

    if (!data.ok) {
        throw new Error(`Telegram API ${method} failed: ${data.description ?? 'unknown error'}`);
    }

    return data.result;
};

/**
 * Retrieves pending updates for the configured bot without long polling waits.
 * @param limit Maximum number of updates to return in one call.
 * @returns Array of Telegram updates ready for processing.
 */
export const fetchTelegramUpdates = async (limit: number): Promise<TelegramUpdate[]> => {
    return callTelegramApi<TelegramUpdate[]>('getUpdates', {
        limit,
        timeout: 0,
        allowed_updates: TELEGRAM_ALLOWED_UPDATES,
    });
};

/**
 * Marks previously processed updates as acknowledged by advancing the offset cursor.
 * @param nextOffset The next update_id the bot should start from.
 */
export const acknowledgeTelegramUpdates = async (nextOffset: number): Promise<void> => {
    await callTelegramApi<TelegramUpdate[]>('getUpdates', {
        offset: nextOffset,
        limit: 1,
        timeout: 0,
        allowed_updates: TELEGRAM_ALLOWED_UPDATES,
    });
};

/**
 * Removes a message from Telegram once it has been processed.
 * @param chatId Source chat identifier.
 * @param messageId Identifier of the message to delete.
 */
export const deleteTelegramMessage = async (chatId: number | string, messageId: number): Promise<void> => {
    await callTelegramApi<boolean>('deleteMessage', {
        chat_id: chatId,
        message_id: messageId,
    });
};

/**
 * Extracts the primary message object included in a Telegram update.
 * @param update Telegram update containing various message variants.
 * @returns The best candidate message or null when none exist.
 */
export const pickTelegramMessage = (update: TelegramUpdate): TelegramMessage | null =>
    update.message ?? update.channel_post ?? update.edited_message ?? update.edited_channel_post ?? null;

/**
 * Returns the text content or caption associated with the update, if available.
 * @param update Telegram update containing the user prompt.
 * @returns Trimmed message text or null when the update lacks textual content.
 */
export const extractMessageText = (update: TelegramUpdate): string | null => {
    const candidateMessage = pickTelegramMessage(update);

    if (!candidateMessage) {
        return null;
    }

    const text = candidateMessage.text ?? candidateMessage.caption;
    return text ? text.trim() : null;
};
