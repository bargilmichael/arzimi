import React, { useState, useEffect } from 'react';
import { Language, translations } from '../translations';

interface ExpandableTextProps {
  text: string;
  lang: Language;
  className?: string;
  defaultClamped?: boolean;
}

const ExpandableText: React.FC<ExpandableTextProps> = ({ 
  text, 
  lang, 
  className = "text-sm text-gray-600 leading-tight",
  defaultClamped = true 
}) => {
  const [isExpanded, setIsExpanded] = useState(!defaultClamped);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const t = translations[lang] || translations.he;

  // Reset translation if original text changes
  useEffect(() => {
    setTranslatedText(null);
  }, [text]);

  // Trigger translation based on API route
  const handleTranslate = async () => {
    if (!text || !text.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          targetLanguage: lang,
        }),
      });
      if (!response.ok) {
        throw new Error('Translation route failed');
      }
      const data = await response.json();
      if (data.translation) {
        setTranslatedText(data.translation);
      }
    } catch (err) {
      console.error('Failed to translate log text:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  if (!text) return null;

  // Show "Read More" button if text is long or contains newlines
  const hasNewlines = text.includes('\n');
  const isLongText = text.length > 120 || hasNewlines;
  const displayText = translatedText || text;

  // Detect whether the language is hebrew or we should show translate button
  // Typically original is written in Hebrew, so if target is ru or ar, provide helper Translation button.
  const showTranslateButton = text && text.trim().length > 0 && !translatedText && !isTranslating && (lang !== 'he');

  return (
    <div className="space-y-1">
      <p className={`${className} break-words whitespace-pre-wrap ${!isExpanded && isLongText ? 'line-clamp-2 md:line-clamp-3' : ''}`}>
        {displayText}
      </p>
      
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {isLongText && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-xs font-black text-blue-600 hover:text-blue-800 transition-colors focus:outline-none inline-flex items-center gap-1 cursor-pointer"
          >
            {isExpanded ? (t as any).readLess : (t as any).readMore}
          </button>
        )}

        {showTranslateButton && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleTranslate();
            }}
            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-all focus:outline-none flex items-center gap-1 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-100 px-2 py-0.5 rounded-full cursor-pointer shadow-sm"
          >
            <span>✨</span>
            {lang === 'he' ? 'תרגם עם AI' : lang === 'ru' ? 'Перевести с AI' : 'ترجمة بالذكاء الاصטناعي'}
          </button>
        )}

        {isTranslating && (
          <span className="text-[10px] font-black text-indigo-500 animate-pulse flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            <span className="inline-block animate-spin h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full" />
            {lang === 'he' ? 'מבוצע תרגום...' : lang === 'ru' ? 'Перевод...' : 'جاري الترجمة...'}
          </span>
        )}

        {translatedText && (
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
            <span>✓</span> {lang === 'he' ? 'תורגם' : lang === 'ru' ? 'Переведено' : 'مترجم'}
          </span>
        )}
      </div>
    </div>
  );
};

export default ExpandableText;
