import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';
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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex-1 flex items-center justify-center p-6 relative z-10"
    >
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            {isLogin ? <LogIn size={32} className="text-emerald-500" /> : <UserPlus size={32} className="text-emerald-500" />}
          </div>
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-6"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('login.label.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('login.label.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold py-4 rounded-2xl shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-6 outline-none"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)}
            <span>{isLogin ? t('login.action.login') : t('login.action.signup')}</span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isLogin ? t('login.toggle.toSignup') : t('login.toggle.toLogin')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
