import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';
import { config } from './config';
import { generatePostFromMessage } from './openai';
import { extractMessageText, TelegramUpdate } from './telegram';
import { createWordPressPost } from './wordpress';

const decodeEventBody = (event: LambdaFunctionURLEvent): string | null => {
    if (!event.body) {
        return null;
    }

    if (event.isBase64Encoded) {
        try {
            return Buffer.from(event.body, 'base64').toString('utf8');
        } catch (error) {
            console.error('Failed to decode base64 body', error);
            return null;
        }
    }

    return event.body;
};

const safeJsonParse = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const buildTitleFromMessage = (message: string): string => {
    const normalized = message.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return 'Telegram Update';
    }

    const maxLength = 80;
    const truncated = normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}…` : normalized;

    return truncated;
};

export const handler = async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
    const rawBody = decodeEventBody(event);

    if (!rawBody) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing request body.' }),
        };
    }

    const payload = safeJsonParse(rawBody) as TelegramUpdate | null;

    if (!payload) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON payload.' }),
        };
    }

    const messageText = extractMessageText(payload);

    if (!messageText) {
        console.warn('Ignored webhook without text content:', payload);
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, ignored: 'No text content.' }),
        };
    }

    try {
        const generatedContent = await generatePostFromMessage(messageText);
        const postTitle = buildTitleFromMessage(messageText);
        const wpPost = await createWordPressPost({
            title: postTitle,
            content: generatedContent,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                wordpressPostId: wpPost.id,
                wordpressPostUrl: wpPost.link,
            }),
        };
    } catch (error) {
        console.error('Processing failed', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process Telegram message.' }),
        };
    }
};

// Force configuration validation during initialization to fail fast in Lambda.
void config;
