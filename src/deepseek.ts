import { config } from './config';

/**
 * Minimal shape of the DeepSeek Chat Completions API response relevant to this project.
 */
interface ChatCompletionResponse {
    choices: Array<{
        message?: {
            role?: string;
            content?: string;
        };
    }>;
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

/**
 * Sends the Telegram prompt to DeepSeek and returns the generated article body.
 * @param telegramMessage Prompt text originating from Telegram.
 * @returns AI-generated article content ready for WordPress.
 */
export const generatePostFromMessage = async (telegramMessage: string): Promise<string> => {
    const payload = {
        model: config.deepseekModel,
        messages: [
            {
                role: 'system',
                content: config.deepseekSystemPrompt,
            },
            {
                role: 'user',
                content: telegramMessage,
            },
        ],
    };

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.deepseekApiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`DeepSeek request failed with status ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
        throw new Error('DeepSeek response did not include any content.');
    }

    return content;
};
