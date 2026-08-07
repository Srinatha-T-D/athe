import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ScrollArea } from '../components/ui/scroll-area';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { FiSend, FiPaperclip } from 'react-icons/fi';
import { useMediaUpload, ACCEPTED_MEDIA_TYPES } from '../hooks/useMediaUpload';
import MessageAttachment from '../components/MessageAttachment';
import { toast } from 'sonner';

export default function RoomChat({ room, messages, setMessages, sendMessage, onBack }) {
  const { user, axiosAuth } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const { uploadFile, uploading } = useMediaUpload();
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load room messages
  useEffect(() => {
    if (!room?.id) return;
    const loadMessages = async () => {
      try {
        const res = await axiosAuth().get(`/rooms/${room.id}/messages`);
        setMessages(prev => {
          const historyIds = new Set(res.data.messages.map(m => m.id));
          const newOnes = prev.filter(m =>
            m.room_id === room.id && !historyIds.has(m.id)
          );
          return [...res.data.messages, ...newOnes];
        });
      } catch (e) {
        console.error('Failed to load room messages:', e);
      }
      setLoading(false);
    };
    loadMessages();
  }, [room?.id]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const roomMessages = messages.filter(m => m.room_id === room?.id);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({
      type: 'room',
      room_id: room.id,
      content: input.trim(),
      sender_name: user.name
    });
    setInput('');
    inputRef.current?.focus();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const result = await uploadFile(file);
      sendMessage({
        type: 'room',
        room_id: room.id,
        content: '',
        attachment_url: result.url,
        attachment_type: result.attachment_type,
        attachment_name: result.attachment_name,
        sender_name: user.name
      });
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col" data-testid="room-chat">
      {/* Room info bar */}
      <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
        <p className="text-xs text-slate-400">{room?.description || 'Chat room'} · {room?.members?.length || 0} members</p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-3 min-h-full flex flex-col justify-end">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : roomMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl text-violet-300 font-bold">#</span>
              </div>
              <p className="text-slate-400 text-sm">Welcome to #{room?.name}</p>
              <p className="text-slate-600 text-xs mt-1">Be the first to say something!</p>
            </div>
          ) : (
            roomMessages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isMine ? 'bubble-in-right' : 'bubble-in-left'}`}
                  data-testid={`room-message-${msg.id}`}
                >
                  <div className={`max-w-[80%] ${
                    isMine
                      ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5'
                      : 'bg-white/5 text-slate-200 rounded-2xl rounded-tl-sm border border-white/5 px-4 py-2.5'
                  }`}>
                    {!isMine && (
                      <p className="text-xs font-medium text-cyan-400 mb-0.5">{msg.sender_name || 'Unknown'}</p>
                    )}
                    <MessageAttachment url={msg.attachment_url} type={msg.attachment_type} name={msg.attachment_name} />
                    {msg.content && <p className="text-sm leading-relaxed break-words">{msg.content}</p>}
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-violet-200/60' : 'text-slate-500'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="glass border-t border-white/5 p-3 flex items-center gap-2" data-testid="room-chat-input-area">
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
          data-testid="room-chat-input"
          placeholder={uploading ? 'Uploading...' : `Message #${room?.name || 'room'}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          className="flex-1 bg-white/5 border-white/10 rounded-xl h-11 text-sm text-white placeholder:text-slate-500 focus:border-violet-500"
        />
        <Button
          data-testid="room-send-button"
          onClick={handleSend}
          disabled={!input.trim() || uploading}
          className="h-11 w-11 rounded-xl bg-violet-600 hover:bg-violet-500 p-0 transition-all active:scale-95 disabled:opacity-30"
        >
          <FiSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
