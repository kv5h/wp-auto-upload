/**
 * Removes the trailing slash from a URL-like string so downstream concatenation behaves predictably.
 * @param value Raw string that may end with a slash.
 * @returns String without a trailing slash.
 */
const trimTrailingSlash = (value: string): string => (value.endsWith('/') ? value.slice(0, -1) : value);

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.trim().length === 0) {
    throw new Error('Environment variable DEEPSEEK_API_KEY is required.');
}

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const DEEPSEEK_SYSTEM_PROMPT =
    process.env.DEEPSEEK_SYSTEM_PROMPT ??
    'You are a helpful assistant that rewrites Telegram group discussions into publishable blog posts.';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.trim().length === 0) {
    throw new Error('Environment variable TELEGRAM_BOT_TOKEN is required.');
}

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID.trim().length === 0) {
    throw new Error('Environment variable TELEGRAM_CHAT_ID is required.');
}

const TELEGRAM_FETCH_LIMIT_RAW = process.env.TELEGRAM_FETCH_LIMIT ?? '50';
const TELEGRAM_FETCH_LIMIT = Number.parseInt(TELEGRAM_FETCH_LIMIT_RAW, 10);
if (Number.isNaN(TELEGRAM_FETCH_LIMIT)) {
    throw new Error('Environment variable TELEGRAM_FETCH_LIMIT must be a valid integer.');
}
if (TELEGRAM_FETCH_LIMIT < 1 || TELEGRAM_FETCH_LIMIT > 100) {
    throw new Error('Environment variable TELEGRAM_FETCH_LIMIT must be between 1 and 100.');
}

const WORDPRESS_BASE_URL_RAW = process.env.WORDPRESS_BASE_URL;
if (!WORDPRESS_BASE_URL_RAW || WORDPRESS_BASE_URL_RAW.trim().length === 0) {
    throw new Error('Environment variable WORDPRESS_BASE_URL is required.');
}
const WORDPRESS_BASE_URL = trimTrailingSlash(WORDPRESS_BASE_URL_RAW.trim());

const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
if (!WORDPRESS_USERNAME || WORDPRESS_USERNAME.trim().length === 0) {
    throw new Error('Environment variable WORDPRESS_USERNAME is required.');
}

const WORDPRESS_APPLICATION_PASSWORD = process.env.WORDPRESS_APPLICATION_PASSWORD;
if (!WORDPRESS_APPLICATION_PASSWORD || WORDPRESS_APPLICATION_PASSWORD.trim().length === 0) {
    throw new Error('Environment variable WORDPRESS_APPLICATION_PASSWORD is required.');
}

const WORDPRESS_POST_STATUS = process.env.WORDPRESS_POST_STATUS ?? 'draft';

export const config = {
    deepseekApiKey: DEEPSEEK_API_KEY,
    deepseekModel: DEEPSEEK_MODEL,
    deepseekSystemPrompt: DEEPSEEK_SYSTEM_PROMPT,
    telegramBotToken: TELEGRAM_BOT_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID,
    telegramFetchLimit: TELEGRAM_FETCH_LIMIT,
    wordpressBaseUrl: WORDPRESS_BASE_URL,
    wordpressUsername: WORDPRESS_USERNAME,
    wordpressApplicationPassword: WORDPRESS_APPLICATION_PASSWORD,
    wordpressDefaultStatus: WORDPRESS_POST_STATUS,
};

export type AppConfig = typeof config;
