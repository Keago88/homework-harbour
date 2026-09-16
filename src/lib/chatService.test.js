import { describe, it, expect, beforeEach } from 'vitest';
import {
  createChat,
  getChatsForUser,
  sendMessage,
  getMessages,
  getChatDisplayName,
  getUnreadCount,
  markChatRead,
} from './chatService';

describe('chatService local fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a direct chat, sends a message, and notifies subscribers', async () => {
    const chatsSeen = [];
    const unsubChats = getChatsForUser('a@x.com', list => chatsSeen.push(list));

    const chatId = await createChat({
      participants: ['a@x.com', 'b@x.com'],
      type: 'direct',
      name: '',
    });
    expect(chatId).toBeTruthy();

    const messagesSeen = [];
    const unsubMsgs = getMessages(chatId, list => messagesSeen.push(list));

    await sendMessage(chatId, {
      senderEmail: 'a@x.com',
      senderName: 'Ada',
      text: 'Hello teacher',
    });

    const latestChats = chatsSeen[chatsSeen.length - 1];
    expect(latestChats).toHaveLength(1);
    expect(latestChats[0].lastMessage).toBe('Hello teacher');
    expect(getUnreadCount(latestChats, 'b@x.com')).toBe(1);
    expect(getUnreadCount(latestChats, 'a@x.com')).toBe(0);
    expect(getChatDisplayName(latestChats[0], 'a@x.com')).toBe('b@x.com');

    const latestMsgs = messagesSeen[messagesSeen.length - 1];
    expect(latestMsgs).toHaveLength(1);
    expect(latestMsgs[0].text).toBe('Hello teacher');

    await markChatRead(chatId, 'b@x.com');
    const afterRead = chatsSeen[chatsSeen.length - 1];
    expect(getUnreadCount(afterRead, 'b@x.com')).toBe(0);

    unsubChats();
    unsubMsgs();
  });

  it('reuses an existing direct chat for the same participants', async () => {
    const first = await createChat({ participants: ['t@x.com', 's@x.com'], type: 'direct' });
    const second = await createChat({ participants: ['s@x.com', 't@x.com'], type: 'direct' });
    expect(second).toBe(first);
  });
});
