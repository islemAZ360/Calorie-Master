import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { LogIn, UserPlus, Loader2, Mail, Lock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

function getFirebaseErrorMessage(code: string, lang: string): string {
  const messages: Record<string, Record<string, string>> = {
    'auth/invalid-email': { en: 'Invalid email address.', ar: 'عنوان البريد الإلكتروني غير صالح.' },
    'auth/user-disabled': { en: 'This account has been disabled.', ar: 'تم تعطيل هذا الحساب.' },
    'auth/user-not-found': { en: 'No account found with this email.', ar: 'لا يوجد حساب بهذا البريد.' },
    'auth/wrong-password': { en: 'Incorrect password.', ar: 'كلمة المرور غير صحيحة.' },
    'auth/invalid-credential': { en: 'Invalid email or password.', ar: 'البريد أو كلمة المرور غير صحيحة.' },
    'auth/email-already-in-use': { en: 'This email is already registered.', ar: 'هذا البريد مسجل بالفعل.' },
    'auth/weak-password': { en: 'Password must be at least 6 characters.', ar: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.' },
    'auth/too-many-requests': { en: 'Too many attempts. Try again later.', ar: 'محاولات كثيرة. حاول لاحقاً.' },
  };
  return messages[code]?.[lang] || (lang === 'ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'An error occurred. Try again.');
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
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); navigate('/'); }
      else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        try { await setDoc(doc(db, 'users', cred.user.uid), { email: cred.user.email, createdAt: Date.now() }); }
        catch(err) { handleFirestoreError(err, OperationType.CREATE, `users/${cred.user.uid}`); }
        navigate('/');
      }
    } catch(err: any) { setError(getFirebaseErrorMessage(err.code || '', settings.language)); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] animate-mesh"></div>
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px] animate-mesh" style={{animationDelay:'-10s'}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-violet-500/10 rounded-full blur-[80px] animate-blob"></div>
        {/* Rotating ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/[0.03] rounded-full animate-rotate-slow"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/[0.02] rounded-full animate-rotate-slow" style={{animationDirection:'reverse',animationDuration:'45s'}}></div>
      </div>

      <motion.div initial={{opacity:0,y:40,scale:0.95}} animate={{opacity:1,y:0,scale:1}} transition={{duration:0.6}}
        className="w-full max-w-md relative z-10"
      >
        {/* Card with gradient border effect */}
        <div className="relative rounded-3xl">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-emerald-500/30 via-transparent to-cyan-500/20 rounded-3xl blur-[1px]"></div>
          <div className="relative glass-card rounded-3xl p-8 md:p-10">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <motion.div initial={{scale:0,rotate:-180}} animate={{scale:1,rotate:0}} transition={{type:'spring',stiffness:200,damping:15,delay:0.3}}
                className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              >
                {isLogin ? <LogIn size={28} className="text-white" /> : <UserPlus size={28} className="text-white" />}
              </motion.div>
            </div>

            <h2 className="text-2xl font-black text-white mb-1 text-center">{isLogin ? t('login.title.login') : t('login.title.signup')}</h2>
            <p className="text-slate-400 text-sm text-center mb-8">
              {isLogin ? (settings.language==='ar'?'سجل دخولك للمتابعة':'Sign in to continue') : (settings.language==='ar'?'أنشئ حساباً لتبدأ':'Create an account to start')}
            </p>

            {error && (
              <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-6 text-center"
              >{error}</motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('login.label.email')}</label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_20px_rgba(16,185,129,0.1)] text-white transition-all placeholder:text-slate-600"
                    placeholder={settings.language==='ar'?'أدخل بريدك':'Enter your email'} required />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('login.label.password')}</label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] focus:shadow-[0_0_20px_rgba(16,185,129,0.1)] text-white transition-all placeholder:text-slate-600"
                    placeholder={settings.language==='ar'?'أدخل كلمة المرور':'Enter your password'} required />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full relative overflow-hidden group py-4 rounded-2xl font-bold text-lg disabled:opacity-50 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] mt-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-gradient"></div>
                <span className="relative z-10 flex items-center justify-center gap-2 text-zinc-950">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
                  {isLogin ? t('login.action.login') : t('login.action.signup')}
                </span>
              </button>
            </form>

            <div className="mt-6 text-center">
              <button type="button" onClick={() => {setIsLogin(!isLogin);setError('');}} className="text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                {isLogin ? t('login.toggle.toSignup') : t('login.toggle.toLogin')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
