import { config } from './config';

interface ChatCompletionResponse {
    choices: Array<{
        message?: {
            role?: string;
            content?: string;
        };
    }>;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const generatePostFromMessage = async (telegramMessage: string): Promise<string> => {
    const payload = {
        model: config.openAiModel,
        messages: [
            {
                role: 'system',
                content: config.openAiSystemPrompt,
            },
            {
                role: 'user',
                content: telegramMessage,
            },
        ],
    };

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openAiApiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI request failed with status ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
        throw new Error('OpenAI response did not include any content.');
    }

    return content;
};
