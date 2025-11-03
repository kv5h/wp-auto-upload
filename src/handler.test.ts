import assert from 'node:assert/strict';
import test from 'node:test';
import type { TelegramMessage, TelegramUpdate } from './telegram';

process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? 'test-deepseek-key';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-test';
process.env.DEEPSEEK_SYSTEM_PROMPT = process.env.DEEPSEEK_SYSTEM_PROMPT ?? 'Test prompt.';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '123:ABC';
process.env.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '-100123456';
process.env.WORDPRESS_BASE_URL = process.env.WORDPRESS_BASE_URL ?? 'https://example.com';
process.env.WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME ?? 'tester';
process.env.WORDPRESS_APPLICATION_PASSWORD = process.env.WORDPRESS_APPLICATION_PASSWORD ?? 'app-password';
process.env.WORDPRESS_POST_STATUS = process.env.WORDPRESS_POST_STATUS ?? 'draft';
process.env.TELEGRAM_FETCH_LIMIT = process.env.TELEGRAM_FETCH_LIMIT ?? '50';

const { buildTitleFromMessage, processUpdates } = require('./handler') as typeof import('./handler');

const createUpdate = (updateId: number, message: Partial<TelegramMessage> | null): TelegramUpdate => ({
    update_id: updateId,
    message: message
        ? ({
              message_id: message.message_id ?? updateId,
              chat: message.chat ?? { id: -100123456, type: 'group' },
              date: message.date ?? Math.floor(Date.now() / 1000),
              text: message.text,
              caption: message.caption,
          } as TelegramMessage)
        : undefined,
});

test('buildTitleFromMessage returns fallback title when message is empty', () => {
    const result = buildTitleFromMessage('');
    assert.equal(result, 'Telegram Update');
});

test('buildTitleFromMessage trims whitespace and normalizes spacing', () => {
    const result = buildTitleFromMessage('   Hello    world   ');
    assert.equal(result, 'Hello world');
});

test('buildTitleFromMessage truncates overly long messages with ellipsis', () => {
    const longMessage = 'a'.repeat(100);
    const result = buildTitleFromMessage(longMessage);
    assert.equal(result, `${'a'.repeat(79)}…`);
});

test('processUpdates handles valid and invalid updates', async () => {
    const updates: TelegramUpdate[] = [
        createUpdate(1, null),
        createUpdate(2, { message_id: 21, text: 'valid prompt' }),
        createUpdate(3, { message_id: 31, text: 'deleted prompt', date: 0 }),
        createUpdate(4, { message_id: 41, text: '' }),
        createUpdate(5, { message_id: 51, text: 'other chat', chat: { id: -100999999, type: 'group' } }),
    ];

    const prompts: string[] = [];
    const posts: Array<{ title: string; status?: string }> = [];
    const deletions: Array<{ chatId: number | string; messageId: number }> = [];
    let acknowledged: number | undefined;
    const logEntries: Array<Record<string, unknown>> = [];
    const originalLog = console.log;
    console.log = (arg?: unknown) => {
        if (typeof arg === 'string') {
            try {
                logEntries.push(JSON.parse(arg));
            } catch {
                logEntries.push({ raw: arg });
            }
        } else if (arg !== undefined) {
            logEntries.push({ raw: arg });
        }
    };

    try {
        const result = await processUpdates({
            updates,
            targetChatId: '-100123456',
            postStatus: 'publish',
            generatePost: async (prompt) => {
                prompts.push(prompt);
                return `generated:${prompt}`;
            },
            createPost: async (input) => {
                posts.push({ title: input.title, status: input.status });
                return { id: posts.length };
            },
            deleteMessage: async (chatId, messageId) => {
                deletions.push({ chatId, messageId });
            },
            acknowledge: async (nextOffset) => {
                acknowledged = nextOffset;
            },
            pickMessage: (update) => update.message ?? null,
            extractText: (update) => update.message?.text ?? null,
        });

        assert.equal(result.processed, 1);
        assert.equal(result.skipped, 4);
        assert.equal(result.acknowledgedOffset, 6);
        assert.equal(prompts.length, 1);
        assert.equal(prompts[0], 'valid prompt');
        assert.equal(posts.length, 1);
        assert.equal(posts[0].title, 'valid prompt');
        assert.equal(posts[0].status, 'publish');
        assert.equal(deletions.length, 1);
        assert.deepEqual(deletions[0], { chatId: -100123456, messageId: 21 });
        assert.equal(acknowledged, 6);
    } finally {
        console.log = originalLog;
    }

    const skipMessages = logEntries.filter(
        (entry) => entry.level === 'info' && typeof entry.message === 'string' && entry.message.startsWith('Skipping'),
    );
    assert.equal(skipMessages.length, 4);
    assert.equal(skipMessages[0].message, 'Skipping update without message payload.');
    assert.equal(skipMessages[1].message, 'Skipping inaccessible message.');
    assert.equal(skipMessages[2].message, 'Skipping message without text content.');
    assert.equal(skipMessages[3].message, 'Skipping update from unexpected chat.');
});

test('processUpdates stops processing when downstream dependency throws', async () => {
    const updates: TelegramUpdate[] = [
        createUpdate(10, { message_id: 101, text: 'first prompt' }),
        createUpdate(11, { message_id: 111, text: 'second prompt' }),
    ];

    let acknowledged: number | undefined;
    const deletions: Array<{ chatId: number | string; messageId: number }> = [];

    const result = await processUpdates({
        updates,
        targetChatId: '-100123456',
        postStatus: 'draft',
        generatePost: async (prompt) => `generated:${prompt}`,
        createPost: async () => {
            throw new Error('WordPress unavailable');
        },
        deleteMessage: async (chatId, messageId) => {
            deletions.push({ chatId, messageId });
        },
        acknowledge: async (nextOffset) => {
            acknowledged = nextOffset;
        },
        pickMessage: (update) => update.message ?? null,
        extractText: (update) => update.message?.text ?? null,
    });

    assert.equal(result.processed, 0);
    assert.equal(result.skipped, 0);
    assert.equal(result.acknowledgedOffset, undefined);
    assert.equal(deletions.length, 0);
    assert.equal(acknowledged, undefined);
});

test('processUpdates acknowledges skipped-only batches', async () => {
    const updates: TelegramUpdate[] = [createUpdate(99, null)];
    let acknowledged: number | undefined;

    const result = await processUpdates({
        updates,
        targetChatId: '-100123456',
        postStatus: 'draft',
        generatePost: async () => 'generated',
        createPost: async () => ({ id: 1 }),
        deleteMessage: async () => {},
        acknowledge: async (nextOffset) => {
            acknowledged = nextOffset;
        },
        pickMessage: (update) => update.message ?? null,
        extractText: () => null,
    });

    assert.equal(result.processed, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.acknowledgedOffset, 100);
    assert.equal(acknowledged, 100);
});
