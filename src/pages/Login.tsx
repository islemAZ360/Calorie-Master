import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { LogIn, UserPlus, Loader2, Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

function getFirebaseErrorMessage(code: string, lang: string): string {
  const messages: Record<string, Record<string, string>> = {
    'auth/invalid-email': {
      en: 'Invalid email address.',
      ar: 'عنوان البريد الإلكتروني غير صالح.'
    },
    'auth/user-disabled': {
      en: 'This account has been disabled.',
      ar: 'تم تعطيل هذا الحساب.'
    },
    'auth/user-not-found': {
      en: 'No account found with this email.',
      ar: 'لا يوجد حساب بهذا البريد الإلكتروني.'
    },
    'auth/wrong-password': {
      en: 'Incorrect password.',
      ar: 'كلمة المرور غير صحيحة.'
    },
    'auth/invalid-credential': {
      en: 'Invalid email or password.',
      ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
    },
    'auth/email-already-in-use': {
      en: 'This email is already registered.',
      ar: 'هذا البريد الإلكتروني مسجل بالفعل.'
    },
    'auth/weak-password': {
      en: 'Password must be at least 6 characters.',
      ar: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'
    },
    'auth/too-many-requests': {
      en: 'Too many attempts. Please try again later.',
      ar: 'محاولات كثيرة جداً. حاول مرة أخرى لاحقاً.'
    },
  };
  return messages[code]?.[lang] || (lang === 'ar' ? 'حدث خطأ غير متوقع. حاول مرة أخرى.' : 'An unexpected error occurred. Please try again.');
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const { t, settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: userCredential.user.email,
            createdAt: Date.now()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${userCredential.user.uid}`);
        }
        navigate('/');
      }
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err.code || '', settings.language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex-1 flex items-center justify-center p-6 relative z-10 overflow-hidden"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/[0.04] rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-500/[0.04] rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/[0.03] rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-2xl relative"
      >
        {/* Subtle top glow */}
        <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>

        <div className="flex justify-center mb-6">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
            className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10"
          >
            {isLogin ? <LogIn size={32} className="text-emerald-400" /> : <UserPlus size={32} className="text-emerald-400" />}
          </motion.div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          {isLogin ? t('login.title.login') : t('login.title.signup')}
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          {isLogin 
            ? (settings.language === 'ar' ? 'سجل دخولك للمتابعة' : 'Sign in to continue tracking')
            : (settings.language === 'ar' ? 'أنشئ حساباً جديداً لتبدأ رحلتك' : 'Create an account to start your journey')
          }
        </p>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-6"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('login.label.email')}</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 text-white transition-all shadow-inner"
                placeholder={settings.language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('login.label.password')}</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900/80 border border-white/10 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 text-white transition-all shadow-inner"
                placeholder={settings.language === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-zinc-950 font-bold py-4 rounded-2xl shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-6 outline-none"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)}
            <span>{isLogin ? t('login.action.login') : t('login.action.signup')}</span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isLogin ? t('login.toggle.toSignup') : t('login.toggle.toLogin')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
