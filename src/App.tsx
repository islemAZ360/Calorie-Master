import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Scale, History as HistoryIcon, Camera, LogIn, User, Flame, Home as HomeIcon } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import Calculator from './pages/Calculator';
import Home from './pages/Home';
import Login from './pages/Login';
import History from './pages/History';
import Scanner from './pages/Scanner';
import Profile from './pages/Profile';
import { Toaster } from 'react-hot-toast';

function NavLink({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-4 py-2 text-sm rounded-full transition-all duration-200 font-medium flex items-center gap-2 ${
        isActive
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-slate-300 hover:text-white hover:bg-white/10'
      } ${className}`}
    >
      {children}
    </Link>
  );
}

function NavBar() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  
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
      
      <nav className="flex items-center gap-1.5 sm:gap-2 bg-white/5 p-1.5 rounded-full border border-white/10">
        <NavLink to="/">
          <HomeIcon size={16} /> <span className="hidden sm:inline">{settings.language === 'ar' ? 'الرئيسية' : 'Home'}</span>
        </NavLink>
        <NavLink to="/calculator">
          {t('nav.autocalc')}
        </NavLink>
        <NavLink to="/scanner">
          <Camera size={16}/> <span className="hidden sm:inline">{t('nav.scanner')}</span>
        </NavLink>
        {user ? (
          <>
            {settings.streak && settings.streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full font-bold text-sm shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                <Flame size={16} className="fill-orange-500 text-orange-500" />
                <span>{settings.streak}</span>
              </div>
            )}
            <NavLink to="/history">
              <HistoryIcon size={16}/> <span className="hidden sm:inline">{t('nav.history')}</span>
            </NavLink>
            <NavLink to="/profile">
              <User size={16}/> <span className="hidden sm:inline">{t('nav.profile')}</span>
            </NavLink>
          </>
        ) : (
          <Link to="/login" className="px-4 py-2 text-sm text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-full transition-all duration-300 font-bold ml-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:scale-105">{t('nav.login')}</Link>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 px-6 py-6 border-t border-white/5 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-500/50" />
          <span>Calorie Master &copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Powered by Gemini AI</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
          <span>Built with React & Firebase</span>
        </div>
      </div>
    </footer>
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

            <Toaster 
              position="top-center" 
              containerStyle={{ zIndex: 99999 }}
              toastOptions={{ 
                style: { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } 
              }} 
            />

            <NavBar />
            
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/login" element={<Login />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
            
            <Footer />
          </div>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
