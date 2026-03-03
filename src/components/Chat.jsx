import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, Send, ArrowLeft, Plus, X, Search, Users,
  Check, CheckCheck, Clock, Lock, ChevronRight, Eye
} from 'lucide-react';
import {
  createChat, getChatsForUser, getParentViewableChats, sendMessage,
  getMessages, markChatRead, getChatDisplayName, getUnreadCount, deleteChat
} from '../lib/chatService';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMsgTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const Avatar = ({ name, size = 40 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['bg-violet-500', 'bg-fuchsia-500', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-rose-500'];
  const idx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={`${colors[idx]} rounded-full flex items-center justify-center text-white font-black shrink-0`} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
};

const NewChatModal = ({ onClose, onStart, contacts, currentEmail }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const filtered = contacts.filter(c =>
    c.email !== currentEmail && (c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const handleStart = () => {
    if (selected.length === 0) return;
    const participants = [currentEmail, ...selected.map(s => s.email)];
    const type = participants.length > 2 ? 'group' : 'direct';
    const name = type === 'group' ? selected.map(s => s.name.split(' ')[0]).join(', ') + ' & You' : '';
    onStart({ participants, type, name });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-800">New conversation</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selected.map(s => (
                <span key={s.email} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
                  {s.name.split(' ')[0]}
                  <button onClick={() => setSelected(prev => prev.filter(p => p.email !== s.email))}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No contacts found</p>
          ) : filtered.map(c => {
            const isSelected = selected.some(s => s.email === c.email);
            return (
              <button key={c.email} onClick={() => setSelected(prev => isSelected ? prev.filter(p => p.email !== c.email) : [...prev, c])} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'}`}>
                <Avatar name={c.name} size={36} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-700 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{c.email}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.role === 'Teacher' ? 'bg-violet-100 text-violet-600' : c.role === 'Parent' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{c.role}</span>
                {isSelected && <div className="w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></div>}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleStart} disabled={selected.length === 0} className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
            {selected.length > 1 ? 'Start group chat' : selected.length === 1 ? `Chat with ${selected[0].name.split(' ')[0]}` : 'Select a contact'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ msg, isMine, showSender }) => (
  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
    <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${isMine ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-br-md' : 'bg-white border border-slate-100 text-slate-800 rounded-bl-md shadow-sm'}`}>
      {showSender && !isMine && <p className="text-[10px] font-black mb-0.5 text-violet-500">{msg.senderName}</p>}
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
      <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMine ? 'text-white/60' : 'text-slate-400'}`}>
        <span className="text-[9px]">{formatMsgTime(msg.createdAt)}</span>
        {isMine && <CheckCheck size={12} />}
      </div>
    </div>
  </div>
);

const ChatThread = ({ chat, currentEmail, currentName, onBack, viewOnly = false }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const isGroup = (chat.participants || []).length > 2;

  useEffect(() => {
    const unsub = getMessages(chat.id, setMessages);
    markChatRead(chat.id, currentEmail);
    return unsub;
  }, [chat.id, currentEmail]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending || viewOnly) return;
    setSending(true);
    try {
      await sendMessage(chat.id, { senderEmail: currentEmail, senderName: currentName, text });
      setText('');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const displayName = getChatDisplayName(chat, currentEmail);

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 bg-white border-b border-slate-100 flex items-center gap-3 px-4 shrink-0">
        <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg md:hidden"><ArrowLeft size={18} className="text-slate-600" /></button>
        <Avatar name={displayName} size={34} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{displayName}</p>
          <p className="text-[10px] text-slate-400">
            {viewOnly ? (
              <span className="flex items-center gap-1"><Eye size={10} /> View only</span>
            ) : (
              isGroup ? `${chat.participants.length} participants` : 'Tap to view info'
            )}
          </p>
        </div>
        {viewOnly && (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg flex items-center gap-1"><Eye size={12} /> Monitoring</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-[#f0f2f5] space-y-0.5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-3"><MessageSquare size={28} className="text-violet-400" /></div>
            <p className="text-sm font-bold text-slate-500">{viewOnly ? 'No messages to view' : 'Start the conversation'}</p>
            <p className="text-xs text-slate-400 mt-1">{viewOnly ? 'Messages between the teacher and student will appear here' : 'Send a message to begin chatting'}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderEmail === currentEmail;
          const showSender = isGroup && !isMine && (i === 0 || messages[i - 1]?.senderEmail !== msg.senderEmail);
          const showDate = i === 0 || (() => {
            const prev = messages[i - 1]?.createdAt;
            if (!prev || !msg.createdAt) return false;
            const pDate = (prev.toDate ? prev.toDate() : new Date(prev)).toDateString();
            const cDate = (msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt)).toDateString();
            return pDate !== cDate;
          })();
          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 bg-white/80 rounded-lg text-[10px] font-bold text-slate-500 shadow-sm">
                    {msg.createdAt ? (msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt)).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              )}
              <MessageBubble msg={msg} isMine={isMine} showSender={showSender} />
            </React.Fragment>
          );
        })}
      </div>

      {viewOnly ? (
        <div className="h-12 bg-slate-100 border-t border-slate-200 flex items-center justify-center gap-2 text-slate-500 shrink-0">
          <Lock size={14} />
          <span className="text-xs font-bold">View-only mode — you cannot send messages</span>
        </div>
      ) : (
        <div className="bg-white border-t border-slate-100 px-4 py-3 flex items-end gap-2 shrink-0">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300 max-h-32"
            style={{ minHeight: 40 }}
          />
          <button onClick={handleSend} disabled={!text.trim() || sending} className="w-10 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center text-white disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform shrink-0 shadow-sm">
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default function Chat({ userEmail, userName, userRole, isPremium, linkedStudents = [], confirm }) {
  const [chats, setChats] = useState([]);
  const [parentViewChats, setParentViewChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [viewOnly, setViewOnly] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!userEmail) return;
    const unsub = getChatsForUser(userEmail, setChats);
    return unsub;
  }, [userEmail]);

  useEffect(() => {
    if (userRole !== 'Parent' || !linkedStudents.length) return;
    const unsubs = linkedStudents.map(childEmail =>
      getParentViewableChats(childEmail, newChats => {
        setParentViewChats(prev => {
          const otherKids = prev.filter(c => !c.participants.includes(childEmail));
          const viewable = newChats.filter(c => !c.participants.includes(userEmail));
          return [...otherKids, ...viewable];
        });
      })
    );
    return () => unsubs.forEach(u => u());
  }, [userRole, linkedStudents, userEmail]);

  useEffect(() => {
    const buildContacts = async () => {
      try {
        const { db } = await import('../lib/firebase');
        if (!db) return;
        const { collection, getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'user_data'));
        const list = [];
        snap.docs.forEach(d => {
          const data = d.data();
          const profile = data.profile;
          if (profile?.email && profile.email !== userEmail) {
            list.push({ email: profile.email, name: profile.name || profile.email.split('@')[0], role: profile.role || 'Student' });
          }
        });
        setContacts(list);
      } catch {}
    };
    buildContacts();
  }, [userEmail]);

  const handleStartChat = async ({ participants, type, name }) => {
    const chatId = await createChat({ participants, type, name });
    if (chatId) {
      setShowNewChat(false);
      const chat = chats.find(c => c.id === chatId) || { id: chatId, participants, type, name };
      setActiveChat(chat);
      setViewOnly(false);
    }
  };

  const handleOpenChat = (chat, isViewOnly = false) => {
    setActiveChat(chat);
    setViewOnly(isViewOnly);
    if (!isViewOnly) markChatRead(chat.id, userEmail);
  };

  const unreadCount = getUnreadCount(chats, userEmail);

  const allChats = useMemo(() => {
    const myChats = chats.map(c => ({ ...c, _viewOnly: false }));
    const viewableChats = parentViewChats.map(c => ({ ...c, _viewOnly: true }));
    let combined = [...myChats, ...viewableChats];
    combined = combined.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    if (filter === 'my') combined = combined.filter(c => !c._viewOnly);
    if (filter === 'monitoring') combined = combined.filter(c => c._viewOnly);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      combined = combined.filter(c => getChatDisplayName(c, userEmail).toLowerCase().includes(t));
    }
    return combined;
  }, [chats, parentViewChats, filter, searchTerm, userEmail]);

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mb-4">
          <Lock size={32} className="text-violet-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-2">Chat is a Premium feature</h2>
        <p className="text-sm text-slate-500 max-w-sm mb-6">Upgrade to Pro to message teachers, students, and parents directly within Homework Harbour.</p>
        <div className="bg-white rounded-xl p-4 border border-slate-100 max-w-sm w-full space-y-2 text-left">
          <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span className="text-xs font-bold text-slate-600">Direct messaging with teachers</span></div>
          <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span className="text-xs font-bold text-slate-600">Group conversations</span></div>
          <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span className="text-xs font-bold text-slate-600">Parent monitoring of student chats</span></div>
          <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span className="text-xs font-bold text-slate-600">Real-time message delivery</span></div>
        </div>
      </div>
    );
  }

  if (activeChat) {
    return (
      <ChatThread
        chat={activeChat}
        currentEmail={userEmail}
        currentName={userName}
        onBack={() => { setActiveChat(null); setViewOnly(false); }}
        viewOnly={viewOnly}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><MessageSquare size={20} className="text-violet-500" /> Chats</h2>
          <button onClick={() => setShowNewChat(true)} className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform shadow-sm">
            <Plus size={16} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search conversations..." className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-300" />
        </div>

        {userRole === 'Parent' && parentViewChats.length > 0 && (
          <div className="flex gap-1 mb-2">
            {['all', 'my', 'monitoring'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors ${filter === f ? 'bg-violet-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {f === 'all' ? 'All' : f === 'my' ? 'My chats' : (
                  <span className="flex items-center gap-1"><Eye size={10} /> Monitoring</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {allChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageSquare size={40} className="text-slate-200 mb-3" />
            <p className="text-sm font-bold text-slate-500">No conversations yet</p>
            <p className="text-xs text-slate-400 mt-1">Start a new chat to begin messaging</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {allChats.map(chat => {
              const name = getChatDisplayName(chat, userEmail);
              const isUnread = (chat.unreadBy || []).includes(userEmail);
              const isMonitoring = chat._viewOnly;
              return (
                <button key={chat.id} onClick={() => handleOpenChat(chat, isMonitoring)} className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left ${isUnread ? 'bg-violet-50/50' : ''}`}>
                  <div className="relative">
                    <Avatar name={name} size={44} />
                    {isMonitoring && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center border-2 border-white"><Eye size={10} className="text-amber-600" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${isUnread ? 'font-black text-slate-800' : 'font-bold text-slate-700'}`}>{name}</p>
                      <span className={`text-[10px] shrink-0 ${isUnread ? 'font-bold text-violet-600' : 'text-slate-400'}`}>{formatTime(chat.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-700' : 'text-slate-400'}`}>
                        {isMonitoring && <Eye size={10} className="inline mr-1 text-amber-500" />}
                        {chat.lastMessage ? (chat.lastMessageSender ? `${chat.lastMessageSender.split(' ')[0]}: ${chat.lastMessage}` : chat.lastMessage) : 'No messages yet'}
                      </p>
                      {isUnread && <div className="w-2.5 h-2.5 bg-violet-500 rounded-full shrink-0" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStart={handleStartChat}
          contacts={contacts}
          currentEmail={userEmail}
        />
      )}
    </div>
  );
}
