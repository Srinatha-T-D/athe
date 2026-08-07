import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { FiRefreshCw, FiLogOut } from 'react-icons/fi';

export default function SessionTimeout() {
  const { reconnect, logout } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" data-testid="session-timeout-modal">
      <div className="glass rounded-3xl p-8 max-w-sm w-full text-center fade-in" data-testid="session-timeout-card">
        <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center mx-auto mb-4">
          <FiRefreshCw className="w-7 h-7 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
          You've been quiet
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Your session timed out after 5 minutes of inactivity. Reconnect to continue chatting.
        </p>
        <div className="space-y-3">
          <Button
            data-testid="reconnect-btn"
            onClick={reconnect}
            className="w-full h-12 rounded-full bg-violet-600 hover:bg-violet-500 font-semibold neon-glow"
          >
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Reconnect
          </Button>
          <Button
            data-testid="session-logout-btn"
            onClick={logout}
            variant="ghost"
            className="w-full h-12 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-400/10"
          >
            <FiLogOut className="w-4 h-4 mr-2" />
            Logout Instead
          </Button>
        </div>
      </div>
    </div>
  );
}
