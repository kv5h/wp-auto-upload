const trimTrailingSlash = (value: string): string => (value.endsWith('/') ? value.slice(0, -1) : value);

const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
        throw new Error(`Environment variable ${name} is required.`);
    }
    return value;
};

const optionalEnv = (name: string, fallback: string): string => {
    const value = process.env[name];
    return value && value.trim().length > 0 ? value : fallback;
};

export const config = {
    openAiApiKey: requireEnv('OPENAI_API_KEY'),
    openAiModel: optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
    openAiSystemPrompt: optionalEnv(
        'OPENAI_SYSTEM_PROMPT',
        'You are a helpful assistant that rewrites Telegram group discussions into publishable blog posts.',
    ),
    wordpressBaseUrl: trimTrailingSlash(requireEnv('WORDPRESS_BASE_URL')),
    wordpressUsername: requireEnv('WORDPRESS_USERNAME'),
    wordpressApplicationPassword: requireEnv('WORDPRESS_APPLICATION_PASSWORD'),
    wordpressDefaultStatus: optionalEnv('WORDPRESS_POST_STATUS', 'draft'),
};

export type AppConfig = typeof config;
