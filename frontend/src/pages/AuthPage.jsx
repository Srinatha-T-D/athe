import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FiUser, FiMail, FiLock, FiMapPin, FiGlobe } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'sonner';
import { getBackendUrl } from '../lib/config';

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

export default function AuthPage() {
  const { login } = useAuth();
  const [isGuest, setIsGuest] = useState(true);
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', name: '', place: '', gender: '', country: ''
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isGuest) {
        if (!form.name || !form.place || !form.gender || !form.country) {
          toast.error('Please fill all fields');
          setLoading(false);
          return;
        }
        const res = await axios.post(`${API}/auth/guest`, {
          name: form.name, place: form.place, gender: form.gender, country: form.country
        });
        login(res.data.user, res.data.token);
        toast.success('Welcome, Ghost!');
      } else if (isLogin) {
        if (!form.email || !form.password) {
          toast.error('Email and password required');
          setLoading(false);
          return;
        }
        const res = await axios.post(`${API}/auth/login`, {
          email: form.email, password: form.password
        });
        login(res.data.user, res.data.token);
        toast.success(`Welcome back, ${res.data.user.name}!`);
      } else {
        if (!form.email || !form.password || !form.name || !form.place || !form.gender || !form.country) {
          toast.error('Please fill all fields');
          setLoading(false);
          return;
        }
        const res = await axios.post(`${API}/auth/register`, {
          email: form.email, password: form.password,
          name: form.name, place: form.place, gender: form.gender, country: form.country
        });
        login(res.data.user, res.data.token);
        toast.success('Account created! Welcome to Athe.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" data-testid="auth-page">
      {/* Background */}
      <div className="absolute inset-0 bg-[#020617]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.1),transparent_50%)]" />
      </div>

      <div className="w-full max-w-md relative z-10 fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-widest text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            ATHE
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Connect. Chat. Chill.</p>
        </div>

        {/* Auth Card */}
        <div className="glass rounded-3xl p-6 md:p-8" data-testid="auth-card">
          {/* Guest/Login Toggle */}
          <div className="flex items-center justify-between mb-6 p-3 rounded-2xl bg-white/5">
            <span className={`text-sm font-medium transition-colors ${isGuest ? 'text-cyan-400' : 'text-slate-400'}`}>
              Go Ghost
            </span>
            <Switch
              data-testid="guest-toggle"
              checked={!isGuest}
              onCheckedChange={(checked) => {
                setIsGuest(!checked);
                setIsLogin(false);
              }}
              className="data-[state=checked]:bg-violet-600 data-[state=unchecked]:bg-cyan-600"
            />
            <span className={`text-sm font-medium transition-colors ${!isGuest ? 'text-violet-400' : 'text-slate-400'}`}>
              Login
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email/Password for non-guest */}
            {!isGuest && (
              <>
                {!isLogin && (
                  <p className="text-xs text-slate-400 text-center">Create an account</p>
                )}
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input
                    data-testid="email-input"
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 rounded-xl h-12 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input
                    data-testid="password-input"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 rounded-xl h-12 text-white placeholder:text-slate-500"
                  />
                </div>
              </>
            )}

            {/* Profile fields - show for guest and register */}
            {(isGuest || !isLogin) && (
              <>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input
                    data-testid="name-input"
                    placeholder="Your Name"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 rounded-xl h-12 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <Input
                      data-testid="place-input"
                      placeholder="City/Place"
                      value={form.place}
                      onChange={(e) => handleChange('place', e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 rounded-xl h-12 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="relative">
                    <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <Input
                      data-testid="country-input"
                      placeholder="Country"
                      value={form.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 rounded-xl h-12 text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <Select value={form.gender} onValueChange={(v) => handleChange('gender', v)}>
                  <SelectTrigger data-testid="gender-select" className="bg-white/5 border-white/10 focus:border-violet-500 rounded-xl h-12 text-white">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

            <Button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-all hover:scale-[1.02] active:scale-[0.98] neon-glow"
            >
              {loading ? 'Loading...' : isGuest ? 'Enter as Ghost' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Toggle login/register */}
          {!isGuest && (
            <button
              data-testid="toggle-login-register"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-sm text-slate-400 hover:text-violet-400 mt-4 transition-colors"
            >
              {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign In'}
            </button>
          )}
        </div>


        <p className="text-center text-xs text-slate-600 mt-6">athe.co.in</p>
      </div>
    </div>
  );
}
