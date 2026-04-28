import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { logWater, updateStreak } from '../lib/firestoreUtils';
import { Link } from 'react-router-dom';
import { Camera, Droplets, Target, Activity, Zap, Loader2, Lightbulb, Sparkles, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Circle Progress Component ─── */
interface CircleProgressProps {
  value: number;
  max: number;
  color: string;
  size: number;
  strokeWidth: number;
  label: string;
  unit: string;
}

function CircleProgress({ value, max, color, size, strokeWidth, label, unit }: CircleProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(value / max, 1);
  const strokeDashoffset = circumference - percent * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-white/5"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeLinecap="round"
          className="drop-shadow-md"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl sm:text-3xl font-black text-white leading-none">{Math.round(value)}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{label}</span>
        <span className="text-[10px] text-slate-500 font-medium">/ {Math.round(max)}{unit}</span>
      </div>
    </div>
  );
}

/* ─── Skeleton Loader ─── */
function DashboardSkeleton() {
  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8 animate-pulse">
      <div className="flex justify-between items-end">
        <div>
          <div className="skeleton h-8 w-56 mb-2"></div>
          <div className="skeleton h-4 w-36"></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="skeleton h-80 rounded-3xl"></div>
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="skeleton h-48 rounded-3xl"></div>
          <div className="skeleton h-16 rounded-2xl"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="skeleton h-28 rounded-2xl"></div>
            <div className="skeleton h-28 rounded-2xl"></div>
            <div className="skeleton h-28 rounded-2xl"></div>
            <div className="skeleton h-28 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Home Page ─── */
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
      if (!user) {
        setLoading(false);
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      try {
        const q = query(
          collection(db, 'users', user.uid, 'history'),
          where('timestamp', '>=', startOfDay.getTime())
        );
        const snapshot = await getDocs(q);
        
        let cals = 0, pro = 0, car = 0, fat = 0;
        
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.type !== 'water') {
            cals += data.calories || 0;
          }
          pro += data.protein || 0;
          car += data.carbs || 0;
          fat += data.fat || 0;
        });

        setTodayCalories(cals);
        setTodayProtein(pro);
        setTodayCarbs(car);
        setTodayFat(fat);
      } catch (error) {
        console.error("Error fetching today's data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayData();
  }, [user]);

  const handleAddWater = async () => {
    if (!user) return;
    try {
      await logWater(user.uid, settings.language);
      await updateStreak(user.uid, settings.streak, settings.lastLogDate);
      toast.success(settings.language === 'ar' ? 'تم تسجيل كوب ماء! 💧' : 'Water logged! +250ml 💧');
    } catch (err) {
      console.error(err);
      toast.error('Failed to log water');
    }
  };

  let coachTip = '';
  if (todayCalories === 0) {
     coachTip = settings.language === 'ar' ? 'ابدأ يومك بوجبة صحية!' : 'Start your day with a healthy meal!';
  } else if (todayCalories < targetCalories * 0.5) {
     coachTip = settings.language === 'ar' ? 'أنت في الطريق الصحيح، لا تنسى شرب الماء.' : 'You are on track. Don\'t forget to stay hydrated.';
  } else if (todayCalories < targetCalories) {
     coachTip = settings.language === 'ar' ? 'أنت قريب جداً من هدفك اليومي! واصل.' : 'You are very close to your daily target! Keep going.';
  } else if (todayCalories <= targetCalories + (targetCalories * 0.1)) {
     coachTip = settings.language === 'ar' ? 'لقد حققت هدفك اليومي بامتياز.' : 'You have perfectly hit your daily target.';
  } else {
     coachTip = settings.language === 'ar' ? 'لقد تجاوزت هدفك، حاول التركيز على النشاط البدني الآن.' : 'You exceeded your target. Focus on physical activity now.';
  }

  /* ─── Logged-out Landing Page ─── */
  if (!user) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center relative overflow-hidden"
      >
        {/* Floating background shapes */}
        <div className="absolute top-20 left-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 animate-pulse-glow shadow-2xl shadow-emerald-500/10">
            <Sparkles size={36} className="text-emerald-400" />
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
              Calorie Master
            </span>
          </h2>
          
          <p className="text-slate-400 max-w-lg mb-10 leading-relaxed text-lg mx-auto">
            {settings.language === 'ar' 
              ? 'تتبع وجباتك بذكاء باستخدام الذكاء الاصطناعي. احصل على تحليل دقيق للسعرات والماكروز فوراً.'
              : 'Track your meals intelligently using AI. Get instant calorie & macro breakdowns from a single photo.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 mb-16 relative z-10"
        >
          <Link to="/login" className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg shadow-emerald-500/25 text-lg flex items-center gap-2 justify-center">
            {settings.language === 'ar' ? 'ابدأ الآن' : 'Get Started Free'} <ArrowRight size={20} />
          </Link>
          <Link to="/calculator" className="glass hover:bg-white/10 text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105 text-lg">
            {settings.language === 'ar' ? 'جرب الحاسبة' : 'Try Calculator'}
          </Link>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full relative z-10"
        >
          {[
            { icon: Camera, color: 'emerald', title: settings.language === 'ar' ? 'مسح ذكي' : 'AI Scanner', desc: settings.language === 'ar' ? 'صور وجبتك واحصل على التحليل فوراً' : 'Snap your meal and get instant analysis' },
            { icon: Activity, color: 'cyan', title: settings.language === 'ar' ? 'حاسبة BMR' : 'BMR Calculator', desc: settings.language === 'ar' ? 'احسب احتياجاتك اليومية بدقة' : 'Calculate your exact daily needs' },
            { icon: Zap, color: 'orange', title: settings.language === 'ar' ? 'تتبع يومي' : 'Daily Tracking', desc: settings.language === 'ar' ? 'تابع تقدمك وحافظ على سلسلتك' : 'Track progress and keep your streak' },
          ].map(({ icon: Icon, color, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.1, duration: 0.4 }}
              className="glass rounded-2xl p-5 text-left hover:bg-white/[0.06] transition-all duration-300 group"
            >
              <Icon size={24} className={`text-${color}-400 mb-3 group-hover:scale-110 transition-transform`} />
              <h3 className="text-white font-bold text-sm mb-1">{title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    );
  }

  /* ─── Logged-in Dashboard ─── */
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-8"
    >
      {loading ? (
        <DashboardSkeleton />
      ) : (
      <>
        {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-white">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return settings.language === 'ar' ? 'صباح الخير ☕' : 'Good Morning ☕';
              if (hour < 18) return settings.language === 'ar' ? 'مساء الخير ☀️' : 'Good Afternoon ☀️';
              return settings.language === 'ar' ? 'مساء النور 🌙' : 'Good Evening 🌙';
            })()}
          </h2>
          <p className="text-slate-400 mt-1">
            {settings.selectedPlan ? (
              <>
                {settings.language === 'ar' ? 'خطتك: ' : 'Your plan: '}
                <span className="text-emerald-400 font-semibold">
                  {settings.selectedPlan === 'maintain' ? (settings.language === 'ar' ? 'الحفاظ على الوزن' : 'Maintain Weight')
                   : settings.selectedPlan === 'loss' ? (settings.language === 'ar' ? 'خسارة الوزن' : 'Weight Loss')
                   : settings.selectedPlan === 'extremeLoss' ? (settings.language === 'ar' ? 'خسارة شديدة' : 'Extreme Loss')
                   : (settings.language === 'ar' ? 'زيادة الوزن' : 'Weight Gain')}
                </span>
              </>
            ) : (settings.language === 'ar' ? 'تقدمك اليومي' : 'Your progress for today')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
             onClick={handleAddWater}
             className="hidden sm:flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-full font-bold transition-all hover:scale-105"
          >
             <Droplets size={16} /> <span>{settings.language === 'ar' ? 'أضف ماء' : 'Water'}</span>
          </button>
          
          {settings.streak && settings.streak > 0 ? (
             <div className="flex flex-col items-end">
               <span className="text-[10px] text-orange-500 uppercase tracking-widest font-bold">
                 {settings.language === 'ar' ? 'السلسلة' : 'Streak'}
               </span>
               <div className="text-2xl font-black text-orange-400 flex items-center gap-1">
                 {settings.streak} <Zap size={24} className="fill-orange-500" />
               </div>
             </div>
          ) : null}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calories Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="glass-strong rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center lg:col-span-1 animate-border-glow"
        >
           <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest w-full text-left mb-6">{settings.language === 'ar' ? 'السعرات' : 'Calories'}</h3>
           <CircleProgress 
             value={todayCalories} 
             max={targetCalories} 
             color="#10b981" 
             size={220} 
             strokeWidth={16} 
             label={settings.language === 'ar' ? 'الاستهلاك' : 'Consumed'}
             unit="kcal"
           />
           <div className="w-full flex justify-between mt-8 pt-6 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">{settings.language === 'ar' ? 'الهدف' : 'Target'}</span>
                <span className="text-white font-bold">{targetCalories}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs text-slate-500">{settings.language === 'ar' ? 'المتبقي' : 'Remaining'}</span>
                <span className="text-emerald-400 font-bold">{Math.max(targetCalories - todayCalories, 0)}</span>
              </div>
           </div>
        </motion.div>

        {/* Macros & Quick Actions */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Macros Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="glass-strong rounded-3xl p-6 shadow-2xl flex-1"
          >
             <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">{settings.language === 'ar' ? 'العناصر الغذائية' : 'Macronutrients'}</h3>
             <div className="flex justify-around items-center h-[140px]">
                <CircleProgress value={todayProtein} max={targetProtein} color="#fb7185" size={100} strokeWidth={8} label="Pro" unit="g" />
                <CircleProgress value={todayCarbs} max={targetCarbs} color="#fbbf24" size={100} strokeWidth={8} label="Carb" unit="g" />
                <CircleProgress value={todayFat} max={targetFat} color="#60a5fa" size={100} strokeWidth={8} label="Fat" unit="g" />
             </div>
          </motion.div>

          {/* Coach Tip */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="bg-indigo-500/[0.08] border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4"
          >
             <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-400 shrink-0">
               <Lightbulb size={24} />
             </div>
             <div>
               <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">{settings.language === 'ar' ? 'نصيحة المدرب' : 'Coach Tip'}</h4>
               <p className="text-sm text-indigo-100/80 leading-relaxed font-medium">{coachTip}</p>
             </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
             {[
               { to: '/scanner', color: 'emerald', icon: Camera, label: settings.language === 'ar' ? 'مسح وجبة' : 'Scan Meal' },
               { to: '/history', color: 'cyan', icon: Droplets, label: settings.language === 'ar' ? 'السجل' : 'History' },
               { to: '/calculator', color: 'purple', icon: Activity, label: settings.language === 'ar' ? 'الحاسبة' : 'Calculator' },
               { to: '/profile', color: 'rose', icon: Target, label: settings.language === 'ar' ? 'الأهداف' : 'Goals' },
             ].map(({ to, color, icon: Icon, label }) => (
               <Link 
                 key={to}
                 to={to} 
                 className={`bg-${color}-500/10 hover:bg-${color}-500/20 border border-${color}-500/20 text-${color}-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-all hover:scale-[1.03] group`}
               >
                 <div className={`p-3 bg-${color}-500/20 rounded-full group-hover:scale-110 transition-transform`}><Icon size={24} /></div>
                 <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
               </Link>
             ))}
          </motion.div>
        </div>

      </div>
      </>
      )}
    </motion.div>
  );
}
