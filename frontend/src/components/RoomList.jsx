import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { FiPlus, FiUsers, FiHash } from 'react-icons/fi';
import { toast } from 'sonner';

export default function RoomList({ onSelectRoom }) {
  const { axiosAuth } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await axiosAuth().get('/rooms');
      setRooms(res.data.rooms);
    } catch (e) {
      console.error('Failed to fetch rooms:', e);
    }
    setLoading(false);
  };

  const createRoom = async () => {
    if (!newRoom.name.trim()) {
      toast.error('Room name required');
      return;
    }
    try {
      const res = await axiosAuth().post('/rooms', newRoom);
      setRooms(prev => [...prev, res.data.room]);
      setShowCreate(false);
      setNewRoom({ name: '', description: '' });
      toast.success('Room created!');
    } catch (e) {
      toast.error('Failed to create room');
    }
  };

  const handleJoinAndOpen = async (room) => {
    try {
      await axiosAuth().post(`/rooms/${room.id}/join`);
    } catch (e) { /* already joined */ }
    onSelectRoom(room);
  };

  const gradients = [
    'from-violet-600/20 to-purple-600/20 border-violet-500/20',
    'from-cyan-600/20 to-blue-600/20 border-cyan-500/20',
    'from-emerald-600/20 to-teal-600/20 border-emerald-500/20',
    'from-rose-600/20 to-pink-600/20 border-rose-500/20',
    'from-amber-600/20 to-orange-600/20 border-amber-500/20',
  ];

  return (
    <div className="h-full flex flex-col" data-testid="room-list">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Chat Rooms</h2>
        <Button
          data-testid="create-room-btn"
          onClick={() => setShowCreate(true)}
          className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm"
        >
          <FiPlus className="w-4 h-4 mr-1" /> New Room
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-3">

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No rooms yet</p>
              <p className="text-slate-600 text-xs mt-1">Create the first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rooms.map((room, idx) => (
                <button
                  key={room.id}
                  data-testid={`room-item-${room.id}`}
                  onClick={() => handleJoinAndOpen(room)}
                  className={`p-4 rounded-2xl bg-gradient-to-br ${gradients[idx % gradients.length]} border text-left hover:scale-[1.02] transition-all active:scale-[0.98] fade-in`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <FiHash className="w-5 h-5 text-white/60" />
                    </div>
                    {room.is_predefined && (
                      <Badge variant="secondary" className="text-[10px] bg-white/10 text-slate-300 border-0">Official</Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{room.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{room.description || 'No description'}</p>
                  <div className="flex items-center gap-1 mt-2 text-slate-500">
                    <FiUsers className="w-3 h-3" />
                    <span className="text-[10px]">{room.members?.length || 0} members</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Room Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0f172a] border-white/10 rounded-2xl max-w-sm" data-testid="create-room-dialog">
          <DialogHeader>
            <DialogTitle className="text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>Create a Room</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">Start a new chat room for your community</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              data-testid="room-name-input"
              placeholder="Room name"
              value={newRoom.name}
              onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
              className="bg-white/5 border-white/10 rounded-xl h-11 text-white placeholder:text-slate-500"
            />
            <Input
              data-testid="room-description-input"
              placeholder="Description (optional)"
              value={newRoom.description}
              onChange={(e) => setNewRoom(prev => ({ ...prev, description: e.target.value }))}
              className="bg-white/5 border-white/10 rounded-xl h-11 text-white placeholder:text-slate-500"
            />
            <Button
              data-testid="create-room-submit"
              onClick={createRoom}
              className="w-full h-11 rounded-full bg-violet-600 hover:bg-violet-500 font-semibold"
            >
              Create Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
