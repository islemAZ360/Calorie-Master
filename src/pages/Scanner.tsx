import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2, Info, KeyRound, CheckCircle2, RotateCcw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

export default function Scanner() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  const [mode, setMode] = useState<'ingredients' | 'meal'>('meal');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ calories: number; protein?: number; carbs?: number; fat?: number; details: string, unclear?: boolean } | null>(null);
  const [manualIngredients, setManualIngredients] = useState('');
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [extraInfo, setExtraInfo] = useState('');
  const [recipe, setRecipe] = useState<string | null>(null);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [todayCalories, setTodayCalories] = useState<number>(0);
  
  useEffect(() => {
    if (!user) return;
    const fetchTodayCalories = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      try {
        const q = query(
          collection(db, 'users', user.uid, 'history'),
          where('timestamp', '>=', startOfDay.getTime())
        );
        const snapshot = await getDocs(q);
        let sum = 0;
        snapshot.forEach(doc => sum += doc.data().calories || 0);
        setTodayCalories(sum);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTodayCalories();
  }, [user]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAiClient = () => {
    if (!settings.geminiApiKey) {
      throw new Error('API key is missing.');
    }
    return new GoogleGenAI({ apiKey: settings.geminiApiKey });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
        setResult(null); // Clear old results
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!imageSrc) return;
    setLoading(true);
    setResult(null);
    setRecipe(null);

    try {
      const ai = getAiClient();
      // 1. Convert Base64 to format expected by GenAI
      const base64Data = imageSrc.split(',')[1];
      const mimeType = imageSrc.split(';')[0].split(':')[1];

      // 2. Prepare the prompt based on mode
      let prompt = `You are an expert nutritionist. I am showing you an image of ${mode === 'meal' ? 'a prepared meal' : 'raw ingredients'}.
Please estimate the total calories in this image.
If the food or ingredients are NOT clear enough or somewhat hidden, respond exactly with "UNCLEAR: Please list the ingredients".
Otherwise, respond with a JSON object ONLY, in this exact format:
{
  "calories": 450,
  "protein": 30,
  "carbs": 40,
  "fat": 15,
  "details": "A breakdown of the calories here..."
}`;

      if (settings.language === 'ar') {
         prompt += `\n\nCRITICAL: You MUST write the "details" strictly in Arabic language.`;
      }

      if (showExtraInfo && extraInfo.trim() !== '') {
         prompt += `\n\nAdditional user notes about this food/item to help you with the analysis: "${extraInfo.trim()}"`;
      }

      // 3. Call Gemini API
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType } }
            ]
          }
        ],
        config: {
            temperature: 0.2
        }
      });
      
      const text = response.text || '';
      
      if (text.includes('UNCLEAR:')) {
         setResult({ calories: 0, details: '', unclear: true });
      } else {
         const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
         try {
           const parsed = JSON.parse(jsonStr);
           const roundedCalories = Math.round(parsed.calories);
           setResult({ 
             calories: roundedCalories, 
             protein: Math.round(parsed.protein || 0),
             carbs: Math.round(parsed.carbs || 0),
             fat: Math.round(parsed.fat || 0),
             details: parsed.details, 
             unclear: false 
           });
           saveHistory(roundedCalories, parsed.details, parsed.protein, parsed.carbs, parsed.fat);
         } catch (e) {
           console.error("Failed to parse", text);
           setResult({ calories: 0, details: text, unclear: true });
         }
      }

    } catch (err: any) {
      console.error(err);
      if (err.message === 'API key is missing.') {
         toast.error('API Key is missing. Please make sure you saved it in your Profile.');
      } else {
         toast.error(`${t('scanner.error.analyze')} \nDetails: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const analyzeManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIngredients) return;
    setLoading(true);
    setRecipe(null);
    
    try {
       const ai = getAiClient();
       let prompt = `You are an expert nutritionist. Calculate the total calories for these ingredients: ${manualIngredients}.
Respond with a JSON object ONLY, in this exact format:
{
  "calories": 450,
  "protein": 30,
  "carbs": 40,
  "fat": 15,
  "details": "A breakdown of the calories here..."
}`;

      if (settings.language === 'ar') {
         prompt += `\n\nCRITICAL: You MUST write the "details" strictly in Arabic language.`;
      }

       const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [ prompt ],
        config: { temperature: 0.2 }
       });
       const text = response.text || '';
       const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
       const parsed = JSON.parse(jsonStr);
       const roundedCalories = Math.round(parsed.calories);
       setResult({ 
         calories: roundedCalories, 
         protein: Math.round(parsed.protein || 0),
         carbs: Math.round(parsed.carbs || 0),
         fat: Math.round(parsed.fat || 0),
         details: parsed.details, 
         unclear: false 
       });
       saveHistory(roundedCalories, parsed.details, parsed.protein, parsed.carbs, parsed.fat);
    } catch(err) {
       console.error(err);
       toast.error(t('scanner.error.calc'));
    } finally {
       setLoading(false);
    }
  }

  const handleGenerateRecipe = async () => {
    if (!result) return;
    setGeneratingRecipe(true);
    
    try {
      const ai = getAiClient();
      let prompt = `You are a professional chef. Based on the ingredients the user just provided or scanned, which are detailed here: "${result.details}", suggest a healthy and delicious recipe. Format the response nicely using Markdown (headings, bullet points for ingredients, numbered lists for instructions).`;

      if (settings.language === 'ar') {
         prompt += `\n\nCRITICAL: You MUST write the entire recipe strictly in Arabic language.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [ prompt ],
      });
      
      setRecipe(response.text || '');
    } catch(err) {
       console.error(err);
       toast.error(settings.language === 'ar' ? 'فشل في توليد الوصفة' : 'Failed to generate recipe');
    } finally {
       setGeneratingRecipe(false);
    }
  };

  const checkDailyCalories = async (newCalories: number) => {
    if (!user || !settings.targetCalories) return;
    
    // Check if user has exceeded their daily limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    try {
      const q = query(
        collection(db, 'users', user.uid, 'history'),
        where('timestamp', '>=', startOfDay.getTime())
      );
      const snapshot = await getDocs(q);
      
      let sum = 0;
      snapshot.forEach(doc => {
        sum += doc.data().calories || 0;
      });
      
      sum += newCalories; 
      
      if (sum > settings.targetCalories + 100) {
        const excess = Math.round(sum - settings.targetCalories);
        toast.error(t('scanner.alert.exceeded').replace('{excess}', String(excess)));
      } else if (sum > settings.targetCalories - 300 && sum <= settings.targetCalories) {
        const remaining = Math.round(settings.targetCalories - sum);
        toast.success(t('scanner.alert.close').replace('{remaining}', String(remaining)));
      }
    } catch(err) {
      console.error("Failed to check daily calories", err);
    }
  };

  const saveHistory = async (calories: number, details: string, protein?: number, carbs?: number, fat?: number) => {
      if (!user) return;
      try {
        await addDoc(collection(db, 'users', user.uid, 'history'), {
          userId: user.uid,
          type: 'food',
          timestamp: Date.now(),
          calories: calories,
          protein: protein || 0,
          carbs: carbs || 0,
          fat: fat || 0,
          details: details,
          // Omitting imageUrl to save DB space, but we could upload it to storage
        });

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

        await checkDailyCalories(calories);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/history`);
      }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-6"
    >
       <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <Camera size={22} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('scanner.title')}</h2>
              <p className="text-xs text-slate-400">{settings.language === 'ar' ? 'التقط صورة ودع الذكاء الاصطناعي يحللها' : 'Take a photo and let AI analyze it'}</p>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/10 mb-6">
            <button
              onClick={() => setMode('meal')}
              className={`flex-1 py-3 rounded-lg font-bold transition-colors ${mode === 'meal' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              {t('scanner.mode.meal')}
            </button>
            <button
              onClick={() => setMode('ingredients')}
              className={`flex-1 py-3 rounded-lg font-bold transition-colors ${mode === 'ingredients' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              {t('scanner.mode.ingredients')}
            </button>
          </div>

          {!imageSrc ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/30 rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/50 transition-all duration-300 group"
            >
              <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300 mb-5">
                <Camera size={36} />
              </div>
              <p className="text-white font-semibold mb-1 text-lg">{t('scanner.upload.title')}</p>
              <p className="text-slate-500 text-sm">{t('scanner.upload.desc')}</p>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
                capture="environment"
              />
            </div>
          ) : (
             <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 max-h-[400px] flex justify-center group/preview">
                   <img src={imageSrc} alt="Preview" className={`max-h-[400px] object-contain transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`} />
                   
                   {loading && (
                     <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                        <div className="w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)] animate-[scan_2s_ease-in-out_infinite]" />
                        <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay animate-pulse" />
                     </div>
                   )}

                   {!loading && (
                     <button 
                       onClick={() => setImageSrc(null)}
                       className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white px-3 py-1.5 rounded-full backdrop-blur-md text-sm font-medium transition-colors opacity-0 group-hover/preview:opacity-100 focus:opacity-100"
                     >
                       {t('scanner.action.retake')}
                     </button>
                   )}
                </div>

                {!result && !loading && (
                    <div className="space-y-4 w-full">
                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={showExtraInfo} 
                                onChange={(e) => setShowExtraInfo(e.target.checked)}
                                className="rounded border-white/10 bg-black/50 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 w-4 h-4"
                            />
                            <span className="text-sm font-medium">{t('scanner.extra.toggle')}</span>
                        </label>
                        
                        {showExtraInfo && (
                            <textarea 
                                value={extraInfo}
                                onChange={(e) => setExtraInfo(e.target.value)}
                                placeholder={t('scanner.extra.placeholder')}
                                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 min-h-[80px] text-sm"
                            />
                        )}
                        
                        <button
                          onClick={analyzeImage}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                          <span>{mode === 'meal' ? t('scanner.action.analyze.meal') : t('scanner.action.analyze.ingredients')}</span>
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center p-8 text-emerald-400 space-y-4">
                        <Loader2 className="animate-spin" size={32} />
                        <p className="font-semibold animate-pulse">{t('scanner.loading')}</p>
                    </div>
                )}

                {result?.unclear && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-amber-200/90 animate-in fade-in zoom-in-95">
                        <div className="flex items-start gap-3 mb-4">
                            <Info className="text-amber-400 mt-1 shrink-0" />
                            <div>
                                <h3 className="font-bold text-amber-400">{t('scanner.unclear.title')}</h3>
                                <p className="text-sm mt-1">{t('scanner.unclear.desc')}</p>
                            </div>
                        </div>
                        <form onSubmit={analyzeManual} className="flex flex-col gap-3">
                            <textarea 
                                value={manualIngredients}
                                onChange={(e) => setManualIngredients(e.target.value)}
                                placeholder={t('scanner.unclear.placeholder')}
                                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 min-h-[100px]"
                                required
                            />
                            <button
                                type="submit"
                                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition-colors"
                            >
                                {t('scanner.unclear.button')}
                            </button>
                        </form>
                    </div>
                )}

                {result && !result.unclear && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-emerald-100 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4">
                        <span className="text-slate-400 text-sm uppercase tracking-wider mb-2 font-semibold">{t('scanner.success.title')}</span>
                        <span className="text-5xl font-black text-emerald-400 mb-4">{result.calories}</span>
                        
                        {/* Impact Bar */}
                        {settings.targetCalories && (
                           <div className="w-full mb-6">
                              <div className="flex justify-between text-xs text-slate-400 mb-1">
                                 <span>{settings.language === 'ar' ? 'استهلاكك اليوم' : 'Today'} ({todayCalories} kcal)</span>
                                 <span>{settings.targetCalories} kcal {settings.language === 'ar' ? 'الهدف' : 'Target'}</span>
                              </div>
                              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden flex">
                                 <div className="h-full bg-emerald-500/50" style={{ width: `${Math.min((todayCalories / settings.targetCalories) * 100, 100)}%` }}></div>
                                 <div className="h-full bg-emerald-400" style={{ width: `${Math.min((result.calories / settings.targetCalories) * 100, 100)}%` }}></div>
                              </div>
                              <div className="text-[10px] text-right text-emerald-400 mt-1">
                                 +{Math.round((result.calories / settings.targetCalories) * 100)}% {settings.language === 'ar' ? 'من هدفك' : 'of daily goal'}
                              </div>
                           </div>
                        )}
                        
                        {(result.protein !== undefined || result.carbs !== undefined || result.fat !== undefined) && (
                           <div className="grid grid-cols-3 gap-2 w-full mb-6">
                              <div className="bg-black/30 p-3 rounded-xl flex flex-col items-center">
                                 <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Protein</span>
                                 <span className="text-xl font-bold text-rose-400">{result.protein}g</span>
                              </div>
                              <div className="bg-black/30 p-3 rounded-xl flex flex-col items-center">
                                 <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Carbs</span>
                                 <span className="text-xl font-bold text-amber-400">{result.carbs}g</span>
                              </div>
                              <div className="bg-black/30 p-3 rounded-xl flex flex-col items-center">
                                 <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Fat</span>
                                 <span className="text-xl font-bold text-blue-400">{result.fat}g</span>
                              </div>
                           </div>
                        )}

                        <div className="bg-black/30 p-4 rounded-xl text-sm leading-relaxed text-left w-full" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
                           <strong className="text-emerald-400 block mb-2">{t('scanner.success.breakdown')}</strong>
                           {result.details}
                        </div>
                        
                        {mode === 'ingredients' && (
                           <div className="w-full mt-6 flex flex-col gap-4">
                              {!recipe && (
                                <button
                                  onClick={handleGenerateRecipe}
                                  disabled={generatingRecipe}
                                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  {generatingRecipe ? <Loader2 className="animate-spin" size={20} /> : <Info size={20} />}
                                  <span>{settings.language === 'ar' ? 'اقترح وصفة بهذه المكونات' : 'Suggest a Recipe'}</span>
                                </button>
                              )}
                              
                              {recipe && (
                                <div className="bg-black/40 border border-indigo-500/30 rounded-xl p-6 text-left w-full mt-4" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
                                   <div className="prose prose-invert prose-emerald max-w-none text-sm leading-relaxed prose-headings:text-indigo-400 prose-a:text-indigo-400">
                                      <ReactMarkdown>{recipe}</ReactMarkdown>
                                   </div>
                                   <button
                                     onClick={() => {
                                       saveHistory(result.calories, 'Recipe: ' + result.details, result.protein, result.carbs, result.fat);
                                       toast.success(settings.language === 'ar' ? 'تم تسجيل الوصفة!' : 'Recipe logged!');
                                     }}
                                     className="w-full mt-6 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/50 text-indigo-300 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                   >
                                     <CheckCircle2 size={18} />
                                     <span>{settings.language === 'ar' ? 'سجل هذه الوصفة في يومياتي' : 'Log this Recipe'}</span>
                                   </button>
                                </div>
                              )}
                           </div>
                        )}
                        {/* Scan New Button */}
                        <button
                          onClick={() => { setResult(null); setImageSrc(null); setRecipe(null); setManualIngredients(''); }}
                          className="w-full mt-6 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <RotateCcw size={18} />
                          <span>{settings.language === 'ar' ? 'مسح وجبة جديدة' : 'Scan New Meal'}</span>
                        </button>
                    </div>
                )}
             </div>
          )}
       </div>
    </motion.div>
  );
}
