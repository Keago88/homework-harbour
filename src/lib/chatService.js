/**
 * Chat service using Firestore for real-time messaging.
 * Collections: chats/{chatId}, chats/{chatId}/messages/{msgId}
 */
import { db } from './firebase';
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, limit,
  arrayUnion
} from 'firebase/firestore';

const CHATS = 'chats';
const MESSAGES = 'messages';

const useFirestore = () => !!db;

// --- Chat CRUD ---

export const createChat = async ({ participants, type = 'direct', name = '' }) => {
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
  if (!useFirestore()) return;
  const chatRef = doc(db, CHATS, chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const unreadBy = (data.unreadBy || []).filter(e => e !== userEmail);
  await setDoc(chatRef, { unreadBy }, { merge: true });
};

export const deleteChat = async (chatId) => {
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
