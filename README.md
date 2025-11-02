# wp-auto-upload

Automatically upload WordPress content

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
