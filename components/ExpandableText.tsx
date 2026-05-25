import React, { useState } from 'react';
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
  const t = translations[lang] || translations.he;

  if (!text) return null;

  // Show "Read More" button if text is long or contains newlines
  const hasNewlines = text.includes('\n');
  const isLongText = text.length > 120 || hasNewlines;

  return (
    <div className="space-y-1">
      <p className={`${className} break-words whitespace-pre-wrap ${!isExpanded && isLongText ? 'line-clamp-2 md:line-clamp-3' : ''}`}>
        {text}
      </p>
      {isLongText && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-xs font-black text-blue-600 hover:text-blue-800 transition-colors mt-0.5 focus:outline-none inline-flex items-center gap-1 cursor-pointer"
        >
          {isExpanded ? (t as any).readLess : (t as any).readMore}
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
