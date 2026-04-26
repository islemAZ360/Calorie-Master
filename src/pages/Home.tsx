import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Camera, Droplets, Target, Activity, Zap, Loader2, PlusCircle, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [todayCarbs, setTodayCarbs] = useState(0);
  const [todayFat, setTodayFat] = useState(0);
  const [loading, setLoading] = useState(true);

  // Example Goals (could be added to settings later)
  const targetCalories = settings.targetCalories || 2000;
  // Basic heuristic: 30% protein, 40% carbs, 30% fat if we just have target calories.
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
          cals += data.calories || 0;
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
      await addDoc(collection(db, 'users', user.uid, 'history'), {
        userId: user.uid,
        type: 'water',
        timestamp: Date.now(),
        amount: 250,
      });
      toast.success(settings.language === 'ar' ? 'تم تسجيل كوب ماء!' : 'Water logged! +250ml');
      
      // Update streak silently
      const docRef = doc(db, 'users', user.uid);
      const today = new Date().setHours(0, 0, 0, 0);
      const lastLog = settings.lastLogDate ? new Date(settings.lastLogDate) : null;
      
      if (!lastLog || lastLog.getTime() < today) {
        let newStreak = settings.streak || 0;
        if (lastLog && today - lastLog.getTime() > 86400000 * 1.5) {
          newStreak = 1; // Missed a day
        } else {
          newStreak += 1;
        }
        await setDoc(docRef, {
          lastLogDate: today,
          streak: newStreak
        }, { merge: true });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to log water');
    }
  };

  const progressPercentage = Math.min((todayCalories / targetCalories) * 100, 100);

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

  if (!user) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
      >
        <Target size={64} className="text-emerald-500 mb-6" />
        <h2 className="text-3xl font-black text-white mb-4">Welcome to Calorie Master</h2>
        <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
          Track your meals intelligently using Gemini AI. Get macro breakdowns, maintain your daily streaks, and stay healthy.
        </p>
        <Link to="/login" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-8 py-4 rounded-full transition-transform hover:scale-105 shadow-lg shadow-emerald-500/20">
          Get Started Now
        </Link>
      </motion.div>
    );
  }

  const CircleProgress = ({ value, max, color, size, strokeWidth, label, unit }: any) => {
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
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl sm:text-3xl font-black text-white leading-none">{Math.round(value)}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">{label}</span>
          <span className="text-[10px] text-slate-500 font-medium">/ {Math.round(max)}{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-8"
    >
      {loading ? (
        <div className="w-full flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-emerald-500" size={48} />
        </div>
      ) : (
      <>
        {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-white">Dashboard</h2>
          <p className="text-slate-400 mt-1">Here is your progress for today.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
             onClick={handleAddWater}
             className="hidden sm:flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-full font-bold transition-all"
          >
             <Droplets size={16} /> <span>{settings.language === 'ar' ? 'أضف ماء' : 'Water'}</span>
          </button>
          
          {settings.streak && settings.streak > 0 ? (
             <div className="flex flex-col items-end">
               <span className="text-[10px] text-orange-500 uppercase tracking-widest font-bold">Current Streak</span>
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
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-sm flex flex-col items-center justify-center lg:col-span-1">
           <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest w-full text-left mb-6">Calories</h3>
           <CircleProgress 
             value={todayCalories} 
             max={targetCalories} 
             color="#10b981" 
             size={220} 
             strokeWidth={16} 
             label="Consumed"
             unit="kcal"
           />
           <div className="w-full flex justify-between mt-8 pt-6 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">Target</span>
                <span className="text-white font-bold">{targetCalories}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs text-slate-500">Remaining</span>
                <span className="text-emerald-400 font-bold">{Math.max(targetCalories - todayCalories, 0)}</span>
              </div>
           </div>
        </div>

        {/* Macros & Quick Actions */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Macros Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-sm flex-1">
             <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6">Macronutrients</h3>
             <div className="flex justify-around items-center h-[140px]">
                <CircleProgress value={todayProtein} max={targetProtein} color="#fb7185" size={100} strokeWidth={8} label="Pro" unit="g" />
                <CircleProgress value={todayCarbs} max={targetCarbs} color="#fbbf24" size={100} strokeWidth={8} label="Carb" unit="g" />
                <CircleProgress value={todayFat} max={targetFat} color="#60a5fa" size={100} strokeWidth={8} label="Fat" unit="g" />
             </div>
          </div>

          {/* Coach Tip */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4">
             <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-400">
               <Lightbulb size={24} />
             </div>
             <div>
               <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">{settings.language === 'ar' ? 'نصيحة المدرب' : 'Coach Tip'}</h4>
               <p className="text-sm text-indigo-100/80 leading-relaxed font-medium">{coachTip}</p>
             </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <Link to="/scanner" className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors group">
                <div className="p-3 bg-emerald-500/20 rounded-full group-hover:scale-110 transition-transform"><Camera size={24} /></div>
                <span className="text-xs font-bold uppercase tracking-wider">Scan Meal</span>
             </Link>
             <Link to="/history" className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors group">
                <div className="p-3 bg-cyan-500/20 rounded-full group-hover:scale-110 transition-transform"><Droplets size={24} /></div>
                <span className="text-xs font-bold uppercase tracking-wider">History</span>
             </Link>
             <Link to="/calculator" className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors group">
                <div className="p-3 bg-purple-500/20 rounded-full group-hover:scale-110 transition-transform"><Activity size={24} /></div>
                <span className="text-xs font-bold uppercase tracking-wider">Calculator</span>
             </Link>
             <Link to="/profile" className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-colors group">
                <div className="p-3 bg-rose-500/20 rounded-full group-hover:scale-110 transition-transform"><Target size={24} /></div>
                <span className="text-xs font-bold uppercase tracking-wider">Goals</span>
             </Link>
          </div>
        </div>

      </div>
      </>
      )}
    </motion.div>
  );
}
