import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { defaultSettings, useSettings, UserSettings } from '../contexts/SettingsContext';
import { doc, getDoc, setDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { User, Key, CheckCircle, XCircle, Loader2, Save, LogOut, BrainCircuit, Calculator, Activity } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useNavigate } from 'react-router-dom';

const ACTIVITY_LEVELS = [
  { value: 1, label: 'Basal Metabolic Rate (BMR)' },
  { value: 1.2, label: 'Sedentary: little or no exercise' },
  { value: 1.375, label: 'Light: exercise 1-3 times/week' },
  { value: 1.465, label: 'Moderate: exercise 4-5 times/week' },
  { value: 1.55, label: 'Active: daily exercise 3-4 times/week' },
  { value: 1.725, label: 'Very Active: intense exercise 6-7 times/week' },
  { value: 1.9, label: 'Extra Active: very intense daily' },
];

export default function Profile() {
  const { user } = useAuth();
  const { t, settings } = useSettings();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<'math' | 'ai' | null>(null);
  
  const [form, setForm] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const loadProfile = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setForm({ ...defaultSettings, ...docSnap.data() } as UserSettings);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user, navigate]);

  const handleVerify = async () => {
    if (!form.geminiApiKey) return;
    setVerifying(true);
    setVerifyStatus('idle');
    try {
      const ai = new GoogleGenAI({ apiKey: form.geminiApiKey });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test connection. Respond "OK" only.'
      });
      setVerifyStatus('success');
    } catch (err) {
      console.error(err);
      setVerifyStatus('error');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      // Logic to check if weight changed
      // If weight changed, check selected plan for positive/negative notification
      let weightChanged = false;
      let diff = 0;
      
      if (form.unitSystem === 'metric' && form.kg !== settings.kg) {
        weightChanged = true;
        diff = Number(form.kg) - Number(settings.kg);
      } else if (form.unitSystem === 'us' && form.pounds !== settings.pounds) {
        weightChanged = true;
        diff = Number(form.pounds) - Number(settings.pounds);
      }
      
      await setDoc(doc(db, 'users', user.uid), form, { merge: true });
      
      if (weightChanged && Math.abs(diff) >= 0.5) {
        let msg = t('profile.weight.neutral');
        if (settings.selectedPlan === 'loss' || settings.selectedPlan === 'extremeLoss') {
            msg = diff < 0 ? t('profile.weight.positive.loss') : t('profile.weight.negative.loss');
        } else if (settings.selectedPlan === 'gain') {
            msg = diff > 0 ? t('profile.weight.positive.gain') : t('profile.weight.negative.gain');
        }
        alert('Profile saved successfully!\n\n' + msg);
      } else {
        alert('Profile saved successfully!');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      alert('Failed to save profile. Ensure Firestore rules are configured correctly for your custom config.');
    } finally {
      setSaving(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return [];
    try {
      const q = query(
        collection(db, 'users', user.uid, 'history'),
        orderBy('timestamp', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/history`);
      return [];
    }
  };

  const handleMathAnalysis = async () => {
     setAnalysisLoading(true);
     setAnalysisType('math');
     setAnalysisResult(null);
     
     if (!settings.targetCalories) {
        setAnalysisResult(t('profile.analysis.error.noPlan'));
        setAnalysisLoading(false);
        return;
     }

     const data = await fetchHistory();
     const foodData = data.filter(item => item.type === 'food');
     
     if (foodData.length === 0) {
        setAnalysisResult(t('profile.analysis.error.noData'));
        setAnalysisLoading(false);
        return;
     }

     const days = new Set(foodData.map(item => new Date(item.timestamp).toDateString())).size;
     const totalCals = foodData.reduce((sum, item) => sum + Number(item.calories), 0);
     const avgDaily = totalCals / days;
     const target = settings.targetCalories;
     
     let report = '';
     if (settings.language === 'ar') {
         report = `لقد سجلت بيانات لمدة ${days} يوم/أيام.\nمتوسط الاستهلاك اليومي: ${Math.round(avgDaily)} سعرة حرارية.\nهدفك اليومي: ${target} سعرة حرارية.\n\n`;
         if (avgDaily > target + 100) {
            report += "أنت تتجاوز هدفك باستمرار. فكر في تقليل حصص الوجبات أو زيادة نشاطك البدني.";
         } else if (avgDaily < target - 100) {
            report += "أنت تستهلك أقل من هدفك. تأكد من حصولك على العناصر الغذائية الكافية.";
         } else {
            report += "عمل رائع! أنت قريب جداً من هدفك اليومي المتوقع. استمر في هذا الأداء!";
         }
     } else {
         report = `You have recorded data for ${days} days.\nAverage Daily Consumption: ${Math.round(avgDaily)} kcal.\nYour Target: ${target} kcal.\n\n`;
         if (avgDaily > target + 100) {
            report += "You are consistently eating above your target. Consider reducing portion sizes or increasing activity.";
         } else if (avgDaily < target - 100) {
            report += "You are eating below your target. Ensure you are getting enough nutrients.";
         } else {
            report += "Great job! You are very close to your daily target. Keep it up!";
         }
     }
     
     setAnalysisResult(report);
     setAnalysisLoading(false);
  };

  const handleAiAnalysis = async () => {
      setAnalysisLoading(true);
      setAnalysisType('ai');
      setAnalysisResult(null);

      const ai = settings.geminiApiKey ? new GoogleGenAI({ apiKey: settings.geminiApiKey }) : null;
      if (!ai) {
          setAnalysisResult(t('profile.analysis.error.api'));
          setAnalysisLoading(false);
          return;
      }

      if (!settings.targetCalories) {
          setAnalysisResult(t('profile.analysis.error.noPlan'));
          setAnalysisLoading(false);
          return;
      }

      const data = await fetchHistory();
      if (data.length === 0) {
          setAnalysisResult(t('profile.analysis.error.noData'));
          setAnalysisLoading(false);
          return;
      }

      const recentData = data.slice(-50); // limit to last 50 for token limits

      const prompt = `You are an expert nutritionist and fitness coach. Analyze this user's food consumption history.
Their target daily intake is ${settings.targetCalories} kcal.
Here is their recent food history data in JSON format:
${JSON.stringify(recentData, null, 2)}

Provide a concise, encouraging assessment of their progress. Highlight any patterns and give one actionable tip.
${settings.language === 'ar' ? 'CRITICAL: You MUST write your analysis entirely in Arabic.' : ''}`;

      try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          setAnalysisResult(response.text || 'No response generated.');
      } catch (err) {
          console.error(err);
          setAnalysisResult(t('profile.analysis.error.api'));
      } finally {
          setAnalysisLoading(false);
      }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (loading) return <div className="text-center py-20 text-emerald-400">Loading profile...</div>;

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-6">
       <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-sm">
          
          <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
             <div className="flex items-center gap-3">
               <div className="bg-emerald-500/10 p-2 rounded-lg">
                  <User className="text-emerald-500 w-6 h-6" />
               </div>
               <h2 className="text-2xl font-bold text-white tracking-tight">{t('nav.profile')}</h2>
             </div>
             <button onClick={handleLogout} className="flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors text-sm font-medium">
               <LogOut size={16} /> Logout
             </button>
          </div>

          <div className="mb-10 space-y-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
             <div className="flex items-start gap-3 mb-4">
                <Activity className="text-emerald-400 mt-1 shrink-0" />
                <div>
                   <h3 className="font-bold text-white mb-1">{t('profile.analysis.title')}</h3>
                   <p className="text-sm text-slate-400 whitespace-pre-wrap">{t('profile.analysis.desc')}</p>
                </div>
             </div>
             
             <div className="flex flex-col sm:flex-row gap-3">
                 <button 
                    type="button"
                    onClick={handleMathAnalysis} 
                    disabled={analysisLoading}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                    <Calculator size={18} />
                    {t('profile.analysis.math')}
                 </button>
                 <button 
                    type="button"
                    onClick={handleAiAnalysis}
                    disabled={analysisLoading}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                    <BrainCircuit size={18} />
                    {t('profile.analysis.ai')}
                 </button>
             </div>

             {analysisLoading && (
                 <div className="flex items-center justify-center gap-3 text-emerald-400 py-6 border-t border-white/5 mt-4">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="font-medium">{t('profile.analysis.loading')}</span>
                 </div>
             )}

             {analysisResult && !analysisLoading && (
                 <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
                     <div className={`p-4 rounded-xl ${analysisType === 'ai' ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20' : 'bg-white/5 text-slate-300'}`}>
                         <p className="whitespace-pre-wrap leading-relaxed text-sm">
                            {analysisResult}
                         </p>
                     </div>
                 </div>
             )}
          </div>

      <form onSubmit={handleSave} className="space-y-8">
            
            {/* API Key Section */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key size={18} className="text-emerald-500" />
                {t('profile.api.title')}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {t('profile.api.desc')}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={form.geminiApiKey}
                    onChange={(e) => {
                       setForm({ ...form, geminiApiKey: e.target.value });
                       setVerifyStatus('idle');
                    }}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner text-left"
                    dir={form.language === 'ar' ? 'ltr' : 'inherit'}
                  />
                  {verifyStatus === 'success' && <CheckCircle size={18} className="absolute right-3 top-3.5 text-emerald-500" />}
                  {verifyStatus === 'error' && <XCircle size={18} className="absolute right-3 top-3.5 text-rose-500" />}
                </div>
                
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!form.geminiApiKey || verifying}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center min-w-[120px]"
                >
                  {verifying ? <Loader2 size={18} className="animate-spin" /> : t('profile.api.verify')}
                </button>
              </div>
            </section>

            {/* Language Setting */}
            <section className="space-y-4 border-t border-white/5 pt-6">
               <h3 className="text-lg font-semibold text-white">{t('profile.lang.title')}</h3>
               
               <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('profile.lang.label')}</label>
                  <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/10 h-[50px] max-w-sm">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, language: 'en' })}
                      className={`flex-1 rounded-lg font-bold transition-colors ${form.language === 'en' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, language: 'ar' })}
                      className={`flex-1 rounded-lg font-bold transition-colors ${form.language === 'ar' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      العربية (Arabic)
                    </button>
                  </div>
               </div>
            </section>

            {/* Default Stats */}
            <section className="space-y-4 border-t border-white/5 pt-6">
               <h3 className="text-lg font-semibold text-white">{t('profile.health.title')}</h3>
               <p className="text-sm text-slate-400 leading-relaxed mb-4">
                 {t('profile.health.desc')}
               </p>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.age')}</label>
                    <input
                      type="number"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      dir="ltr"
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.gender')}</label>
                    <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/10 h-[48px]">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, gender: 'm' })}
                        className={`flex-1 rounded-lg font-bold transition-colors ${form.gender === 'm' ? 'bg-emerald-500 text-zinc-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        {t('calculator.male')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, gender: 'f' })}
                        className={`flex-1 rounded-lg font-bold transition-colors ${form.gender === 'f' ? 'bg-emerald-500 text-zinc-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        {t('calculator.female')}
                      </button>
                    </div>
                  </div>
               </div>

               <div>
                 <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">Unit System</label>
                 <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/10 h-[50px] max-w-sm mb-4">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, unitSystem: 'us' })}
                      className={`flex-1 rounded-lg font-bold transition-colors ${form.unitSystem === 'us' ? 'bg-emerald-500 text-zinc-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      US (ft, lbs)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, unitSystem: 'metric' })}
                      className={`flex-1 rounded-lg font-bold transition-colors ${form.unitSystem === 'metric' ? 'bg-emerald-500 text-zinc-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      Metric (cm, kg)
                    </button>
                  </div>
               </div>

                {form.unitSystem === 'us' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.height')}</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative" dir="ltr">
                          <input type="number" value={form.feet} onChange={(e) => setForm({ ...form, feet: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white text-left" />
                          <span className="absolute right-4 top-3 text-slate-500">{t('calculator.ft')}</span>
                        </div>
                        <div className="relative" dir="ltr">
                          <input type="number" value={form.inches} onChange={(e) => setForm({ ...form, inches: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white text-left" />
                          <span className="absolute right-4 top-3 text-slate-500">{t('calculator.in')}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.weight')}</label>
                      <div className="relative" dir="ltr">
                        <input type="number" value={form.pounds} onChange={(e) => setForm({ ...form, pounds: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white text-left" />
                        <span className="absolute right-4 top-3 text-slate-500">{t('calculator.lbs')}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.height')}</label>
                      <div className="relative" dir="ltr">
                        <input type="number" value={form.cm} onChange={(e) => setForm({ ...form, cm: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white text-left" />
                        <span className="absolute right-4 top-3 text-slate-500">{t('calculator.cm')}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.weight')}</label>
                      <div className="relative" dir="ltr">
                        <input type="number" value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white text-left" />
                        <span className="absolute right-4 top-3 text-slate-500">{t('calculator.kg')}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.activity')}</label>
                  <select
                    value={form.activity}
                    onChange={(e) => setForm({ ...form, activity: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white appearance-none"
                  >
                    {ACTIVITY_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>

            </section>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-xl shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 mt-8 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{t('profile.action.save')}</span>
            </button>
          </form>

       </div>
    </div>
  );
}
