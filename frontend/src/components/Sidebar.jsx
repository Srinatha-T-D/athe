import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FiUsers, FiMessageCircle, FiUser, FiLogOut, FiFilter, FiGlobe, FiMapPin } from 'react-icons/fi';
import { Badge } from '../components/ui/badge';

export default function Sidebar({ open, onClose, currentView, onNavigate, filters, setFilters }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'users', label: 'Users', icon: FiUsers },
    { id: 'rooms', label: 'Chat Rooms', icon: FiMessageCircle },
    { id: 'profile', label: 'Profile', icon: FiUser },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="bg-[#020617]/95 backdrop-blur-xl border-r border-white/5 w-[300px] p-0 flex flex-col" data-testid="sidebar">
        <SheetHeader className="p-6 pb-4 border-b border-white/5">
          <SheetTitle className="text-2xl font-extrabold tracking-widest text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            ATHE
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-400 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600/30 flex items-center justify-center text-xs font-bold text-violet-300">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="truncate">{user?.name}</span>
            {user?.is_guest && <Badge variant="secondary" className="text-xs bg-cyan-500/20 text-cyan-400 border-0">Ghost</Badge>}
          </SheetDescription>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1" data-testid="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                currentView === item.id
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}

          {/* Filters */}
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="filters" className="border-white/5">
              <AccordionTrigger className="px-4 py-3 text-sm text-slate-400 hover:text-white hover:no-underline" data-testid="filters-trigger">
                <span className="flex items-center gap-3">
                  <FiFilter className="w-4 h-4" />
                  Filters
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Gender</label>
                  <Select value={filters.gender} onValueChange={(v) => setFilters(prev => ({ ...prev, gender: v === 'all' ? '' : v }))}>
                    <SelectTrigger data-testid="filter-gender" className="bg-white/5 border-white/10 rounded-lg h-9 text-sm text-white">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Place</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
                    <Input
                      data-testid="filter-place"
                      placeholder="Any place"
                      value={filters.place}
                      onChange={(e) => setFilters(prev => ({ ...prev, place: e.target.value }))}
                      className="pl-8 bg-white/5 border-white/10 rounded-lg h-9 text-sm text-white placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Country</label>
                  <div className="relative">
                    <FiGlobe className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
                    <Input
                      data-testid="filter-country"
                      placeholder="Any country"
                      value={filters.country}
                      onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                      className="pl-8 bg-white/5 border-white/10 rounded-lg h-9 text-sm text-white placeholder:text-slate-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <label className="text-xs text-slate-500">Online only</label>
                  <Switch
                    data-testid="filter-online"
                    checked={filters.online_only}
                    onCheckedChange={(v) => setFilters(prev => ({ ...prev, online_only: v }))}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <button
            data-testid="logout-button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors active:scale-[0.98]"
          >
            <FiLogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
