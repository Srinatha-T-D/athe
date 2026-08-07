import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FiMenu, FiArrowLeft, FiWifi, FiWifiOff } from 'react-icons/fi';

export default function TopBar({ onMenuClick, connected, currentView, onBack, selectedUser, selectedRoom }) {
  const { user } = useAuth();
  const showBack = currentView === 'chat' || currentView === 'room-chat';

  const getTitle = () => {
    if (currentView === 'chat' && selectedUser) return selectedUser.name;
    if (currentView === 'room-chat' && selectedRoom) return selectedRoom.name;
    if (currentView === 'rooms') return 'Chat Rooms';
    if (currentView === 'profile') return 'Profile';
    return null;
  };

  const subtitle = getTitle();

  return (
    <header className="glass sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-white/5" data-testid="top-bar">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            data-testid="back-button"
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
        ) : (
          <button
            data-testid="menu-button"
            onClick={onMenuClick}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors active:scale-95"
          >
            <FiMenu className="w-5 h-5 text-slate-300" />
          </button>
        )}

        {subtitle ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center text-sm font-semibold text-violet-300">
              {subtitle.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{subtitle}</p>
              {currentView === 'chat' && selectedUser && (
                <p className="text-xs text-slate-400">
                  {selectedUser.is_online ? 'Online' : 'Offline'} · {selectedUser.place}
                </p>
              )}
            </div>
          </div>
        ) : (
          <h1 className="text-xl font-extrabold tracking-widest text-white" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="logo-text">
            ATHE
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${connected ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`} data-testid="connection-status">
          {connected ? <FiWifi className="w-3 h-3" /> : <FiWifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{connected ? 'Live' : 'Offline'}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center text-sm font-semibold text-violet-300" data-testid="user-avatar-topbar">
          {user?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      </div>
    </header>
  );
}
