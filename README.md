# wp-auto-upload

AWS Lambda function that polls Telegram groups on a schedule, rewrites prompts with DeepSeek, and publishes the generated article to WordPress (then deletes the original messages).

## Architecture

### User's post based

1. User post prompts to a Telegram group (Manually)
1. Run any cloud server by schedule
1. @ NodeJS application
   1. Get new posts on Telegram group
      1. For each post
         1. Generate a blog content with AI LLM
         1. Create a blog content via WordPress API
         1. Delete original post

### [TODO] Cron based

1. Run a cloud server by schedule
1. @ NodeJS application
   1. Search trending keywords from Google
   1. Generate a blog content with AI LLM
   1. Create a blog content via WordPress API 2.

## How it works

- An EventBridge schedule (or another trigger) invokes the Lambda at the interval you choose.
- The Lambda pulls pending updates from Telegram via the `getUpdates` Bot API method.
- Each prompt is sent to DeepSeek to generate a blog post, which is then published through the WordPress REST API.
- After a successful publish, the originating Telegram message is deleted so it is not processed again.

## Environment variables

| Name                             | Required | Description                                                                |
| -------------------------------- | -------- | -------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`               | ✅       | Secret key for the DeepSeek API.                                           |
| `DEEPSEEK_MODEL`                 | ⛔️      | Chat model name. Defaults to `deepseek-chat`.                              |
| `DEEPSEEK_SYSTEM_PROMPT`         | ⛔️      | System prompt for the assistant. Default asks for a publishable blog post. |
| `TELEGRAM_BOT_TOKEN`             | ✅       | Bot token obtained from BotFather.                                         |
| `TELEGRAM_CHAT_ID`               | ✅       | Numeric chat ID of the target group (e.g. `-1001234567890`).               |
| `TELEGRAM_FETCH_LIMIT`           | ⛔️      | Max updates to fetch per run (1-100). Defaults to `50`.                    |
| `WORDPRESS_BASE_URL`             | ✅       | WordPress site root, e.g. `https://example.com`.                           |
| `WORDPRESS_USERNAME`             | ✅       | WordPress username that owns an Application Password.                      |
| `WORDPRESS_APPLICATION_PASSWORD` | ✅       | WordPress Application Password used for Basic Auth.                        |
| `WORDPRESS_POST_STATUS`          | ⛔️      | Status for new posts (e.g. `draft`, `publish`). Defaults to `draft`.       |

All secrets must be supplied through Lambda environment variables. Nothing is stored in the code.

## Local development

1. Install dependencies once: `npm install`
2. Compile TypeScript: `npm run build`
3. (Optional) Run the handler locally (will contact Telegram/WordPress directly, so set the environment variables first):

   ```bash
   node -e "const { handler } = require('./dist/handler'); (async () => { await handler(); })();"
   ```

## Local emulation with Docker

This project includes a `Dockerfile` based on the official AWS Lambda Node.js image. It lets you run the Lambda locally with the same runtime the cloud service uses.

1. Build the image: `docker build -t wp-auto-upload .`
2. Run the container while supplying the environment variables (replace values as needed):

   ```bash
   docker run --rm -p 9000:8080 \
     --env-file ./.env \
     wp-auto-upload
   ```

3. Trigger the local Lambda endpoint:

   ```bash
   curl -X POST \
     http://localhost:9000/2015-03-31/functions/function/invocations \
     -d '{}'
   ```

   While the container runs it will pull live updates from Telegram, publish to WordPress, and delete processed messages. `events/sample-telegram.json` illustrates a typical Telegram [Update](https://core.telegram.org/bots/api#update); adjust it if you need to simulate incoming messages when
   stubbing the Bot API.

## Telegram group setup

1. **Create a Telegram bot**
   - Talk to [@BotFather](https://t.me/BotFather) and create a new bot.
   - Copy the API token it returns and set it as `TELEGRAM_BOT_TOKEN`.
2. **Add the bot to the target group**
   - Invite the bot account to the Telegram group you want to automate.
   - Promote the bot to admin (required to delete processed messages) and ensure it has rights to see and remove messages.
3. **Obtain the group chat ID**
   - Temporarily enable [Bot API mode with privacy disabled](https://core.telegram.org/bots/features#privacy-mode) or use a helper bot (e.g. [@RawDataBot](https://t.me/RawDataBot)) to read the `chat.id` value when a message is posted in the group.
   - The ID is usually negative for supergroups (e.g. `-1001234567890`). Set this value as `TELEGRAM_CHAT_ID`.
4. **Reset webhook (optional but recommended)**
   - Because this project uses polling via `getUpdates`, ensure no webhook is configured by calling:
     ```bash
     curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url="
     ```

## Error handling

- Updates without text content or from other chats are skipped and acknowledged so they are not retried.
- Failures during DeepSeek, WordPress, or Telegram deletion leave the update unacknowledged, ensuring it will be retried on the next scheduled run (check CloudWatch logs for details).
