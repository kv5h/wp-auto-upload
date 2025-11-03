import { config } from './config';

/**
 * Input parameters required to create a WordPress post via the REST API.
 */
interface CreatePostInput {
    title: string;
    content: string;
    status?: string;
}

/**
 * Subset of the WordPress post representation returned by the REST API.
 */
interface WordPressPost {
    id: number;
    link?: string;
}

/**
 * Builds the HTTP Basic Authorization header for the configured WordPress credentials.
 * @returns Basic auth header string.
 */
const getAuthHeader = (): string => {
    const credentials = Buffer.from(`${config.wordpressUsername}:${config.wordpressApplicationPassword}`).toString(
        'base64',
    );
    return `Basic ${credentials}`;
};

/**
 * Creates a WordPress post using the REST API.
 * @param input Post payload including title, content, and optional status override.
 * @returns WordPress post metadata provided by the REST API.
 */
export const createWordPressPost = async (input: CreatePostInput): Promise<WordPressPost> => {
    const payload = {
        title: input.title,
        content: input.content,
        status: input.status ?? config.wordpressDefaultStatus,
    };

    const endpoint = `${config.wordpressBaseUrl}/wp-json/wp/v2/posts`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`WordPress post creation failed with status ${response.status}: ${text}`);
    }

    const post = (await response.json()) as WordPressPost;
    return post;
};
