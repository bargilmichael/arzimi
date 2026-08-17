
import React from 'react';
import { Language } from '../translations';

interface Props {
  currentLang: Language;
  onSelect: (lang: Language) => void;
  className?: string;
}

const LanguageSelector: React.FC<Props> = ({ currentLang, onSelect, className = "" }) => {
  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'he', label: 'עברית', flag: '🇮🇱' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' }
  ];

  return (
    <div className={`flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200 ${className}`}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onSelect(lang.code)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
            currentLang === lang.code 
              ? 'bg-white text-blue-700 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="mr-1">{lang.flag}</span>
          {lang.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
