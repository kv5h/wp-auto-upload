import { config } from './config';

interface CreatePostInput {
    title: string;
    content: string;
    status?: string;
}

interface WordPressPost {
    id: number;
    link?: string;
}

const getAuthHeader = (): string => {
    const credentials = Buffer.from(`${config.wordpressUsername}:${config.wordpressApplicationPassword}`).toString(
        'base64',
    );
    return `Basic ${credentials}`;
};

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
