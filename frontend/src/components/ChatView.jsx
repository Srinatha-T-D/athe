import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { FiSend, FiPaperclip, FiX } from 'react-icons/fi';
import { useMediaUpload, ACCEPTED_MEDIA_TYPES } from '../hooks/useMediaUpload';
import MessageAttachment from '../components/MessageAttachment';
import { toast } from 'sonner';

export default function ChatView({
  otherUser,
  messages,
  setMessages,
  sendMessage,
  onBack,
  onlineUsers
}) {
  const { user, axiosAuth } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const { uploadFile, uploading } = useMediaUpload();
  const fileInputRef = useRef(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const isFirstLoad = useRef(true);

  // 🔥 Load messages + mark as read
  useEffect(() => {
    if (!otherUser?.id) return;

    let mounted = true;

    const loadMessages = async () => {
      try {
        const res = await axiosAuth().get(`/messages/${otherUser.id}`);

        if (!mounted) return;

        setMessages(prev => {
          const historyIds = new Set(res.data.messages.map(m => m.id));

          const newOnes = prev.filter(m =>
            m.type === 'dm' &&
            (
              (m.sender_id === user.id && m.receiver_id === otherUser.id) ||
              (m.sender_id === otherUser.id && m.receiver_id === user.id)
            ) &&
            !historyIds.has(m.id)
          );

          // 🔥 MARK AS READ
          const updated = [...res.data.messages, ...newOnes].map(m => {
            if (
              m.sender_id === otherUser.id &&
              m.receiver_id === user.id
            ) {
              return { ...m, is_read: true };
            }
            return m;
          });

          return updated;
        });

      } catch (e) {
        console.error('Failed to load messages:', e);
      }

      setLoading(false);
    };

    loadMessages();

    return () => { mounted = false };
  }, [otherUser?.id]);

  // 🔥 Reset first load on user change
  useEffect(() => {
    isFirstLoad.current = true;
  }, [otherUser?.id]);

  // 🥇 FILTER
  const dmMessages = useMemo(() => {
    return messages.filter(m =>
      !m.room_id && (
        (m.sender_id === user?.id && m.receiver_id === otherUser?.id) ||
        (m.sender_id === otherUser?.id && m.receiver_id === user?.id)
      )
    );
  }, [messages, user?.id, otherUser?.id]);

  // 🔥 SCROLL FIX (SAFE + CORRECT)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // First load → force scroll
    if (isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      isFirstLoad.current = false;
      return;
    }

    // Normal behavior
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dmMessages.length]);

  // 🔥 PLAY SOUND ON NEW MESSAGE
  useEffect(() => {
    if (!dmMessages.length) return;

    const last = dmMessages[dmMessages.length - 1];

    if (last.sender_id !== user.id) {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    }
  }, [dmMessages.length]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;

    sendMessage({
      type: 'dm',
      receiver_id: otherUser.id,
      content: input.trim(),
      sender_name: user.name
    });

    setInput('');
    inputRef.current?.focus();
  }, [input, otherUser?.id, user?.name]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    try {
      const result = await uploadFile(file);
      sendMessage({
        type: 'dm',
        receiver_id: otherUser.id,
        content: '',
        attachment_url: result.url,
        attachment_type: result.attachment_type,
        attachment_name: result.attachment_name,
        sender_name: user.name
      });
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  }, [uploadFile, otherUser?.id, user?.name]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOnline =
    onlineUsers?.[otherUser?.id] !== undefined
      ? onlineUsers[otherUser.id]
      : otherUser?.is_online;

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#070b14]">

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 pb-28"
      >
        <div className="py-4 space-y-2 flex flex-col justify-end min-h-full">

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : dmMessages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">
                Start chatting with {otherUser?.name}
              </p>
            </div>
          ) : (
            dmMessages.map((msg) => {
              const isMine = msg.sender_id === user?.id;

              return (
                <MessageBubble key={msg.id} msg={msg} isMine={isMine} />
              );
            })
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 w-full bg-[#0b0f1a] border-t border-white/5 p-3 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MEDIA_TYPES}
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="ghost"
          className="h-11 w-11 rounded-xl p-0 flex-shrink-0 text-slate-400 hover:text-white hover:bg-white/5"
          title="Attach image, gif, or audio"
        >
          <FiPaperclip className="w-4 h-4" />
        </Button>
        <Input
          ref={inputRef}
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          className="flex-1 bg-white/5 border-white/10 rounded-xl h-11 text-sm text-white"
        />

        <Button
          onClick={handleSend}
          disabled={!input.trim() || uploading}
          className="h-11 w-11 rounded-xl bg-violet-600 p-0"
        >
          <FiSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const MessageBubble = React.memo(({ msg, isMine }) => {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 ${
          isMine
            ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm'
            : 'bg-white/5 text-slate-200 rounded-2xl rounded-tl-sm border border-white/5'
        }`}
      >
        <MessageAttachment url={msg.attachment_url} type={msg.attachment_type} name={msg.attachment_name} />
        {msg.content && <p className="text-sm break-words">{msg.content}</p>}
        <p className="text-[10px] mt-1 opacity-60">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
});
