# wp-auto-upload

AWS Lambda function that listens to Telegram group webhooks, rewrites the message with OpenAI, and publishes the generated article to WordPress.

## Architecture

### User initiated

1. Post a prompt to a Telegram group (Manually)
1. Webhook is posted to Cloud server
1. @ NodeJS application
   1. Generate a blog content with AI LLM
   1. Create a blog content via WordPress API

### Cron based

1. Run Cloud server via any schedule
1. @ NodeJS application
   1. Search trending keywords from Google
   1. Generate a blog content with AI LLM
   1. Create a blog content via WordPress API 2.

## How it works

- Telegram posts the group webhook directly to the Lambda Function URL.
- Lambda (`dist/handler.handler`) forwards the Telegram message to OpenAI's Chat Completions API.
- OpenAI's answer is published to WordPress through the REST API.

## Environment variables

| Name                             | Required | Description                                                                |
| -------------------------------- | -------- | -------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                 | ✅       | Secret key for the OpenAI API.                                             |
| `OPENAI_MODEL`                   | ⛔️      | Chat model name. Defaults to `gpt-4o-mini`.                                |
| `OPENAI_SYSTEM_PROMPT`           | ⛔️      | System prompt for the assistant. Default asks for a publishable blog post. |
| `WORDPRESS_BASE_URL`             | ✅       | WordPress site root, e.g. `https://example.com`.                           |
| `WORDPRESS_USERNAME`             | ✅       | WordPress username that owns an Application Password.                      |
| `WORDPRESS_APPLICATION_PASSWORD` | ✅       | WordPress Application Password used for Basic Auth.                        |
| `WORDPRESS_POST_STATUS`          | ⛔️      | Status for new posts (e.g. `draft`, `publish`). Defaults to `draft`.       |

All secrets must be supplied through Lambda environment variables. Nothing is stored in the code.

## Local development

1. Install dependencies once: `npm install`
2. Compile TypeScript: `npm run build`
3. (Optional) Simulate a webhook by running the compiled handler with a mock event:

   ```bash
   node -e "const { handler } = require('./dist/handler'); (async () => console.log(await handler({ body: JSON.stringify({ message: { text: 'Hello from Telegram!', chat: { id: 1, type: 'group' }, message_id: 1 } }) })))();"
   ```

   Provide the required environment variables before running the command.

## Local emulation with Docker

This project includes a `Dockerfile` based on the official AWS Lambda Node.js image. It lets you run the Lambda locally with the same runtime the cloud service uses.

1. Build the image: `docker build -t wp-auto-upload .`
2. Run the container while supplying the environment variables (replace values as needed):

   ```bash
   docker run --rm -p 9000:8080 \
     -e OPENAI_API_KEY=sk-your-key \
     -e WORDPRESS_BASE_URL=https://example.com \
     -e WORDPRESS_USERNAME=bot \
     -e WORDPRESS_APPLICATION_PASSWORD=app-password \
     wp-auto-upload
   ```

3. Send a sample Telegram payload to the local Lambda endpoint:

   ```bash
   curl -X POST \
     http://localhost:9000/2015-03-31/functions/function/invocations \
     -d @events/function-url-event.json
   ```

   The response mirrors the production Lambda output. `events/sample-telegram.json` contains the raw Telegram [Update](https://core.telegram.org/bots/api#update) object, and `events/function-url-event.json` wraps that payload in the structure produced by a Lambda Function URL. Adjust either file to
   test different messages or scenarios.

## Deployment outline

1. Compile the sources: `npm run build`
2. Zip the `dist` directory with the `node_modules` folder and upload it as a Lambda function.
3. Set the handler to `handler.handler` and the runtime to Node.js 18.x (or newer).
4. Enable a Lambda Function URL (auth type: `NONE`) and note the generated HTTPS endpoint.
5. Configure the environment variables listed above.
6. Point the Telegram bot webhook to the Lambda Function URL.

## Error handling

- Webhooks without text or captioned content are ignored with a `200` response so Telegram stops retrying.
- OpenAI and WordPress failures are logged and return `500` to make the issue visible in CloudWatch.
