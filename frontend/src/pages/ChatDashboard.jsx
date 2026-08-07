import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

// Lazy components
const TopBar = lazy(() => import('../components/TopBar'));
const Sidebar = lazy(() => import('../components/Sidebar'));
const UserList = lazy(() => import('../components/UserList'));
const ChatView = lazy(() => import('../components/ChatView'));
const RoomList = lazy(() => import('../components/RoomList'));
const RoomChat = lazy(() => import('../components/RoomChat'));
const ProfileView = lazy(() => import('../components/ProfileView'));
const SessionTimeout = lazy(() => import('../components/SessionTimeout'));

function Loader() {
  return (
    <div className="flex items-center justify-center h-full text-white">
      Loading...
    </div>
  );
}

// 🔊 Notification sound
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export default function ChatDashboard() {
  const { user, token, sessionExpired } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('users');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [filters, setFilters] = useState({ gender: '', place: '', country: '', online_only: false });
  const [unreadCounts, setUnreadCounts] = useState({});

  const selectedUserRef = useRef(null);
  const historyStackRef = useRef([]);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  const pushNav = useCallback((view) => {
    historyStackRef.current.push({ view });
    window.history.pushState({ athe: true }, '');
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const stack = historyStackRef.current;
      if (stack.length > 0) {
        const prev = stack.pop();
        if (prev.view === 'chat') {
          setCurrentView('users');
          setSelectedUser(null);
        } else if (prev.view === 'room-chat') {
          setCurrentView('rooms');
          setSelectedRoom(null);
        } else {
          setCurrentView('users');
        }
      }
      window.history.pushState({ athe: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    window.history.pushState({ athe: true }, '');

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 🔥 FIXED WEBSOCKET HANDLER
  const handleWsMessage = useCallback((data) => {

    // =========================
    // DM MESSAGE
    // =========================
    if (data.type === 'dm') {

      // Add message
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, data];
      });

      // Increase unread if chat NOT open
      if (
        data.sender_id !== user?.id &&
        selectedUserRef.current?.id !== data.sender_id
      ) {
        setUnreadCounts(prev => ({
          ...prev,
          [data.sender_id]: (prev[data.sender_id] || 0) + 1
        }));
      }

      // Play sound only for incoming
      if (data.sender_id !== user?.id) {
        playNotificationSound();
      }
    }

    // =========================
    // ROOM MESSAGE
    // =========================
    else if (data.type === 'room') {
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }

    // =========================
    // STATUS UPDATE
    // =========================
    else if (data.type === 'status') {
      setOnlineUsers(prev => ({
        ...prev,
        [data.user_id]: data.is_online
      }));
    }

  }, [user?.id]);

  const { sendMessage, connected } = useWebSocket(user?.id, token, handleWsMessage);

  // 🔥 FIX: CLEAR UNREAD WHEN OPENING CHAT
  const openChat = (chatUser) => {
    pushNav('chat');

    setUnreadCounts(prev => ({
      ...prev,
      [chatUser.id]: 0
    }));

    setSelectedUser(chatUser);
    setCurrentView('chat');
  };

  const openRoom = (room) => {
    pushNav('room-chat');
    setSelectedRoom(room);
    setCurrentView('room-chat');
  };

  const goBack = () => {
    setCurrentView('users');
    setSelectedUser(null);
    setSelectedRoom(null);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'users':
        return (
          <UserList
            onSelectUser={openChat}
            filters={filters}
            onlineUsers={onlineUsers}
            unreadCounts={unreadCounts}
            setUnreadCounts={setUnreadCounts}
          />
        );
      case 'rooms':
        return <RoomList onSelectRoom={openRoom} />;
      case 'profile':
        return <ProfileView />;
      case 'chat':
        return selectedUser && (
          <ChatView
            otherUser={selectedUser}
            messages={messages}
            setMessages={setMessages}
            sendMessage={sendMessage}
            onBack={goBack}
            onlineUsers={onlineUsers}
          />
        );
      case 'room-chat':
        return selectedRoom && (
          <RoomChat
            room={selectedRoom}
            messages={messages}
            setMessages={setMessages}
            sendMessage={sendMessage}
            onBack={goBack}
          />
        );
      default:
        return <UserList onSelectUser={openChat} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#020617] overflow-hidden">

      <Suspense fallback={<Loader />}>
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          connected={connected}
          currentView={currentView}
          onBack={goBack}
          selectedUser={selectedUser}
          selectedRoom={selectedRoom}
        />
      </Suspense>

      <Suspense fallback={<Loader />}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentView={currentView}
          onNavigate={setCurrentView}
          filters={filters}
          setFilters={setFilters}
        />
      </Suspense>

      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<Loader />}>
          {renderContent()}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {sessionExpired && <SessionTimeout />}
      </Suspense>
    </div>
  );
}
