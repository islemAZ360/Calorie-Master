import React, { Component, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Scale, History as HistoryIcon, Camera, User, Flame, Home as HomeIcon, Calculator as CalcIcon, AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import CalculatorPage from './pages/Calculator';
import Home from './pages/Home';
import Login from './pages/Login';
import History from './pages/History';
import Scanner from './pages/Scanner';
import Profile from './pages/Profile';
import { Toaster } from 'react-hot-toast';

/* ─────────────── Error Boundary ─────────────── */
interface ErrorBoundaryState { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
          <div className="glass-strong rounded-3xl p-10 max-w-md text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-6 py-3 rounded-xl transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────── Scroll to Top on Route Change ─────────────── */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return null;
}

/* ─────────────── Desktop Nav Link ─────────────── */
function NavLink({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 text-sm rounded-full transition-all duration-200 font-medium flex items-center gap-1.5 ${
        isActive
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
          : 'text-slate-400 hover:text-white hover:bg-white/10'
      } ${className}`}
    >
      {children}
    </Link>
  );
}

/* ─────────────── Desktop Navbar ─────────────── */
function NavBar() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  
  return (
    <header className="relative z-50">
      <div className="px-4 md:px-8 lg:px-12 py-3 flex justify-between items-center bg-zinc-950/80 backdrop-blur-2xl">
      <Link to="/" className="flex items-center gap-2.5 group">
        <span className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/25">
          <Scale className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent"
          >Calorie Master</h1>
          <p className="text-slate-500 text-[10px] leading-none hidden sm:block">{t('app.tagline')}</p>
        </div>
      </Link>
      
      {/* Desktop nav — hidden on mobile, shown via bottom tab bar instead */}
      <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.06]">
        <NavLink to="/">
          <HomeIcon size={15} /> <span>{settings.language === 'ar' ? 'الرئيسية' : 'Home'}</span>
        </NavLink>
        <NavLink to="/calculator">
          <CalcIcon size={15} /> <span>{t('nav.autocalc')}</span>
        </NavLink>
        <NavLink to="/scanner">
          <Camera size={15}/> <span>{t('nav.scanner')}</span>
        </NavLink>
        {user ? (
          <>
            {settings.streak && settings.streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full font-bold text-xs shadow-[0_0_10px_rgba(249,115,22,0.15)]">
                <Flame size={14} className="fill-orange-500 text-orange-500" />
                <span>{settings.streak}</span>
              </div>
            )}
            <NavLink to="/history">
              <HistoryIcon size={15}/> <span>{t('nav.history')}</span>
            </NavLink>
            <NavLink to="/profile">
              <User size={15}/> <span>{t('nav.profile')}</span>
            </NavLink>
          </>
        ) : (
          <Link to="/login" className="relative px-5 py-2 text-sm rounded-full font-bold ml-1 overflow-hidden hover:scale-105 transition-all hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-gradient"></div>
            <span className="relative z-10 text-zinc-950">{t('nav.login')}</span>
          </Link>
        )}
      </nav>

      {/* Mobile: just show streak + login on top bar */}
      <div className="flex md:hidden items-center gap-2">
        {user && settings.streak && settings.streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full font-bold text-xs">
            <Flame size={12} className="fill-orange-500 text-orange-500" />
            <span>{settings.streak}</span>
          </div>
        )}
        {!user && (
          <Link to="/login" className="relative px-3 py-1.5 text-xs rounded-full font-bold overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
            <span className="relative z-10 text-zinc-950">{t('nav.login')}</span>
          </Link>
        )}
      </div>
      </div>
      {/* Gradient line under navbar */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
    </header>
  );
}

/* ─────────────── Mobile Bottom Tab Bar ─────────────── */
function MobileTabBar() {
  const { user } = useAuth();
  const location = useLocation();
  const { settings, t } = useSettings();

  const tabs = [
    { to: '/', icon: HomeIcon, label: settings.language === 'ar' ? 'الرئيسية' : 'Home' },
    { to: '/calculator', icon: CalcIcon, label: t('nav.autocalc') },
    { to: '/scanner', icon: Camera, label: t('nav.scanner') },
    ...(user
      ? [
          { to: '/history', icon: HistoryIcon, label: t('nav.history') },
          { to: '/profile', icon: User, label: t('nav.profile') },
        ]
      : []),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-white/[0.06] bottom-nav-safe">
      <div className="flex justify-around items-center py-2 px-1">
        {tabs.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 min-w-[56px] ${
                isActive
                  ? 'text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-emerald-500/15' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              </div>
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-bold' : ''}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ─────────────── Footer ─────────────── */
function Footer() {
  return (
    <footer className="relative z-10 mt-auto hidden md:block">
      <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      <div className="px-6 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-emerald-500/40" />
            <span>Calorie Master &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Gemini AI</span>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span>Built with React & Firebase</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── 404 Page ─────────────── */
function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 text-center">
      <div className="glass-strong rounded-3xl p-10 max-w-md">
        <div className="text-7xl font-black bg-gradient-to-br from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4">404</div>
        <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-6 py-3 rounded-xl transition-colors inline-block">
          Go Home
        </Link>
      </div>
    </div>
  );
}

/* ─────────────── App Root ─────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-zinc-950 text-slate-200 font-sans relative overflow-x-hidden flex flex-col pb-16 md:pb-0 noise">
              {/* Background Ambient Glows */}
              <div className="fixed top-0 right-0 w-[700px] h-[700px] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_55%)] -translate-y-1/3 translate-x-1/4 pointer-events-none transform-gpu"></div>
              <div className="fixed bottom-0 left-0 w-[700px] h-[700px] bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.07)_0%,transparent_55%)] translate-y-1/4 -translate-x-1/5 pointer-events-none transform-gpu"></div>
              <div className="fixed top-1/2 left-1/2 w-[900px] h-[900px] bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.05)_0%,transparent_55%)] -translate-x-1/2 -translate-y-1/2 pointer-events-none transform-gpu"></div>

              <Toaster 
                position="top-center" 
                containerStyle={{ zIndex: 99999 }}
                toastOptions={{ 
                  style: { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px' },
                  duration: 3000,
                }} 
              />

              <ScrollToTop />
              <NavBar />
              
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/calculator" element={<CalculatorPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/scanner" element={<Scanner />} />
                <Route path="/history" element={<History />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              <Footer />
              <MobileTabBar />
            </div>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
