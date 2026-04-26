import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export interface UserSettings {
  geminiApiKey: string;
  language: 'en' | 'ar';
  age: string | number;
  gender: 'm' | 'f';
  unitSystem: 'us' | 'metric';
  feet: string | number;
  inches: string | number;
  pounds: string | number;
  cm: string | number;
  kg: string | number;
  activity: number;
  selectedPlan?: 'maintain' | 'loss' | 'extremeLoss' | 'gain' | null;
  targetCalories?: number | null;
}

export const defaultSettings: UserSettings = {
  geminiApiKey: '',
  language: 'en',
  age: 25,
  gender: 'm',
  unitSystem: 'metric',
  feet: 5,
  inches: 10,
  pounds: 165,
  cm: 180,
  kg: 70,
  activity: 1.465,
  selectedPlan: null,
  targetCalories: null,
};

interface SettingsContextType {
  settings: UserSettings;
  t: (key: string) => string;
}

const translations: Record<'en' | 'ar', Record<string, string>> = {
  en: {
    'nav.autocalc': 'AutoCalc',
    'nav.scanner': 'Scanner',
    'nav.history': 'History',
    'nav.profile': 'Profile',
    'nav.login': 'Login',
    'app.tagline': 'Accurate tracking & analysis',
    'scanner.title': 'AI Food Scanner',
    'scanner.mode.meal': 'Prepared Meal',
    'scanner.mode.ingredients': 'Raw Ingredients',
    'scanner.upload.title': 'Take a photo or upload an image',
    'scanner.upload.desc': 'Click to browse files',
    'scanner.action.retake': 'Retake',
    'scanner.action.analyze.meal': 'Analyze Meal',
    'scanner.action.analyze.ingredients': 'Analyze Ingredients',
    'scanner.loading': 'Our AI is analyzing your food...',
    'scanner.unclear.title': 'Image is unclear',
    'scanner.unclear.desc': 'We couldn\'t clearly identify the ingredients from the photo. Please list them manually below for an accurate calculation.',
    'scanner.unclear.placeholder': 'E.g. 2 eggs, 1 slice of bread, 100g of chicken breast...',
    'scanner.unclear.button': 'Calculate manually',
    'scanner.success.title': 'Estimated Calories',
    'scanner.success.breakdown': 'Breakdown:',
    'scanner.error.analyze': 'Failed to analyze image. Please check your API key in Profile.',
    'scanner.error.calc': 'Failed to calculate calories. Please check your API key in Profile.',
    'scanner.extra.toggle': 'Add extra details (optional)',
    'scanner.extra.placeholder': 'Any ingredients, weight, or cooking methods to help AI...',
    'history.title': 'Your History',
    'history.empty.title': 'No history recorded yet.',
    'history.empty.desc': 'Calculate your BMR or scan foods to see them here.',
    'history.action.calc': 'Go to Calculator',
    'history.action.scan': 'Try Scanner',
    'history.item.bmr': 'BMR Analysis',
    'history.item.food': 'Food Scan',
    'history.calories': 'Calories',
    'login.title.login': 'Welcome Back',
    'login.title.signup': 'Create Account',
    'login.label.email': 'Email',
    'login.label.password': 'Password',
    'login.action.login': 'Login',
    'login.action.signup': 'Sign Up',
    'login.toggle.toSignup': 'Don\'t have an account? Sign up',
    'login.toggle.toLogin': 'Already have an account? Login',
    'profile.title': 'Profile',
    'profile.api.title': 'Gemini Flash 3 API Configuration',
    'profile.api.desc': 'Connect your Google Gemini Flash API key to enable the AI Food Scanner. Your key is stored securely in your profile.',
    'profile.api.verify': 'Verify Key',
    'profile.lang.title': 'Interface Settings',
    'profile.lang.label': 'Language',
    'profile.health.title': 'Default Health Profile',
    'profile.health.desc': 'Set your default values to automatically populate the calculator.',
    'profile.health.unit': 'Unit System',
    'profile.action.save': 'Save Profile Preferences',
    'profile.analysis.title': 'History Analysis',
    'profile.analysis.desc': 'Analyze your recorded data to see if you are on track with your goals.',
    'profile.analysis.math': 'Standard Analysis',
    'profile.analysis.ai': 'AI Insights',
    'profile.analysis.loading': 'Analyzing your data...',
    'profile.analysis.error.noPlan': 'Please select a plan in the Calculator first to compare.',
    'profile.analysis.error.noData': 'Not enough data to analyze. Scan some food first!',
    'profile.analysis.error.api': 'AI Analysis failed. Check your API key.',
    'plan.select': 'Select Plan',
    'plan.selected': 'Selected Plan',
    'plan.notify.saved': 'Plan saved successfully!',
    'profile.weight.positive.loss': 'Great job! You lost weight, which aligns with your weight loss plan.',
    'profile.weight.negative.loss': 'You gained weight. Don\'t give up, stick to your weight loss plan!',
    'profile.weight.positive.gain': 'Great job! You gained weight, which aligns with your weight gain plan.',
    'profile.weight.negative.gain': 'You lost weight. Make sure to eat more to meet your weight gain plan!',
    'profile.weight.neutral': 'Weight didn\'t change significantly.',
    'scanner.alert.exceeded': 'Warning: This meal puts you over your daily calorie limit by {excess} kcal!',
    'scanner.alert.close': 'You are getting close to your daily limit. ({remaining} kcal left)',
    'history.progress.title': 'Daily Progress',
    'history.progress.target': 'Target:',
    'history.progress.consumed': 'Consumed:',
    'history.progress.remaining': 'Remaining:',
    'history.progress.tip.onTrack': 'You are on track! Keep it up.',
    'history.progress.tip.over': 'You have exceeded your daily limit. Try to be more active!',
    'history.progress.tip.low': 'You have plenty of calories left for the day.',
    'history.action.delete': 'Delete entry',
    'history.date.today': 'Today',
    'history.date.yesterday': 'Yesterday',
    'calculator.personalData': 'Personal Data',
    'calculator.ft': 'ft',
    'calculator.in': 'in',
    'calculator.lbs': 'lbs',
    'calculator.cm': 'cm',
    'calculator.kg': 'kg',
    'calculator.age': 'Age',
    'calculator.gender': 'Gender',
    'calculator.male': 'Male',
    'calculator.female': 'Female',
    'calculator.height': 'Height',
    'calculator.weight': 'Weight',
    'calculator.activity': 'Activity Level',
    'calculator.advanced': 'Advanced Settings',
    'calculator.formula': 'BMR Formula',
    'calculator.energy': 'Energy Units',
    'calculator.update': 'Update Results',
    'calculator.reset': 'Reset Default Values',
    'calculator.results.title': 'Analysis Results',
    'calculator.results.subtitle': 'Suggested daily energy needs for your goals',
    'calculator.results.day': 'day',
    'calculator.results.week': 'week',
    'calculator.results.maintain': 'Maintain weight',
    'calculator.results.loss': 'Weight loss',
    'calculator.results.extremeLoss': 'Extreme loss',
    'calculator.results.gain': 'Weight gain',
    'calculator.empty.title': 'Ready to calculate',
    'calculator.empty.desc': 'Fill out your personal data and hit Update Results'
  },
  ar: {
    'nav.autocalc': 'الحاسبة',
    'nav.scanner': 'الماسح الضوئي',
    'nav.history': 'السجل',
    'nav.profile': 'الملف الشخصي',
    'nav.login': 'تسجيل الدخول',
    'app.tagline': 'تتبع وتحليل دقيق',
    'scanner.title': 'الماسح الضوئي الذكي للطعام',
    'scanner.mode.meal': 'وجبة جاهزة',
    'scanner.mode.ingredients': 'مكونات خام',
    'scanner.upload.title': 'التقط صورة أو ارفع صورة',
    'scanner.upload.desc': 'انقر لتصفح الملفات',
    'scanner.action.retake': 'إعادة الالتقاط',
    'scanner.action.analyze.meal': 'تحليل الوجبة',
    'scanner.action.analyze.ingredients': 'تحليل المكونات',
    'scanner.loading': 'الذكاء الاصطناعي يقوم بتحليل طعامك...',
    'scanner.unclear.title': 'الصورة غير واضحة',
    'scanner.unclear.desc': 'لم نتمكن من التعرف بوضوح على المكونات من الصورة. يرجى إدراجها يدوياً أدناه للحصول على حساب دقيق.',
    'scanner.unclear.placeholder': 'مثال: بيضتان، شريحة خبز، 100 جرام صدر دجاج...',
    'scanner.unclear.button': 'احسب يدوياً',
    'scanner.success.title': 'السعرات الحرارية المقدرة',
    'scanner.success.breakdown': 'التفاصيل:',
    'scanner.error.analyze': 'فشل في تحليل الصورة. يرجى التحقق من مفتاح API الخاص بك في الملف الشخصي.',
    'scanner.error.calc': 'فشل في حساب السعرات الحرارية. يرجى التحقق من مفتاح API الخاص بك في الملف الشخصي.',
    'scanner.extra.toggle': 'إضافة تفاصيل إضافية (اختياري)',
    'scanner.extra.placeholder': 'أي مكونات، وزن، أو طرق طهي لمساعدة الذكاء الاصطناعي...',
    'history.title': 'سجلك',
    'history.empty.title': 'لم يتم تسجيل أي تفاصيل في السجل بعد.',
    'history.empty.desc': 'احسب معدل الأيض الأساسي أو افحص الأطعمة لرؤيتها هنا.',
    'history.action.calc': 'اذهب إلى الحاسبة',
    'history.action.scan': 'جرب الماسح الضوئي',
    'history.item.bmr': 'تحليل معدل الأيض الأساسي',
    'history.item.food': 'فحص طعام',
    'history.calories': 'سعرات',
    'login.title.login': 'مرحباً بعودتك',
    'login.title.signup': 'إنشاء حساب',
    'login.label.email': 'البريد الإلكتروني',
    'login.label.password': 'كلمة المرور',
    'login.action.login': 'تسجيل الدخول',
    'login.action.signup': 'إنشاء حساب',
    'login.toggle.toSignup': 'ليس لديك حساب؟ إنشاء حساب',
    'login.toggle.toLogin': 'لديك حساب بالفعل؟ تسجيل الدخول',
    'profile.title': 'الملف الشخصي',
    'profile.api.title': 'إعدادات مفتاح الذكاء الاصطناعي (Gemini Flash 3)',
    'profile.api.desc': 'اربط مفتاح Google Gemini Flash الخاص بك لتفعيل الماسح الضوئي الذكي للطعام. يتم حفظ مفتاحك بشكل آمن في ملفك الشخصي.',
    'profile.api.verify': 'التحقق من المفتاح',
    'profile.lang.title': 'إعدادات الواجهة',
    'profile.lang.label': 'اللغة',
    'profile.health.title': 'البيانات الصحية الافتراضية',
    'profile.health.desc': 'قم بتعيين قيمك الافتراضية لملء الحاسبة تلقائياً.',
    'profile.health.unit': 'نظام الوحدات',
    'profile.action.save': 'حفظ تفضيلات الملف الشخصي',
    'profile.analysis.title': 'تحليل السجل',
    'profile.analysis.desc': 'حلل بياناتك المسجلة لترى ما إذا كنت تسير على الطريق الصحيح نحو أهدافك.',
    'profile.analysis.math': 'التحليل القياسي',
    'profile.analysis.ai': 'تحليل الذكاء الاصطناعي',
    'profile.analysis.loading': 'جاري تحليل بياناتك...',
    'profile.analysis.error.noPlan': 'يرجى تحديد خطة في الحاسبة أولاً للمقارنة.',
    'profile.analysis.error.noData': 'لا توجد بيانات كافية للتحليل. قم بمسح بعض الطعام أولاً!',
    'profile.analysis.error.api': 'فشل تحليل الذكاء الاصطناعي. تحقق من مفتاح API الخاص بك.',
    'plan.select': 'اختيار الخطة',
    'plan.selected': 'الخطة المختارة',
    'plan.notify.saved': 'تم حفظ الخطة بنجاح!',
    'profile.weight.positive.loss': 'عمل رائع! لقد فقدت بعض الوزن، وهذا يتماشى مع خطتك لخسارة الوزن.',
    'profile.weight.negative.loss': 'لقد زاد وزنك. لا تستسلم، التزم بخطتك لخسارة الوزن!',
    'profile.weight.positive.gain': 'عمل رائع! لقد زاد وزنك، وهذا يتماشى مع خطتك لزيادة الوزن.',
    'profile.weight.negative.gain': 'لقد فقدت بعض الوزن. تأكد من تناول المزيد لتحقيق خطتك لزيادة الوزن!',
    'profile.weight.neutral': 'لم يتغير الوزن بشكل ملحوظ.',
    'scanner.alert.exceeded': 'تنبيه: هذه الوجبة تجعلك تتجاوز الحد اليومي للسعرات الحرارية بمقدار {excess} سعرة!',
    'scanner.alert.close': 'أنت تقترب من الحد اليومي الخاص بك. (متبقي {remaining} سعرة)',
    'history.progress.title': 'التقدم اليومي',
    'history.progress.target': 'الهدف:',
    'history.progress.consumed': 'الاستهلاك:',
    'history.progress.remaining': 'المتبقي:',
    'history.progress.tip.onTrack': 'أنت على الطريق الصحيح! استمر.',
    'history.progress.tip.over': 'لقد تجاوزت الحد اليومي. حاول أن تكون أكثر نشاطاً اليوم!',
    'history.progress.tip.low': 'لديك الكثير من السعرات الحرارية المتبقية لليوم.',
    'history.action.delete': 'حذف الإدخال',
    'history.date.today': 'اليوم',
    'history.date.yesterday': 'أمس',
    'calculator.personalData': 'البيانات الشخصية',
    'calculator.ft': 'قدم',
    'calculator.in': 'بوصة',
    'calculator.lbs': 'رطل',
    'calculator.cm': 'سم',
    'calculator.kg': 'كجم',
    'calculator.age': 'العمر',
    'calculator.gender': 'الجنس',
    'calculator.male': 'ذكر',
    'calculator.female': 'أنثى',
    'calculator.height': 'الطول',
    'calculator.weight': 'الوزن',
    'calculator.activity': 'مستوى النشاط',
    'calculator.advanced': 'إعدادات متقدمة',
    'calculator.formula': 'معادلة معدل الأيض',
    'calculator.energy': 'وحدات الطاقة',
    'calculator.update': 'تحديث النتائج',
    'calculator.reset': 'إعادة تعيين التحديثات الافتراضية',
    'calculator.results.title': 'نتائج التحليل',
    'calculator.results.subtitle': 'احتياجات الطاقة اليومية المقترحة لأهدافك',
    'calculator.results.day': 'يوم',
    'calculator.results.week': 'أسبوع',
    'calculator.results.maintain': 'الحفاظ على الوزن',
    'calculator.results.loss': 'خسارة الوزن',
    'calculator.results.extremeLoss': 'خسارة شديدة للوزن',
    'calculator.results.gain': 'زيادة الوزن',
    'calculator.empty.title': 'جاهز للحساب',
    'calculator.empty.desc': 'املأ بياناتك الشخصية واضغط على تحديث النتائج للحصول على حساب دقيق.'
  }
};

const SettingsContext = createContext<SettingsContextType>({ 
  settings: defaultSettings,
  t: (key) => key
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    if (!user) {
      setSettings(defaultSettings);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() });
      }
    });
    return () => unsub();
  }, [user]);

  const t = (key: string) => {
    return translations[settings.language]?.[key] || key;
  };

  return (
    <SettingsContext.Provider value={{ settings, t }}>
      <div dir={settings.language === 'ar' ? 'rtl' : 'ltr'} className={settings.language === 'ar' ? 'font-arabic' : ''}>
        {children}
      </div>
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
