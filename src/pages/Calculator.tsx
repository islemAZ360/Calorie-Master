import React, { useState, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, Scale, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const ACTIVITY_LEVELS = [
  { value: 1, label: 'Basal Metabolic Rate (BMR)' },
  { value: 1.2, label: 'Sedentary: little or no exercise' },
  { value: 1.375, label: 'Light: exercise 1-3 times/week' },
  { value: 1.465, label: 'Moderate: exercise 4-5 times/week' },
  { value: 1.55, label: 'Active: daily exercise or intense exercise 3-4 times/week' },
  { value: 1.725, label: 'Very Active: intense exercise 6-7 times/week' },
  { value: 1.9, label: 'Extra Active: very intense daily' },
];

export default function Calculator() {
  const { user } = useAuth();
  const { settings, t } = useSettings();
  const [unitSystem, setUnitSystem] = useState<'us' | 'metric'>('us');
  const [age, setAge] = useState<number | string>(25);
  const [gender, setGender] = useState<'m' | 'f'>('m');
  
  // US units
  const [feet, setFeet] = useState<number | string>(5);
  const [inches, setInches] = useState<number | string>(10);
  const [pounds, setPounds] = useState<number | string>(165);
  
  // Metric units
  const [cm, setCm] = useState<number | string>(180);
  const [kg, setKg] = useState<number | string>(65);

  const [activity, setActivity] = useState<number>(1.465);

  useEffect(() => {
    if (settings) {
      setUnitSystem(settings.unitSystem || 'us');
      setAge(settings.age || 25);
      setGender(settings.gender || 'm');
      setFeet(settings.feet || 5);
      setInches(settings.inches || 10);
      setPounds(settings.pounds || 165);
      setCm(settings.cm || 180);
      setKg(settings.kg || 65);
      setActivity(settings.activity || 1.465);
    }
  }, [settings]);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [formula, setFormula] = useState<'mifflin' | 'harris' | 'katch'>('mifflin');
  const [bodyFat, setBodyFat] = useState<number | string>(20);
  const [resultUnit, setResultUnit] = useState<'calories' | 'kilojoules'>('calories');

  const [results, setResults] = useState<{
    maintain: number;
    loss250: number;
    loss500: number;
    loss1000: number;
    gain250: number;
    gain500: number;
    gain1000: number;
    bmi: number;
    minLimit: number;
    isUnsafe: boolean;
  } | null>(null);

  const calculate = async (e: React.FormEvent) => {
    e.preventDefault();

    let weightInKg = 0;
    let heightInCm = 0;

    if (unitSystem === 'us') {
      heightInCm = ((Number(feet) * 12) + Number(inches)) * 2.54;
      weightInKg = Number(pounds) * 0.45359237;
    } else {
      heightInCm = Number(cm);
      weightInKg = Number(kg);
    }

    let bmr = 0;
    const currentAge = Number(age);

    if (formula === 'mifflin') {
      if (gender === 'm') {
        bmr = (10 * weightInKg) + (6.25 * heightInCm) - (5 * currentAge) + 5;
      } else {
        bmr = (10 * weightInKg) + (6.25 * heightInCm) - (5 * currentAge) - 161;
      }
    } else if (formula === 'harris') {
      if (gender === 'm') {
        bmr = (13.397 * weightInKg) + (4.799 * heightInCm) - (5.677 * currentAge) + 88.362;
      } else {
        bmr = (9.247 * weightInKg) + (3.098 * heightInCm) - (4.330 * currentAge) + 447.593;
      }
    } else if (formula === 'katch') {
      bmr = 370 + (21.6 * (1 - (Number(bodyFat) / 100)) * weightInKg);
    }

    const maintainCalories = bmr * Number(activity);
    
    // Medical minimum limits
    const safeMin = gender === 'm' ? 1500 : 1200;
    const isUnsafe = (maintainCalories - 1000) < safeMin;
    
    const heightInM = heightInCm / 100;
    const bmi = weightInKg / (heightInM * heightInM);

    const calcResults = {
      maintain: maintainCalories,
      loss250: Math.max(maintainCalories - 250, safeMin),
      loss500: Math.max(maintainCalories - 500, safeMin),
      loss1000: Math.max(maintainCalories - 1000, safeMin),
      gain250: maintainCalories + 250,
      gain500: maintainCalories + 500,
      gain1000: maintainCalories + 1000,
      bmi: bmi,
      minLimit: safeMin,
      isUnsafe: isUnsafe,
    };
    
    setResults(calcResults);

    // Save to history if logged in
    if (user) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'history'), {
          userId: user.uid,
          type: 'bmr',
          timestamp: Date.now(),
          calories: Math.round(maintainCalories),
          details: `Formula: ${formula}, BMI: ${bmi.toFixed(1)}`,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/history`);
      }
    }
  };

  const handleSelectPlan = async (plan: 'maintain' | 'loss' | 'extremeLoss' | 'gain', targetCalories: number) => {
    if (!user) {
      toast.error(settings.language === 'ar' ? 'يجب تسجيل الدخول لحفظ الخطة' : 'You must be logged in to save a plan');
      return;
    }

    try {
      await setDoc(doc(db, 'users', user.uid), {
        selectedPlan: plan,
        targetCalories: Math.round(targetCalories)
      }, { merge: true });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });
      toast.success(t('plan.notify.saved'));
    } catch (err) {
      console.error(err);
      toast.error('Failed to save plan');
    }
  };

  const clearForm = () => {
    setAge(25);
    setGender('m');
    setFeet(5);
    setInches(10);
    setPounds(165);
    setCm(180);
    setKg(65);
    setActivity(1.465);
    setResults(null);
  };

  const formatResult = (val: number) => {
    const multiplier = resultUnit === 'kilojoules' ? 4.1868 : 1;
    return Math.round(val * multiplier).toLocaleString('en-US');
  };

  const getPercentage = (val: number) => {
    if (!results) return 100;
    return Math.round((val / results.maintain) * 100);
  };

  const labelSuffix = resultUnit === 'kilojoules' ? 'kJ' : 'Calories';
  const weightUnit = unitSystem === 'us' ? 'lb' : 'kg';
  const valMild = unitSystem === 'us' ? '0.5' : '0.25';
  const valNormal = unitSystem === 'us' ? '1' : '0.5';
  const valExtreme = unitSystem === 'us' ? '2' : '1';

  return (
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Input Panel */}
        <section className="lg:col-span-5 flex flex-col gap-6 w-full">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h2 className="text-xl font-semibold text-white">{t('calculator.personalData')}</h2>
              <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/10">
                <button
                  type="button"
                  className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${unitSystem === 'us' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setUnitSystem('us')}
                >
                  US 
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-sm rounded-md font-bold transition-colors ${unitSystem === 'metric' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setUnitSystem('metric')}
                >
                  Metric
                </button>
              </div>
            </div>
            
            <form onSubmit={calculate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.age')}</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.gender')}</label>
                  <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/10 h-[50px]">
                    <button
                      type="button"
                      onClick={() => setGender('m')}
                      className={`flex-1 rounded-lg font-bold transition-colors ${gender === 'm' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      {t('calculator.male')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('f')}
                      className={`flex-1 rounded-lg font-bold transition-colors ${gender === 'f' ? 'bg-emerald-500 text-zinc-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                      {t('calculator.female')}
                    </button>
                  </div>
                </div>
              </div>

              {unitSystem === 'us' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.height')}</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative" dir="ltr">
                        <input
                          type="number"
                          value={feet}
                          onChange={(e) => setFeet(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner text-left"
                          required
                        />
                        <span className="absolute right-4 top-3 text-slate-500 font-medium">{t('calculator.ft')}</span>
                      </div>
                      <div className="relative" dir="ltr">
                        <input
                          type="number"
                          value={inches}
                          onChange={(e) => setInches(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner text-left"
                          required
                        />
                        <span className="absolute right-4 top-3 text-slate-500 font-medium">{t('calculator.in')}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.weight')}</label>
                    <div className="relative" dir="ltr">
                      <input
                        type="number"
                        value={pounds}
                        onChange={(e) => setPounds(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner text-left"
                        required
                      />
                      <span className="absolute right-4 top-3 text-slate-500 font-medium">{t('calculator.lbs')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.height')}</label>
                    <div className="relative" dir="ltr">
                      <input
                        type="number"
                        value={cm}
                        onChange={(e) => setCm(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner text-left"
                        required
                      />
                      <span className="absolute right-4 top-3 text-slate-500 font-medium">{t('calculator.cm')}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.weight')}</label>
                    <div className="relative" dir="ltr">
                      <input
                        type="number"
                        value={kg}
                        onChange={(e) => setKg(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 pr-12 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner text-left"
                        required
                      />
                      <span className="absolute right-4 top-3 text-slate-500 font-medium">{t('calculator.kg')}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2 pl-1">{t('calculator.activity')}</label>
                <div className="relative">
                  <select
                    value={activity}
                    onChange={(e) => setActivity(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner appearance-none pr-10"
                  >
                    {ACTIVITY_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" size={20} />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center justify-center w-full gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-xl mt-2 outline-none"
                >
                  <Settings size={16} />
                  <span>{t('calculator.advanced')}</span>
                  {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                
                {showSettings && (
                  <div className="mt-4 p-5 bg-black/30 border border-white/5 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-3">
                      <span className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">{t('calculator.formula')}</span>
                      <label className="flex items-center space-x-3 text-sm cursor-pointer text-slate-300 hover:text-white transition-colors">
                        <input type="radio" value="mifflin" checked={formula === 'mifflin'} onChange={() => setFormula('mifflin')} className="w-4 h-4 text-emerald-500 bg-zinc-900 border-white/10 focus:ring-emerald-500 focus:ring-offset-zinc-900" />
                        <span>Mifflin-St Jeor (Recommended)</span>
                      </label>
                      <label className="flex items-center space-x-3 text-sm cursor-pointer text-slate-300 hover:text-white transition-colors">
                        <input type="radio" value="harris" checked={formula === 'harris'} onChange={() => setFormula('harris')} className="w-4 h-4 text-emerald-500 bg-zinc-900 border-white/10 focus:ring-emerald-500 focus:ring-offset-zinc-900" />
                        <span>Revised Harris-Benedict</span>
                      </label>
                      <label className="flex items-center space-x-3 text-sm cursor-pointer text-slate-300 hover:text-white transition-colors">
                        <input type="radio" value="katch" checked={formula === 'katch'} onChange={() => setFormula('katch')} className="w-4 h-4 text-emerald-500 bg-zinc-900 border-white/10 focus:ring-emerald-500 focus:ring-offset-zinc-900" />
                        <span>Katch-McArdle</span>
                      </label>
                      
                      {formula === 'katch' && (
                        <div className="pl-7 pt-2 relative">
                          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Body Fat %</label>
                          <input type="number" min="1" max="90" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-white transition-colors shadow-inner" />
                          <span className="absolute right-3 bottom-2 text-slate-500 text-sm">%</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3 pt-4 border-t border-white/5">
                      <span className="text-xs uppercase tracking-wider text-slate-500 mb-2 block">{t('calculator.energy')}</span>
                      <div className="flex space-x-6">
                         <label className="flex items-center space-x-3 text-sm cursor-pointer text-slate-300 hover:text-white transition-colors">
                          <input type="radio" checked={resultUnit === 'calories'} onChange={() => setResultUnit('calories')} className="w-4 h-4 text-emerald-500 bg-zinc-900 border-white/10 focus:ring-emerald-500 focus:ring-offset-zinc-900" />
                          <span>Calories</span>
                         </label>
                         <label className="flex items-center space-x-3 text-sm cursor-pointer text-slate-300 hover:text-white transition-colors">
                          <input type="radio" checked={resultUnit === 'kilojoules'} onChange={() => setResultUnit('kilojoules')} className="w-4 h-4 text-emerald-500 bg-zinc-900 border-white/10 focus:ring-emerald-500 focus:ring-offset-zinc-900" />
                          <span>Kilojoules</span>
                         </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-2xl shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 mt-6 outline-none"
              >
                <span>{t('calculator.update')}</span>
              </button>
              
              <button
                type="button"
                onClick={clearForm}
                className="w-full bg-transparent hover:bg-white/5 text-slate-400 font-medium py-3 rounded-xl border border-transparent transition-colors outline-none"
              >
                {t('calculator.reset')}
              </button>
            </form>
          </div>
        </section>

        {/* Results Panel */}
        <section className="lg:col-span-7 flex flex-col gap-6 w-full h-full">
          {results ? (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex-1 shadow-2xl backdrop-blur-sm flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
              <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">{t('calculator.results.title')}</h2>
                  <p className="text-slate-400 text-sm">{t('calculator.results.subtitle')}</p>
                </div>
                <div className="flex flex-col items-end gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-xs font-bold border border-emerald-500/20 uppercase tracking-widest hidden sm:block w-max">
                    Computed
                  </div>
                  {results.bmi && (
                    <div className="w-full sm:w-48 mt-2 sm:mt-0 items-end flex flex-col">
                      <div className="text-xs text-slate-400 font-medium mb-1">
                        BMI: <span className={`font-bold ${results.bmi < 18.5 ? 'text-blue-400' : results.bmi < 25 ? 'text-emerald-400' : results.bmi < 30 ? 'text-amber-400' : 'text-rose-500'}`}>{results.bmi.toFixed(1)}</span>
                        <span className="ml-1 text-slate-500">
                           {results.bmi < 18.5 ? '(Underweight)' : results.bmi < 25 ? '(Normal)' : results.bmi < 30 ? '(Overweight)' : '(Obese)'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 flex rounded-full overflow-hidden bg-white/5 relative mt-1">
                         <div className="h-full bg-blue-500" style={{width: '20%'}}></div>
                         <div className="h-full bg-emerald-500" style={{width: '30%'}}></div>
                         <div className="h-full bg-amber-500" style={{width: '20%'}}></div>
                         <div className="h-full bg-rose-500" style={{width: '30%'}}></div>
                         <div 
                           className="absolute top-0 h-full w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
                           style={{ 
                             left: `${Math.min(Math.max((results.bmi - 12) / (40 - 12) * 100, 0), 100)}%`,
                             marginLeft: '-2px'
                           }}
                         />
                      </div>
                      <div className="flex justify-between w-full text-[9px] text-slate-600 mt-1 font-medium">
                         <span>12</span>
                         <span>40+</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {results.isUnsafe && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex gap-3 text-amber-200/80 text-sm leading-relaxed">
                  <div className="text-amber-400 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  </div>
                  <p>
                    <strong className="text-amber-400 font-semibold block mb-1">Medical Safety Warning</strong>
                    Calorie values lower than {results.minLimit} are considered potentially unsafe and are difficult to meet nutritional needs safely. Deficit targets have been clamped to this safe minimum.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 flex-1">
                {/* Maintain Weight */}
                <div className="bg-white/5 border-l-4 border-emerald-500 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 group hover:bg-white/10 transition-colors">
                  <div>
                     <p className="text-slate-400 text-sm font-medium">{t('calculator.results.maintain')}</p>
                     <h3 className="text-white font-bold text-lg">Balance level</h3>
                     <button type="button" onClick={() => handleSelectPlan('maintain', results.maintain)} className={`mt-3 text-xs md:text-sm font-bold whitespace-nowrap px-4 py-2 rounded-full transition-colors ${settings.selectedPlan === 'maintain' ? 'bg-emerald-500 text-zinc-950' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                       {settings.selectedPlan === 'maintain' ? t('plan.selected') : t('plan.select')}
                     </button>
                  </div>
                  <div className="w-full sm:w-auto flex items-baseline justify-end sm:justify-end gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tighter tabular-nums">{formatResult(results.maintain)}</span>
                    <span className="text-emerald-400/60 text-sm font-medium">{labelSuffix} / {t('calculator.results.day')}</span>
                    <span className="text-xs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded ml-2">100%</span>
                  </div>
                </div>

                {/* Weight Loss */}
                <div className="bg-white/5 border-l-4 border-blue-500 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 group hover:bg-white/10 transition-colors">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">{t('calculator.results.loss')} ({valNormal} {weightUnit}/{t('calculator.results.week')})</p>
                    <h3 className="text-white font-bold text-lg">Moderate Deficit</h3>
                     <button type="button" onClick={() => handleSelectPlan('loss', results.loss500)} className={`mt-3 text-xs md:text-sm font-bold whitespace-nowrap px-4 py-2 rounded-full transition-colors ${settings.selectedPlan === 'loss' ? 'bg-blue-500 text-zinc-950' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                       {settings.selectedPlan === 'loss' ? t('plan.selected') : t('plan.select')}
                     </button>
                  </div>
                  <div className="w-full sm:w-auto flex items-baseline justify-end sm:justify-end gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-blue-400 tracking-tighter tabular-nums">{formatResult(results.loss500)}</span>
                    <span className="text-blue-400/60 text-sm font-medium">{labelSuffix} / {t('calculator.results.day')}</span>
                    <span className="text-xs text-blue-500 font-bold bg-blue-500/10 px-2 py-1 rounded ml-2">{getPercentage(results.loss500)}%</span>
                  </div>
                </div>

                {/* Extreme Weight Loss */}
                <div className="bg-white/5 border-l-4 border-amber-500 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 group hover:bg-white/10 transition-colors">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">{t('calculator.results.extremeLoss')} ({valExtreme} {weightUnit}/{t('calculator.results.week')})</p>
                    <h3 className="text-white font-bold text-lg">Aggressive Deficit</h3>
                     <button type="button" onClick={() => handleSelectPlan('extremeLoss', results.loss1000)} className={`mt-3 text-xs md:text-sm font-bold whitespace-nowrap px-4 py-2 rounded-full transition-colors ${settings.selectedPlan === 'extremeLoss' ? 'bg-amber-500 text-zinc-950' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                       {settings.selectedPlan === 'extremeLoss' ? t('plan.selected') : t('plan.select')}
                     </button>
                  </div>
                  <div className="w-full sm:w-auto flex items-baseline justify-end sm:justify-end gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tighter tabular-nums">{formatResult(results.loss1000)}</span>
                    <span className="text-amber-400/60 text-sm font-medium">{labelSuffix} / {t('calculator.results.day')}</span>
                    <span className="text-xs text-amber-500 font-bold bg-amber-500/10 px-2 py-1 rounded ml-2">{getPercentage(results.loss1000)}%</span>
                  </div>
                </div>

                {/* Weight Gain Grid */}
                <div className="bg-white/5 border-l-4 border-rose-500 p-6 rounded-2xl flex flex-col gap-5 group hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start">
                     <div>
                       <p className="text-slate-400 text-sm font-medium">{t('calculator.results.gain')}</p>
                       <h3 className="text-white font-bold text-lg">Building Surplus</h3>
                     </div>
                     <button type="button" onClick={() => handleSelectPlan('gain', results.gain500)} className={`mt-1 text-xs md:text-sm font-bold whitespace-nowrap px-4 py-2 rounded-full transition-colors ${settings.selectedPlan === 'gain' ? 'bg-rose-500 text-zinc-950' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                       {settings.selectedPlan === 'gain' ? t('plan.selected') : t('plan.select')}
                     </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:gap-4 mt-2 border-t border-white/5 pt-4">
                     <div className="text-center bg-black/20 rounded-xl p-3 border border-white/5">
                       <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">{valMild} {weightUnit}/wk</div>
                       <div className="text-rose-400 font-bold sm:text-lg tabular-nums flex flex-col items-center">
                         <span>{formatResult(results.gain250)}</span>
                         <span className="text-[10px] text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded mt-1">{getPercentage(results.gain250)}%</span>
                       </div>
                     </div>
                     <div className="text-center bg-black/20 rounded-xl p-3 border border-white/5 ring-1 ring-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                       <div className="text-[10px] sm:text-xs text-rose-300/80 uppercase tracking-wider mb-1 font-semibold">{valNormal} {weightUnit}/wk</div>
                       <div className="text-rose-400 font-black text-lg sm:text-xl tabular-nums flex flex-col items-center">
                         <span>{formatResult(results.gain500)}</span>
                         <span className="text-[10px] text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded mt-1">{getPercentage(results.gain500)}%</span>
                       </div>
                     </div>
                     <div className="text-center bg-black/20 rounded-xl p-3 border border-white/5">
                       <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">{valExtreme} {weightUnit}/wk</div>
                       <div className="text-rose-400 font-bold sm:text-lg tabular-nums flex flex-col items-center">
                         <span>{formatResult(results.gain1000)}</span>
                         <span className="text-[10px] text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded mt-1">{getPercentage(results.gain1000)}%</span>
                       </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-12 flex-1 flex flex-col items-center justify-center shadow-2xl backdrop-blur-sm text-center border-dashed border-white/20 h-full min-h-[400px]">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-6 shadow-inner">
                <Activity size={40} strokeWidth={1} className="text-emerald-500/40" />
              </div>
              <h3 className="text-2xl font-semibold text-white mb-3">{t('calculator.empty.title')}</h3>
              <p className="text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
                {t('calculator.empty.desc')}
              </p>
            </div>
          )}
        </section>
      </motion.main>
  );
}
