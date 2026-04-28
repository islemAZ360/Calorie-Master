import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { logWater, updateStreak } from '../lib/firestoreUtils';
import { Link } from 'react-router-dom';
import { Camera, Droplets, Target, Activity, Zap, Lightbulb, Sparkles, ArrowRight, TrendingUp, Star } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Circle Progress ─── */
interface CircleProgressProps { value: number; max: number; color: string; glowColor: string; size: number; strokeWidth: number; label: string; unit: string; }
function CircleProgress({ value, max, color, glowColor, size, strokeWidth, label, unit }: CircleProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(value / max, 1);
  const offset = circumference - percent * circumference;
  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="transparent" />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: "easeOut" }}
          cx={size/2} cy={size/2} r={radius} stroke={`url(#grad-${label})`} strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
        <defs>
          <linearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={glowColor} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl sm:text-3xl font-black text-white leading-none">{Math.round(value)}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{label}</span>
        <span className="text-[10px] text-slate-500 font-medium">/ {Math.round(max)}{unit}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [todayCarbs, setTodayCarbs] = useState(0);
  const [todayFat, setTodayFat] = useState(0);
  const [loading, setLoading] = useState(true);

  const targetCalories = settings.targetCalories || 2000;
  const targetProtein = Math.round((targetCalories * 0.3) / 4);
  const targetCarbs = Math.round((targetCalories * 0.4) / 4);
  const targetFat = Math.round((targetCalories * 0.3) / 9);

  useEffect(() => {
    const fetchTodayData = async () => {
      if (!user) { setLoading(false); return; }
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      try {
        const q = query(collection(db, 'users', user.uid, 'history'), where('timestamp', '>=', startOfDay.getTime()));
        const snapshot = await getDocs(q);
        let cals=0, pro=0, car=0, fat=0;
        snapshot.forEach(doc => { const d = doc.data(); if(d.type!=='water'){cals+=d.calories||0;} pro+=d.protein||0; car+=d.carbs||0; fat+=d.fat||0; });
        setTodayCalories(cals); setTodayProtein(pro); setTodayCarbs(car); setTodayFat(fat);
      } catch(e) { console.error(e); } finally { setLoading(false); }
    };
    fetchTodayData();
  }, [user]);

  const handleAddWater = async () => {
    if (!user) return;
    try { await logWater(user.uid, settings.language); await updateStreak(user.uid, settings.streak, settings.lastLogDate); toast.success(settings.language === 'ar' ? 'تم تسجيل كوب ماء! 💧' : 'Water logged! +250ml 💧'); }
    catch(e) { console.error(e); toast.error('Failed to log water'); }
  };

  let coachTip = '';
  if (todayCalories === 0) coachTip = settings.language === 'ar' ? 'ابدأ يومك بوجبة صحية!' : 'Start your day with a healthy meal!';
  else if (todayCalories < targetCalories * 0.5) coachTip = settings.language === 'ar' ? 'أنت في الطريق الصحيح، لا تنسى شرب الماء.' : "You're on track. Don't forget to stay hydrated.";
  else if (todayCalories < targetCalories) coachTip = settings.language === 'ar' ? 'أنت قريب جداً من هدفك اليومي!' : "You're very close to your daily target!";
  else coachTip = settings.language === 'ar' ? 'لقد تجاوزت هدفك، ركز على النشاط البدني.' : 'You exceeded your target. Focus on activity.';

  /* ════════════ LANDING PAGE (logged out) ════════════ */
  if (!user) {
    return (
      <div className="flex-1 relative overflow-hidden">
        {/* Animated Mesh Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] animate-mesh"></div>
          <div className="absolute top-1/4 -right-32 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px] animate-mesh" style={{animationDelay:'-7s'}}></div>
          <div className="absolute -bottom-32 left-1/3 w-[450px] h-[450px] bg-violet-500/15 rounded-full blur-[100px] animate-mesh" style={{animationDelay:'-14s'}}></div>
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-rose-500/10 rounded-full blur-[80px] animate-blob"></div>
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize:'60px 60px'}}></div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-60px)] p-6 md:p-8 text-center">
          {/* Badge */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <Sparkles size={14} className="animate-pulse" />
              <span>{settings.language === 'ar' ? 'مدعوم بالذكاء الاصطناعي Gemini' : 'Powered by Gemini AI'}</span>
              <Star size={14} className="fill-emerald-400 text-emerald-400" />
            </div>
          </motion.div>

          {/* Hero Title */}
          <motion.h1 initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay:0.2,duration:0.7}}
            className="text-5xl sm:text-6xl md:text-8xl font-black mb-6 leading-[0.95] tracking-tight"
          >
            <span className="block bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {settings.language === 'ar' ? 'تتبع ذكي' : 'Smart'}
            </span>
            <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300 bg-clip-text text-transparent animate-text-shine bg-[length:200%_auto] text-glow-emerald">
              {settings.language === 'ar' ? 'للسعرات' : 'Calories'}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}}
            className="text-slate-400 max-w-xl mb-12 leading-relaxed text-base md:text-lg"
          >
            {settings.language === 'ar' ? 'صور وجبتك واحصل على تحليل فوري للسعرات والبروتين والكربوهيدرات. كل شيء بضغطة واحدة.' : 'Snap your meal, get instant AI analysis. Track calories, protein, carbs & fat — all in one tap.'}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.6}}
            className="flex flex-col sm:flex-row gap-4 mb-20"
          >
            <Link to="/login" className="group relative px-8 py-4 rounded-2xl font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-gradient"></div>
              <span className="relative z-10 flex items-center gap-2 text-zinc-950">
                {settings.language === 'ar' ? 'ابدأ مجاناً' : 'Get Started Free'} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link to="/calculator" className="px-8 py-4 rounded-2xl font-bold text-lg text-white border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all hover:scale-105 backdrop-blur-sm">
              {settings.language === 'ar' ? 'جرب الحاسبة' : 'Try Calculator'}
            </Link>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl w-full">
            {[
              { icon: Camera, gradient: 'from-emerald-500/20 to-teal-500/10', borderColor: 'border-emerald-500/20', iconColor: 'text-emerald-400', title: settings.language === 'ar' ? 'مسح ذكي بالكاميرا' : 'AI Photo Scanner', desc: settings.language === 'ar' ? 'صور وجبتك واحصل على تحليل فوري دقيق' : 'Snap your meal for instant nutritional analysis', delay: 0.7 },
              { icon: TrendingUp, gradient: 'from-cyan-500/20 to-blue-500/10', borderColor: 'border-cyan-500/20', iconColor: 'text-cyan-400', title: settings.language === 'ar' ? 'تتبع يومي متقدم' : 'Advanced Daily Tracking', desc: settings.language === 'ar' ? 'رسوم بيانية وتقارير ذكية لتقدمك' : 'Charts, reports & smart insights for your goals', delay: 0.8 },
              { icon: Zap, gradient: 'from-violet-500/20 to-purple-500/10', borderColor: 'border-violet-500/20', iconColor: 'text-violet-400', title: settings.language === 'ar' ? 'حاسبة BMR احترافية' : 'Pro BMR Calculator', desc: settings.language === 'ar' ? '3 معادلات علمية لحساب احتياجاتك بدقة' : '3 scientific formulas for precise daily needs', delay: 0.9 },
            ].map(({ icon: Icon, gradient, borderColor, iconColor, title, desc, delay }, i) => (
              <motion.div key={i} initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{delay,duration:0.5}}
                className={`glass-card glow-border rounded-2xl p-6 text-left group hover:translate-y-[-4px] transition-all duration-300 ${borderColor}`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={22} className={iconColor} />
                </div>
                <h3 className="text-white font-bold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Stats Bar */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.2}}
            className="mt-16 flex items-center gap-8 md:gap-12 text-center"
          >
            {[
              { num: '10K+', label: settings.language === 'ar' ? 'وجبة تم تحليلها' : 'Meals Analyzed' },
              { num: '99%', label: settings.language === 'ar' ? 'دقة التحليل' : 'Accuracy Rate' },
              { num: '< 3s', label: settings.language === 'ar' ? 'وقت التحليل' : 'Analysis Time' },
            ].map(({num,label},i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{num}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }

  /* ════════════ DASHBOARD (logged in) ════════════ */
  if (loading) return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8 animate-pulse">
      <div className="skeleton h-10 w-64 rounded-xl"></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="skeleton h-80 rounded-3xl"></div>
        <div className="lg:col-span-2 space-y-6"><div className="skeleton h-48 rounded-3xl"></div><div className="skeleton h-20 rounded-2xl"></div></div>
      </div>
    </div>
  );

  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-white">
            {(() => { const h = new Date().getHours(); if(h<12) return settings.language==='ar'?'صباح الخير ☕':'Good Morning ☕'; if(h<18) return settings.language==='ar'?'مساء الخير ☀️':'Good Afternoon ☀️'; return settings.language==='ar'?'مساء النور 🌙':'Good Evening 🌙'; })()}
          </h2>
          <p className="text-slate-400 mt-1">
            {settings.selectedPlan ? (<>{settings.language==='ar'?'خطتك: ':'Plan: '}<span className="text-emerald-400 font-semibold">{settings.selectedPlan==='maintain'?(settings.language==='ar'?'حفاظ':'Maintain'):settings.selectedPlan==='loss'?(settings.language==='ar'?'خسارة':'Loss'):settings.selectedPlan==='extremeLoss'?(settings.language==='ar'?'خسارة شديدة':'Extreme Loss'):(settings.language==='ar'?'زيادة':'Gain')}</span></>) : (settings.language==='ar'?'تقدمك اليومي':'Your daily progress')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleAddWater} className="hidden sm:flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-full font-bold transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Droplets size={16} /> <span>{settings.language==='ar'?'أضف ماء':'Water'}</span>
          </button>
          {settings.streak && settings.streak > 0 ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-orange-500 uppercase tracking-widest font-bold">{settings.language==='ar'?'السلسلة':'Streak'}</span>
              <div className="text-2xl font-black text-orange-400 flex items-center gap-1">{settings.streak} <Zap size={24} className="fill-orange-500" /></div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calories */}
        <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{delay:0.1}}
          className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center lg:col-span-1 animate-border-glow relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest w-full text-left mb-6">{settings.language==='ar'?'السعرات':'Calories'}</h3>
          <CircleProgress value={todayCalories} max={targetCalories} color="#10b981" glowColor="#06b6d4" size={220} strokeWidth={14} label={settings.language==='ar'?'استهلاك':'Eaten'} unit="kcal" />
          <div className="w-full flex justify-between mt-8 pt-6 border-t border-white/5">
            <div className="flex flex-col"><span className="text-xs text-slate-500">{settings.language==='ar'?'الهدف':'Target'}</span><span className="text-white font-bold">{targetCalories}</span></div>
            <div className="flex flex-col text-right"><span className="text-xs text-slate-500">{settings.language==='ar'?'المتبقي':'Left'}</span><span className="text-emerald-400 font-bold">{Math.max(targetCalories-todayCalories,0)}</span></div>
          </div>
        </motion.div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Macros */}
          <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{delay:0.2}}
            className="glass-card rounded-3xl p-6 flex-1 relative overflow-hidden"
          >
            <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl"></div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">{settings.language==='ar'?'العناصر الغذائية':'Macronutrients'}</h3>
            <div className="flex justify-around items-center h-[140px]">
              <CircleProgress value={todayProtein} max={targetProtein} color="#fb7185" glowColor="#f43f5e" size={100} strokeWidth={8} label="Pro" unit="g" />
              <CircleProgress value={todayCarbs} max={targetCarbs} color="#fbbf24" glowColor="#f59e0b" size={100} strokeWidth={8} label="Carb" unit="g" />
              <CircleProgress value={todayFat} max={targetFat} color="#60a5fa" glowColor="#3b82f6" size={100} strokeWidth={8} label="Fat" unit="g" />
            </div>
          </motion.div>

          {/* Coach Tip */}
          <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.4}}
            className="bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="bg-gradient-to-br from-indigo-500/30 to-violet-500/20 p-3 rounded-full text-indigo-400 shrink-0"><Lightbulb size={24} /></div>
            <div>
              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">{settings.language==='ar'?'نصيحة المدرب':'Coach Tip'}</h4>
              <p className="text-sm text-indigo-100/80 leading-relaxed font-medium">{coachTip}</p>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { to:'/scanner', bg:'from-emerald-500/15 to-teal-500/10', border:'border-emerald-500/20', color:'text-emerald-400', icon:Camera, label:settings.language==='ar'?'مسح وجبة':'Scan' },
              { to:'/history', bg:'from-cyan-500/15 to-blue-500/10', border:'border-cyan-500/20', color:'text-cyan-400', icon:Droplets, label:settings.language==='ar'?'السجل':'History' },
              { to:'/calculator', bg:'from-violet-500/15 to-purple-500/10', border:'border-violet-500/20', color:'text-violet-400', icon:Activity, label:settings.language==='ar'?'الحاسبة':'Calc' },
              { to:'/profile', bg:'from-rose-500/15 to-pink-500/10', border:'border-rose-500/20', color:'text-rose-400', icon:Target, label:settings.language==='ar'?'الأهداف':'Goals' },
            ].map(({to,bg,border,color,icon:Icon,label}) => (
              <Link key={to} to={to} className={`bg-gradient-to-br ${bg} ${border} border ${color} rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-all hover:scale-[1.05] hover:shadow-lg group`}>
                <div className={`p-3 bg-gradient-to-br ${bg} rounded-full group-hover:scale-110 transition-transform`}><Icon size={22} /></div>
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
