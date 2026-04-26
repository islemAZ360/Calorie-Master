import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Loader2, Info, KeyRound } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Link } from 'react-router-dom';

export default function Scanner() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  const [mode, setMode] = useState<'ingredients' | 'meal'>('meal');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ calories: number; details: string, unclear?: boolean } | null>(null);
  const [manualIngredients, setManualIngredients] = useState('');
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [extraInfo, setExtraInfo] = useState('');
  
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
        model: 'gemini-3.0-flash',
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
           setResult({ calories: roundedCalories, details: parsed.details, unclear: false });
           saveHistory(roundedCalories, parsed.details);
         } catch (e) {
           console.error("Failed to parse", text);
           setResult({ calories: 0, details: text, unclear: true });
         }
      }

    } catch (err: any) {
      console.error(err);
      if (err.message === 'API key is missing.') {
         alert('API Key is missing. Please make sure you saved it in your Profile.');
      } else {
         alert(`${t('scanner.error.analyze')} \nDetails: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const analyzeManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIngredients) return;
    setLoading(true);
    
    try {
       const ai = getAiClient();
       let prompt = `You are an expert nutritionist. Calculate the total calories for these ingredients: ${manualIngredients}.
Respond with a JSON object ONLY, in this exact format:
{
  "calories": 450,
  "details": "A breakdown of the calories here..."
}`;

      if (settings.language === 'ar') {
         prompt += `\n\nCRITICAL: You MUST write the "details" strictly in Arabic language.`;
      }

       const response = await ai.models.generateContent({
        model: 'gemini-3.0-flash',
        contents: [ prompt ],
        config: { temperature: 0.2 }
       });
       const text = response.text || '';
       const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
       const parsed = JSON.parse(jsonStr);
       const roundedCalories = Math.round(parsed.calories);
       setResult({ calories: roundedCalories, details: parsed.details, unclear: false });
       saveHistory(roundedCalories, parsed.details);
    } catch(err) {
       console.error(err);
       alert(t('scanner.error.calc'));
    } finally {
       setLoading(false);
    }
  }

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
        alert(t('scanner.alert.exceeded').replace('{excess}', String(excess)));
      } else if (sum > settings.targetCalories - 300 && sum <= settings.targetCalories) {
        const remaining = Math.round(settings.targetCalories - sum);
        alert(t('scanner.alert.close').replace('{remaining}', String(remaining)));
      }
    } catch(err) {
      console.error("Failed to check daily calories", err);
    }
  };

  const saveHistory = async (calories: number, details: string) => {
      if (!user) return;
      try {
        await addDoc(collection(db, 'users', user.uid, 'history'), {
          userId: user.uid,
          type: 'food',
          timestamp: Date.now(),
          calories: calories,
          details: details,
          // Omitting imageUrl to save DB space, but we could upload it to storage
        });
        await checkDailyCalories(calories);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/history`);
      }
  }

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 relative z-10 flex flex-col gap-6">
       <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-6">{t('scanner.title')}</h2>

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
              className="border-2 border-dashed border-emerald-500/30 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-500/5 transition-colors group"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform mb-4">
                <Camera size={32} />
              </div>
              <p className="text-slate-300 font-medium mb-1">{t('scanner.upload.title')}</p>
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
                        <span className="text-5xl font-black text-emerald-400 mb-6">{result.calories}</span>
                        
                        <div className="bg-black/30 p-4 rounded-xl text-sm leading-relaxed text-left w-full" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}>
                           <strong className="text-emerald-400 block mb-2">{t('scanner.success.breakdown')}</strong>
                           {result.details}
                        </div>
                    </div>
                )}
             </div>
          )}
       </div>
    </div>
  );
}
