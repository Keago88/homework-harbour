/**
 * Chat service using Firestore for real-time messaging.
 * Collections: chats/{chatId}, chats/{chatId}/messages/{msgId}
 *
 * Demo / missing Firebase session falls back to localStorage so Chat is not a brick.
 */
import { db, auth } from './firebase';
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';
import { storageGet, storageSet, canUseLocalPersistence } from './storage';

const CHATS = 'chats';
const MESSAGES = 'messages';
const LOCAL_CHATS_KEY = 'hw_local_chats';
const LOCAL_MSGS_KEY = 'hw_local_messages';

const useFirestore = () => !!db && !!auth?.currentUser;
const useLocal = () => !useFirestore() && canUseLocalPersistence();

const chatListeners = [];
const parentListeners = [];
const msgListeners = [];

function loadLocalChats() {
  try {
    const raw = storageGet(LOCAL_CHATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalChats(chats) {
  storageSet(LOCAL_CHATS_KEY, JSON.stringify(chats));
}

function loadLocalMsgs() {
  try {
    const raw = storageGet(LOCAL_MSGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalMsgs(map) {
  storageSet(LOCAL_MSGS_KEY, JSON.stringify(map));
}

function emitLocalChats() {
  const chats = loadLocalChats();
  chatListeners.forEach(({ email, cb }) => {
    const list = chats
      .filter(c => (c.participants || []).includes(email))
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
    cb(list);
  });
  parentListeners.forEach(({ childEmail, cb }) => {
    cb(chats.filter(c => (c.participants || []).includes(childEmail)));
  });
}

function emitLocalMsgs(chatId) {
  const map = loadLocalMsgs();
  const list = map[chatId] || [];
  msgListeners.filter(l => l.chatId === chatId).forEach(({ cb }) => cb(list));
}

function subscribe(arr, item) {
  arr.push(item);
  return () => {
    const i = arr.indexOf(item);
    if (i >= 0) arr.splice(i, 1);
  };
}

async function localCreateChat({ participants, type = 'direct', name = '' }) {
  const sorted = [...participants].sort();
  const chats = loadLocalChats();
  const existing = chats.find(c =>
    c.type === type &&
    JSON.stringify([...(c.participants || [])].sort()) === JSON.stringify(sorted)
  );
  if (existing) return existing.id;
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  chats.unshift({
    id,
    participants: sorted,
    participantEmails: sorted,
    type,
    name,
    createdAt: now,
    lastMessage: null,
    lastMessageAt: now,
    unreadBy: [],
  });
  saveLocalChats(chats);
  emitLocalChats();
  return id;
}

function localGetChatsForUser(userEmail, callback) {
  const item = { email: userEmail, cb: callback };
  const unsub = subscribe(chatListeners, item);
  emitLocalChats();
  return unsub;
}

function localGetParentViewableChats(childEmail, callback) {
  const item = { childEmail, cb: callback };
  const unsub = subscribe(parentListeners, item);
  emitLocalChats();
  return unsub;
}

async function localSendMessage(chatId, { senderEmail, senderName, text, attachment = null }) {
  if (!text?.trim()) return;
  const now = Date.now();
  const msg = {
    id: `m-${now}-${Math.random().toString(36).slice(2, 8)}`,
    senderEmail,
    senderName,
    text: text.trim(),
    attachment,
    createdAt: now,
    readBy: [senderEmail],
  };
  const map = loadLocalMsgs();
  map[chatId] = [...(map[chatId] || []), msg];
  saveLocalMsgs(map);

  const chats = loadLocalChats();
  const idx = chats.findIndex(c => c.id === chatId);
  if (idx >= 0) {
    const chat = chats[idx];
    const otherParticipants = (chat.participants || []).filter(p => p !== senderEmail);
    chats[idx] = {
      ...chat,
      lastMessage: text.trim().slice(0, 100),
      lastMessageSender: senderName,
      lastMessageAt: now,
      unreadBy: otherParticipants,
    };
    saveLocalChats(chats);
  }
  emitLocalMsgs(chatId);
  emitLocalChats();
  return msg.id;
}

function localGetMessages(chatId, callback) {
  const item = { chatId, cb: callback };
  const unsub = subscribe(msgListeners, item);
  emitLocalMsgs(chatId);
  return unsub;
}

async function localMarkChatRead(chatId, userEmail) {
  const chats = loadLocalChats();
  const idx = chats.findIndex(c => c.id === chatId);
  if (idx < 0) return;
  const unreadBy = (chats[idx].unreadBy || []).filter(e => e !== userEmail);
  chats[idx] = { ...chats[idx], unreadBy };
  saveLocalChats(chats);
  emitLocalChats();
}

async function localDeleteChat(chatId) {
  saveLocalChats(loadLocalChats().filter(c => c.id !== chatId));
  const map = loadLocalMsgs();
  delete map[chatId];
  saveLocalMsgs(map);
  emitLocalChats();
  emitLocalMsgs(chatId);
}

// --- Chat CRUD ---

export const createChat = async ({ participants, type = 'direct', name = '' }) => {
  if (useLocal()) return localCreateChat({ participants, type, name });
  if (!useFirestore()) return null;
  const sorted = [...participants].sort();
  const existing = await findExistingChat(sorted, type);
  if (existing) return existing;

  const ref = await addDoc(collection(db, CHATS), {
    participants: sorted,
    participantEmails: sorted,
    type,
    name,
    createdAt: serverTimestamp(),
    lastMessage: null,
    lastMessageAt: serverTimestamp(),
    unreadBy: [],
  });
  return ref.id;
};

const findExistingChat = async (sortedParticipants, type) => {
  if (!useFirestore()) return null;
  const q = query(
    collection(db, CHATS),
    where('type', '==', type),
    where('participantEmails', '==', sortedParticipants)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
};

export const getChatsForUser = (userEmail, callback) => {
  if (useLocal()) return localGetChatsForUser(userEmail, callback);
  if (!useFirestore()) { callback([]); return () => {}; }
  const q = query(
    collection(db, CHATS),
    where('participants', 'array-contains', userEmail),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
};

export const getParentViewableChats = (childEmail, callback) => {
  if (useLocal()) return localGetParentViewableChats(childEmail, callback);
  if (!useFirestore()) { callback([]); return () => {}; }
  const q = query(
    collection(db, CHATS),
    where('participants', 'array-contains', childEmail)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
};

// --- Messages ---

export const sendMessage = async (chatId, { senderEmail, senderName, text, attachment = null }) => {
  if (useLocal()) return localSendMessage(chatId, { senderEmail, senderName, text, attachment });
  if (!useFirestore() || !text?.trim()) return;
  const msgRef = await addDoc(collection(db, CHATS, chatId, MESSAGES), {
    senderEmail,
    senderName,
    text: text.trim(),
    attachment,
    createdAt: serverTimestamp(),
    readBy: [senderEmail],
  });

  const chatRef = doc(db, CHATS, chatId);
  const chatSnap = await getDoc(chatRef);
  const chatData = chatSnap.exists() ? chatSnap.data() : {};
  const otherParticipants = (chatData.participants || []).filter(p => p !== senderEmail);

  await setDoc(chatRef, {
    lastMessage: text.trim().slice(0, 100),
    lastMessageSender: senderName,
    lastMessageAt: serverTimestamp(),
    unreadBy: otherParticipants,
  }, { merge: true });

  return msgRef.id;
};

export const getMessages = (chatId, callback, msgLimit = 100) => {
  if (useLocal()) return localGetMessages(chatId, callback);
  if (!useFirestore()) { callback([]); return () => {}; }
  const q = query(
    collection(db, CHATS, chatId, MESSAGES),
    orderBy('createdAt', 'asc'),
    limit(msgLimit)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
};

export const markChatRead = async (chatId, userEmail) => {
  if (useLocal()) return localMarkChatRead(chatId, userEmail);
  if (!useFirestore()) return;
  const chatRef = doc(db, CHATS, chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const unreadBy = (data.unreadBy || []).filter(e => e !== userEmail);
  await setDoc(chatRef, { unreadBy }, { merge: true });
};

export const deleteChat = async (chatId) => {
  if (useLocal()) return localDeleteChat(chatId);
  if (!useFirestore()) return;
  const msgsSnap = await getDocs(collection(db, CHATS, chatId, MESSAGES));
  const deletes = msgsSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(deletes);
  await deleteDoc(doc(db, CHATS, chatId));
};

// --- Helpers ---

export const getChatDisplayName = (chat, currentEmail) => {
  if (chat.name) return chat.name;
  const others = (chat.participants || []).filter(p => p !== currentEmail);
  return others.join(', ') || 'Chat';
};

export const getUnreadCount = (chats, userEmail) => {
  return chats.filter(c => (c.unreadBy || []).includes(userEmail)).length;
};
