import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Scale, History as HistoryIcon, Camera, LogIn, User } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import Calculator from './pages/Calculator';
import Login from './pages/Login';
import History from './pages/History';
import Scanner from './pages/Scanner';
import Profile from './pages/Profile';

function NavBar() {
  const { user } = useAuth();
  const { t } = useSettings();
  
  return (
    <header className="relative z-10 px-6 md:px-12 py-4 flex flex-col sm:flex-row justify-between items-center border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm gap-4">
      <Link to="/" className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 group">
        <span className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center group-hover:bg-emerald-400 transition-colors">
          <Scale className="h-6 w-6 text-zinc-950" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent group-hover:from-emerald-300 group-hover:to-teal-400 transition-all duration-300">Calorie Master</h1>
          <p className="text-slate-400 text-[10px] sm:text-xs">{t('app.tagline')}</p>
        </div>
      </Link>
      
      <nav className="flex items-center gap-2 sm:gap-6 bg-white/5 p-1.5 rounded-full border border-white/10">
        <Link to="/" className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors font-medium">{t('nav.autocalc')}</Link>
        <Link to="/scanner" className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors font-medium flex items-center gap-2"><Camera size={16}/> {t('nav.scanner')}</Link>
        {user ? (
          <>
            <Link to="/history" className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors font-medium flex items-center gap-2"><HistoryIcon size={16}/> {t('nav.history')}</Link>
            <Link to="/profile" className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors font-medium flex items-center gap-2"><User size={16}/> {t('nav.profile')}</Link>
          </>
        ) : (
          <Link to="/login" className="px-4 py-2 text-sm text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-full transition-all duration-300 font-bold ml-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:scale-105">{t('nav.login')}</Link>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-zinc-950 text-slate-200 font-sans relative overflow-x-hidden flex flex-col">
            {/* Background Ambient Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_60%)] -translate-y-1/2 translate-x-1/3 pointer-events-none transform-gpu"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0%,transparent_60%)] translate-y-1/3 -translate-x-1/4 pointer-events-none transform-gpu"></div>

            <NavBar />
            
            <Routes>
              <Route path="/" element={<Calculator />} />
              <Route path="/login" element={<Login />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
