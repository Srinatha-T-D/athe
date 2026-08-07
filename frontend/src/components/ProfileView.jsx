import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FiUser, FiMapPin, FiGlobe, FiSave } from 'react-icons/fi';
import { toast } from 'sonner';

export default function ProfileView() {
  const { user, axiosAuth, login, token } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    place: user?.place || '',
    gender: user?.gender || '',
    country: user?.country || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axiosAuth().put('/auth/profile', form);
      login(res.data.user, token);
      toast.success('Profile updated!');
    } catch (e) {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  return (
    <div className="h-full overflow-y-auto" data-testid="profile-view">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-violet-600/30 flex items-center justify-center text-3xl font-bold text-violet-300">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{user?.name}</p>
            <div className="flex items-center gap-2 justify-center mt-1">
              {user?.is_guest ? (
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Ghost User</Badge>
              ) : (
                <Badge className="bg-violet-500/20 text-violet-400 border-0">Registered</Badge>
              )}
              <Badge variant="outline" className="text-slate-500 border-white/10 capitalize">{user?.gender}</Badge>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-4 glass rounded-2xl p-6">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <Input
                data-testid="profile-name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="pl-10 bg-white/5 border-white/10 rounded-xl h-11 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Place</label>
              <div className="relative">
                <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <Input
                  data-testid="profile-place"
                  value={form.place}
                  onChange={(e) => setForm(prev => ({ ...prev, place: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/10 rounded-xl h-11 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Country</label>
              <div className="relative">
                <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <Input
                  data-testid="profile-country"
                  value={form.country}
                  onChange={(e) => setForm(prev => ({ ...prev, country: e.target.value }))}
                  className="pl-10 bg-white/5 border-white/10 rounded-xl h-11 text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Gender</label>
            <Select value={form.gender} onValueChange={(v) => setForm(prev => ({ ...prev, gender: v }))}>
              <SelectTrigger data-testid="profile-gender" className="bg-white/5 border-white/10 rounded-xl h-11 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10">
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            data-testid="profile-save-btn"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-full bg-violet-600 hover:bg-violet-500 font-semibold"
          >
            <FiSave className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Info */}
        <div className="text-center">
          <p className="text-xs text-slate-600">
            {user?.email ? `Email: ${user.email}` : 'Guest accounts are temporary'}
          </p>
          <p className="text-xs text-slate-700 mt-1">
            Member since {new Date(user?.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
