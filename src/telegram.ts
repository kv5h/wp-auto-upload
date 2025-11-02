export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramChat {
  id: number;
  title?: string;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  date?: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export const extractMessageText = (update: TelegramUpdate): string | null => {
  const candidateMessage =
    update.message ??
    update.channel_post ??
    update.edited_message ??
    update.edited_channel_post;

  if (!candidateMessage) {
    return null;
  }

  const text = candidateMessage.text ?? candidateMessage.caption;
  return text ? text.trim() : null;
};
