import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { History as HistoryIcon, Activity, Camera, Leaf, Trash2, Droplets } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface HistoryItem {
  id: string;
  type: string;
  timestamp: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  details: string;
}

export default function History() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'history'),
          orderBy('timestamp', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const items: HistoryItem[] = [];
        querySnapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as HistoryItem);
        });
        setHistory(items);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/history`);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, navigate]);

  const chartData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      
      const dayCalories = history
        .filter(item => item.type === 'food' && item.timestamp >= d.getTime() && item.timestamp < nextDay.getTime())
        .reduce((sum, item) => sum + item.calories, 0);
        
      data.push({
        name: d.toLocaleDateString(settings.language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }),
        calories: dayCalories,
        date: d.getTime()
      });
    }
    return data;
  }, [history, settings.language]);

  if (loading) {
    return <div className="max-w-4xl w-full mx-auto p-4 md:p-8 relative z-10 text-emerald-400 text-center py-20 font-bold">Loading...</div>
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const todayFoodItems = history.filter(item => item.type === 'food' && item.timestamp >= startOfDay.getTime());
  const todayCalories = todayFoodItems.reduce((acc, item) => acc + item.calories, 0);

  const todayWaterItems = history.filter(item => item.type === 'water' && item.timestamp >= startOfDay.getTime());
  const todayWaterCups = todayWaterItems.reduce((acc, item) => acc + item.calories, 0); // using calories field as "amount" for simplicity

  let progressTip = '';
  if (settings.targetCalories) {
      if (todayCalories > settings.targetCalories + 100) {
          progressTip = t('history.progress.tip.over');
      } else if (todayCalories < settings.targetCalories - 200) {
          progressTip = t('history.progress.tip.low');
      } else {
          progressTip = t('history.progress.tip.onTrack');
      }
  }

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (confirm(t('history.action.delete') + '?')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'history', id));
        setHistory(prev => prev.filter(item => item.id !== id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/history/${id}`);
        toast.error('Failed to delete history item.');
      }
    }
  };

  const handleAddWater = async () => {
    if (!user) return;
    try {
      const newItem = {
        userId: user.uid,
        type: 'water',
        timestamp: Date.now(),
        calories: 1, // 1 cup/glass
        details: settings.language === 'ar' ? 'كوب ماء (250 مل)' : '1 Glass of Water (250ml)',
      };
      const docRef = await addDoc(collection(db, 'users', user.uid, 'history'), newItem);
      setHistory(prev => [{ id: docRef.id, ...newItem }, ...prev]);

      // Streak Logic
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      let currentStreak = settings.streak || 0;
      const lastLog = settings.lastLogDate ? new Date(settings.lastLogDate) : null;
      
      if (!lastLog || lastLog.getTime() < today) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastLog && lastLog.getTime() === yesterday.getTime()) {
          currentStreak += 1;
        } else if (!lastLog || lastLog.getTime() < yesterday.getTime()) {
          currentStreak = 1;
        }
        
        await setDoc(doc(db, 'users', user.uid), {
          streak: currentStreak,
          lastLogDate: today
        }, { merge: true });
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/history`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-6"
    >
       <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-sm">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {settings.targetCalories && (
              <div className="md:col-span-2 bg-black/20 border border-emerald-500/30 p-6 rounded-2xl flex flex-col xl:flex-row gap-6">
                 <div className="flex-1 flex flex-col">
                     <h3 className="text-xl font-bold text-white mb-2">{t('history.progress.title')}</h3>
                     <p className="text-slate-400 text-sm mb-4">{progressTip}</p>
                     <div className="w-full bg-zinc-800 rounded-full h-3 mb-2 overflow-hidden mt-auto">
                        <div 
                           className={`h-3 rounded-full ${todayCalories > settings.targetCalories ? 'bg-rose-500' : 'bg-emerald-500'}`}
                           style={{ width: `${Math.min((todayCalories / settings.targetCalories) * 100, 100)}%` }}
                        ></div>
                     </div>
                     <div className="flex justify-between text-xs text-slate-500 font-medium">
                         <span>0</span>
                         <span>{settings.targetCalories} kcal</span>
                     </div>
                 </div>
                 
                 <div className="h-[120px] xl:w-1/2 mt-4 xl:mt-0" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <Tooltip 
                          cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.calories > (settings.targetCalories || 2000) ? '#f43f5e' : '#10b981'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>

                 <div className="flex flex-col justify-center bg-white/5 p-4 rounded-xl shrink-0 xl:min-w-[120px]" dir="ltr">
                     <div className="text-[10px] text-slate-400 text-center uppercase tracking-widest mb-1">{t('history.progress.consumed')}</div>
                     <div className="text-2xl font-black text-emerald-400 tabular-nums tracking-tighter text-center">{Math.round(todayCalories)}</div>
                 </div>
              </div>
            )}

            <div className="bg-black/20 border border-blue-500/30 p-6 rounded-2xl flex flex-col justify-between group">
               <div>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                     <Droplets className="text-blue-400" size={20} />
                     {settings.language === 'ar' ? 'الماء' : 'Water (Today)'}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                     {settings.language === 'ar' ? 'تتبع استهلاكك للماء اليومي.' : 'Track your daily water intake.'}
                  </p>
               </div>
               
               <div className="flex items-center justify-between mt-auto">
                 <div className="flex -space-x-2">
                   {[...Array(Math.min(todayWaterCups, 5))].map((_, i) => (
                     <div key={i} className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-zinc-900 flex items-center justify-center text-blue-400 z-10">
                       <Droplets size={14} />
                     </div>
                   ))}
                   {todayWaterCups > 5 && (
                     <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-zinc-900 flex items-center justify-center text-xs font-bold text-slate-300 z-0">
                       +{todayWaterCups - 5}
                     </div>
                   )}
                 </div>
                 
                 <button 
                    onClick={handleAddWater}
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-3 rounded-xl transition-colors shrink-0 outline-none"
                    title={settings.language === 'ar' ? 'إضافة كوب ماء' : 'Add a glass of water'}
                 >
                    <Droplets size={20} className="fill-current" />
                 </button>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
             <div className="bg-emerald-500/10 p-2 rounded-lg">
                <HistoryIcon className="text-emerald-500 w-6 h-6" />
             </div>
             <h2 className="text-2xl font-bold text-white tracking-tight">{t('history.title')}</h2>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 bg-black/20 rounded-2xl border border-white/5">
                <p className="text-slate-400 mb-2">{t('history.empty.title')}</p>
                <p className="text-sm text-slate-500 mb-6">{t('history.empty.desc')}</p>
                <div className="flex justify-center gap-4">
                   <button onClick={() => navigate('/')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors">{t('history.action.calc')}</button>
                   <button onClick={() => navigate('/scanner')} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-full text-sm font-bold transition-colors">{t('history.action.scan')}</button>
                </div>
            </div>
          ) : (
        <div className="space-y-8">
            {Object.entries(
               history.reduce((groups, item) => {
                 const date = new Date(item.timestamp);
                 const today = new Date();
                 const yesterday = new Date();
                 yesterday.setDate(today.getDate() - 1);
                 
                 let dateStr = '';
                 if (date.toDateString() === today.toDateString()) {
                   dateStr = t('history.date.today') || 'Today';
                 } else if (date.toDateString() === yesterday.toDateString()) {
                   dateStr = t('history.date.yesterday') || 'Yesterday';
                 } else {
                   dateStr = date.toLocaleDateString(settings.language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                 }
                 
                 if (!groups[dateStr]) groups[dateStr] = [];
                 groups[dateStr].push(item);
                 return groups;
               }, {} as Record<string, typeof history>)
            ).map(([date, items]) => (
               <div key={date} className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 border-b border-white/5 pb-2">{date}</h4>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {items.map((item) => (
                         <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-black/30 border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-white/5 transition-colors group"
                         >
                          <div className={`p-3 rounded-xl shrink-0 ${item.type === 'bmr' ? 'bg-blue-500/10 text-blue-400' : item.type === 'water' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                             {item.type === 'bmr' ? <Activity size={24} /> : item.type === 'water' ? <Droplets size={24} /> : <Camera size={24} />}
                          </div>
                          <div className="flex-1">
                             <div className="flex items-center justify-between mb-1">
                                 <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-white capitalize">{item.type === 'bmr' ? t('history.item.bmr') : item.type === 'water' ? (settings.language === 'ar' ? 'استهلاك ماء' : 'Water Intake') : t('history.item.food')}</h3>
                                    <button onClick={() => handleDelete(item.id)} className="text-slate-500 hover:text-rose-500 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100" title={t('history.action.delete')}>
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                                 <span className="text-xs text-slate-500 block" dir="ltr">
                                   {new Date(item.timestamp).toLocaleTimeString(settings.language === 'ar' ? 'ar-EG' : 'en-US', { timeStyle: 'short' })}
                                 </span>
                             </div>
                             <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{item.details}</p>
                          </div>
                          {item.type !== 'water' && (
                            <div className="sm:ml-4 flex flex-col items-start sm:items-end w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-white/5" dir="ltr">
                               <span className="text-2xl font-black tabular-nums tracking-tighter text-white">{Math.round(item.calories)}</span>
                               <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider text-right">{t('history.calories')}</span>
                               {(item.protein !== undefined || item.carbs !== undefined || item.fat !== undefined) ? (
                                  <div className="flex gap-2 mt-2 text-[10px] font-medium tracking-wide">
                                     {item.protein ? <span className="text-rose-400">{item.protein}g P</span> : null}
                                     {item.carbs ? <span className="text-amber-400">{item.carbs}g C</span> : null}
                                     {item.fat ? <span className="text-blue-400">{item.fat}g F</span> : null}
                                  </div>
                               ) : null}
                            </div>
                          )}
                       </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
               </div>
            ))}
        </div>
          )}
       </div>
    </motion.div>
  );
}
