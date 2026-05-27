import React, { useState } from 'react';
import { auth, loginWithGoogle } from '../firebase';
import { Language, translations } from '../translations';
import LanguageSelector from './LanguageSelector';

interface LoginProps {
  lang: Language;
  setLang: (lang: Language) => void;
}

const Login: React.FC<LoginProps> = ({ lang, setLang }) => {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  const t = translations[lang] || translations.he;

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError(lang === 'he' ? 'הפופ-אפ נחסם על ידי הדפדפן. נא אפשר פופ-אפים לאתר זה.' : 'Popup blocked by browser. Please allow popups for this site.');
      } else {
        setError(err.message || String(err));
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setAuthLoading(true);
    setError(null);
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      let errMsg = err.message;
      if (err.code === 'auth/user-not-found') {
        errMsg = lang === 'he' 
          ? 'משתמש לא קיים במערכת. לחץ על "צור חשבון חדש" למטה כדי להירשם.' 
          : 'User not found. Click "Create a new account" below to register.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = lang === 'he' ? 'סיסמה לא נכונה או פרטי גישה שגויים.' : 'Wrong password or invalid credentials.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = lang === 'he' ? 'כתובת אימייל לא תקינה.' : 'Invalid email address.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = lang === 'he'
          ? 'התחברות באימייל וסיסמה אינה מופעלת כעת בקונסולת Firebase. פנה למנהל להפעלתה או השתמש בגוגל.'
          : 'Email/password login is not allowed. Enable it in your Firebase Console or use Google Sign-In.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = lang === 'he' ? 'הסיסמה צריכה להיות באורך 6 תווים לפחות.' : 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = lang === 'he' 
          ? 'כתובת האימייל כבר בשימוש. נסה להתחבר במקום להירשם.' 
          : 'Email is already in use. Try logging in instead of signing up.';
      }
      setError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4" dir={(lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr'}>
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <LanguageSelector currentLang={lang} onSelect={setLang} />
        </div>

        <div className="mb-6 flex justify-center text-center items-center flex-col">
          <svg width="140" height="50" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm mb-4">
            <path d="M40 50L70 10L100 50H40Z" fill="#71717A" fillOpacity="0.8"/>
            <path d="M75 50L105 15L135 50H75Z" fill="#A1A1AA" fillOpacity="0.6"/>
            <path d="M10 50L40 20L70 50H10Z" fill="#3F3F46" fillOpacity="0.9"/>
            <text x="0" y="70" fontFamily="Heebo" fontWeight="800" fontSize="22" fill="#18181B">ארזי הנגב</text>
            <text x="0" y="82" fontFamily="Heebo" fontWeight="500" fontSize="8" fill="#52525B">ייזום ובניה בע"מ</text>
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-blue-900 mb-1">{t.appName}</h1>
        <p className="text-xs text-gray-500 mb-6 uppercase tracking-widest font-bold">{t.appSubName}</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100 text-right">
            ⚠️ {error}
          </div>
        )}

        {/* Email & Password Authentication Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-right">
          <div>
            <label className="text-xs font-black text-gray-400 uppercase px-2 tracking-widest block mb-1">
              {lang === 'he' ? 'אימייל להתחברות' : 'Email Address'}
            </label>
            <input 
              type="email" 
              placeholder="example@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full p-3.5 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-center transition-all bg-slate-50/30 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-black text-gray-400 uppercase px-2 tracking-widest block mb-1">
              {lang === 'he' ? 'סיסמה' : 'Password'}
            </label>
            <input 
              type="password" 
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full p-3.5 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-center transition-all bg-slate-50/30 text-sm"
            />
          </div>

          <button 
            type="submit"
            disabled={authLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black transition-all active:scale-95 shadow-md text-sm cursor-pointer disabled:opacity-50"
          >
            {authLoading ? (lang === 'he' ? 'מתחבר...' : 'Connecting...') : (
              isSignUp 
                ? (lang === 'he' ? 'צור חשבון והיכנס 🚀' : 'Create Account & Sign In 🚀')
                : (lang === 'he' ? 'התחבר עם אימייל 🔑' : 'Sign In with Email 🔑')
            )}
          </button>

          <div className="text-center mt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              {isSignUp 
                ? (lang === 'he' ? 'יש לך כבר חשבון? התחבר כאן' : 'Already have an account? Sign In')
                : (lang === 'he' ? 'אין לך חשבון? צור חשבון חדש כאן' : 'Do not have an account? Sign Up here')
              }
            </button>
          </div>
        </form>

        <div className="relative flex py-3 items-center">
          <div className="flex-grow border-t border-slate-150"></div>
          <span className="flex-shrink mx-4 text-xs font-black text-gray-300 uppercase tracking-widest">
            {lang === 'he' ? 'או' : 'or'}
          </span>
          <div className="flex-grow border-t border-slate-150"></div>
        </div>

        {/* Google Sign-in Alternative */}
        <button 
          onClick={handleGoogleLogin}
          type="button"
          className="w-full mt-4 flex items-center justify-center gap-3 bg-white border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 py-4 rounded-2xl font-black text-gray-700 transition-all active:scale-95 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          {lang === 'he' ? 'התחברות מהירה עם גוגל' : lang === 'ru' ? 'Быстрый вход через Google' : 'تسجيل دخول سريع باستخدام جوجل'}
        </button>
        
        <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
          {t.footerInfo}
        </p>
      </div>
    </div>
  );
};

export default Login;
