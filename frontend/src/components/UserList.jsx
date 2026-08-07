import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { Input } from '../components/ui/input';

export default function UserList({ onSelectUser, filters, onlineUsers, unreadCounts, setUnreadCounts }) {
  const { axiosAuth } = useAuth();
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, [filters]);

  const fetchUsers = async () => {
    try {
      const params = {};
      if (filters.gender) params.gender = filters.gender;
      if (filters.place) params.place = filters.place;
      if (filters.country) params.country = filters.country;
      if (filters.online_only) params.online_only = true;
      const res = await axiosAuth().get('/users', { params });
      setUsers(res.data.users);
      setTotalCount(res.data.total_count || res.data.users.length);
      // Sync server unread counts (only overwrite if we don't have local WS-tracked ones)
      if (setUnreadCounts) {
        setUnreadCounts(prev => {
          const merged = { ...prev };
          res.data.users.forEach(u => {
            if (u.unread_count > 0 && !(u.id in merged)) {
              merged[u.id] = u.unread_count;
            }
          });
          return merged;
        });
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
    setLoading(false);
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.place?.toLowerCase().includes(search.toLowerCase())
  );

  // Merge online status from WebSocket
  const enriched = filtered.map(u => ({
    ...u,
    is_online: onlineUsers[u.id] !== undefined ? onlineUsers[u.id] : u.is_online,
    unread: (unreadCounts?.[u.id] || 0) + (u.unread_count || 0)
  }));

  // Deduplicate unread: use max of local WS count and server count
  const withUnread = enriched.map(u => ({
    ...u,
    unread: Math.max(unreadCounts?.[u.id] || 0, u.unread_count || 0)
  }));

  // Sort: unread first (by count desc), then new users (created_at desc), then old
  const sorted = [...withUnread].sort((a, b) => {
    // 1. Unread first
    if (a.unread > 0 && b.unread === 0) return -1;
    if (a.unread === 0 && b.unread > 0) return 1;
    if (a.unread > 0 && b.unread > 0) return b.unread - a.unread;
    // 2. New users first (most recently created)
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });

  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const colors = ['bg-violet-600/30 text-violet-300', 'bg-cyan-600/30 text-cyan-300', 'bg-emerald-600/30 text-emerald-300', 'bg-rose-600/30 text-rose-300', 'bg-amber-600/30 text-amber-300'];

  return (
    <div className="h-full flex flex-col" data-testid="user-list">
      {/* Header with total count */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Users</h2>
        <div className="flex items-center gap-1.5 text-slate-400" data-testid="total-users-count">
          <FiUsers className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{totalCount} total</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <Input
            data-testid="user-search"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 rounded-xl h-10 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>


      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-1">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/10 rounded w-24" />
                    <div className="h-2 bg-white/5 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No users found</p>
              <p className="text-slate-600 text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            sorted.map((u, idx) => (
              <button
                key={u.id}
                data-testid={`user-item-${u.id}`}
                onClick={() => onSelectUser(u)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-[0.98] text-left fade-in ${
                  u.unread > 0 ? 'bg-violet-600/5 hover:bg-violet-600/10 border border-violet-500/10' : 'hover:bg-white/5'
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${colors[idx % colors.length]}`}>
                    {getInitials(u.name)}
                  </div>
                  {u.is_online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#020617] online-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${u.unread > 0 ? 'text-white' : 'text-slate-200'}`}>{u.name}</p>
                    {u.is_guest && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-cyan-500/20 text-cyan-400 border-0 flex-shrink-0">Ghost</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{u.place}{u.country ? `, ${u.country}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {u.unread > 0 ? (
                    <div
                      className="min-w-[20px] h-5 px-1.5 rounded-full bg-violet-600 flex items-center justify-center"
                      data-testid={`unread-badge-${u.id}`}
                    >
                      <span className="text-[10px] font-bold text-white">{u.unread > 99 ? '99+' : u.unread}</span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-slate-500 border-white/10 capitalize">
                      {u.gender}
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
