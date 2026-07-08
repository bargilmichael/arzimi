import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Language, translations } from '../translations';
import { getHebrewProfession } from '../services/smsService';

interface Props {
  lang: Language;
}

export const SettingsView: React.FC<Props> = ({ lang }) => {
  const [template, setTemplate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Preview states
  const [previewName, setPreviewName] = useState<string>('ישראל ישראלי');
  const [previewBuilding, setPreviewBuilding] = useState<string>('5');
  const [previewUnit, setPreviewUnit] = useState<string>('12');
  const [previewDate, setPreviewDate] = useState<string>('15/07/2026');
  const [previewProfession, setPreviewProfession] = useState<string>('electrician');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const defaultTemplate = "שלום {שם_דייר}, תזכורת ממחלקת בדק שמחר בתאריך {תאריך} מתואם להגיע אליך {בעל_מקצוע} לבניין {בניין}, דירה {דירה}. אנא ודא זמינות.";

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'settings', 'smsTemplate'), (snap) => {
      if (snap.exists()) {
        setTemplate(snap.data().template || defaultTemplate);
      } else {
        setTemplate(defaultTemplate);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error loading template:", err);
      setTemplate(defaultTemplate);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'smsTemplate'), { template });
      showToast(lang === 'he' ? 'הגדרות תבנית ה-SMS נשמרו בהצלחה!' : 'SMS Template settings saved successfully!', 'success');
    } catch (err: any) {
      console.error("Error saving template:", err);
      showToast(lang === 'he' ? 'שגיאה בשמירת התבנית' : 'Error saving template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = template;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newTemplate = before + variable + after;
    setTemplate(newTemplate);

    // Reset cursor position after insert
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 10);
  };

  const getPreviewMessage = () => {
    const selectedProfession = getHebrewProfession(previewProfession);
    return template
      .replace(/{שם_דייר}/g, previewName || 'דייר')
      .replace(/{תאריך}/g, previewDate || 'מחר')
      .replace(/{בעל_מקצוע}/g, selectedProfession)
      .replace(/{בניין}/g, previewBuilding || '1')
      .replace(/{דירה}/g, previewUnit || '1');
  };

  const variables = [
    { tag: '{שם_דייר}', label: lang === 'he' ? 'שם דייר' : 'Tenant Name', desc: 'שם הדייר בדירה' },
    { tag: '{בניין}', label: lang === 'he' ? 'מספר בניין' : 'Building No.', desc: 'מספר הבניין של הדירה' },
    { tag: '{דירה}', label: lang === 'he' ? 'מספר דירה' : 'Apartment No.', desc: 'מספר הדירה' },
    { tag: '{תאריך}', label: lang === 'he' ? 'תאריך תיאום' : 'Date', desc: 'תאריך התיאום מחר' },
    { tag: '{בעל_מקצוע}', label: lang === 'he' ? 'בעל מקצוע' : 'Profession', desc: 'סוג בעל המקצוע המתואם (חשמלאי, אינסטלטור, וכו\')' },
  ];

  const professions = [
    { id: 'plumbing', label: 'אינסטלטור (אינסטלציה)' },
    { id: 'electrician', label: 'חשמלאי (חשמל)' },
    { id: 'rappelling', label: 'איש סנפלינג (סנפלינג)' },
    { id: 'general', label: 'גמרים (פועלים / מנהל עבודה)' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl mt-4 animate-in fade-in duration-300">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-black shadow-2xl z-50 transition-all animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-6">
        <span className="text-4xl bg-blue-50 p-3 rounded-2xl">⚙️</span>
        <div className="text-right">
          <h2 className="text-2xl font-black text-slate-800">
            {lang === 'he' ? 'הגדרות תבנית SMS' : 'SMS Template Settings'}
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
            {lang === 'he' ? 'ניהול תבניות הודעות אוטומטיות ותגיות דינמיות' : 'Manage automatic message templates and dynamic tags'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template Editor */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
              {lang === 'he' ? 'נוסח הודעת ה-SMS' : 'SMS Message Body'}
            </label>
            <textarea
              ref={textareaRef}
              rows={5}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none transition-all leading-relaxed resize-y"
              dir="rtl"
              placeholder={defaultTemplate}
            />
          </div>

          {/* Quick Insert Variables */}
          <div className="bg-blue-50/40 border border-blue-100/50 rounded-2xl p-4">
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest block mb-2">
              {lang === 'he' ? 'לחץ להוספת תגית דינמית במיקום הסמן:' : 'Click to insert dynamic tag at cursor:'}
            </span>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button
                  key={v.tag}
                  onClick={() => insertVariable(v.tag)}
                  className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200/60 hover:border-blue-400 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center gap-1"
                  title={v.desc}
                >
                  <span className="text-[10px] text-blue-400 font-normal">➕</span>
                  {v.label}
                  <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono select-all ml-1">
                    {v.tag}
                  </code>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-3 leading-normal">
              {lang === 'he' 
                ? '* התגיות יוחלפו בערכים האמיתיים של המשימה והדירה בעת השליחה.' 
                : '* Tags will be replaced with real task and unit data upon sending.'}
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white hover:bg-blue-700 px-8 py-3.5 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50 min-w-[140px]"
            >
              {saving ? (
                <span className="flex items-center gap-1.5 justify-center">
                  <span className="animate-spin">⏳</span>
                  {lang === 'he' ? 'שומר...' : 'Saving...'}
                </span>
              ) : (
                <span>{lang === 'he' ? 'שמור תבנית 💾' : 'Save Template 💾'}</span>
              )}
            </button>
            <button
              onClick={() => {
                if (confirm(lang === 'he' ? 'האם לשחזר את תבנית ברירת המחדל?' : 'Reset to default template?')) {
                  setTemplate(defaultTemplate);
                }
              }}
              className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-6 py-3.5 rounded-xl font-black text-xs transition-all active:scale-95"
            >
              {lang === 'he' ? 'שחזר ברירת מחדל' : 'Reset Default'}
            </button>
          </div>
        </div>

        {/* Preview Section */}
        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5 flex flex-col gap-4">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            📱 {lang === 'he' ? 'תצוגה מקדימה (סימולציה)' : 'Live Preview (Simulation)'}
          </span>

          <div className="flex flex-col gap-3 text-right">
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">{lang === 'he' ? 'שם דייר' : 'Tenant'}</label>
              <input
                type="text"
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                className="w-full bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">{lang === 'he' ? 'בניין' : 'Building'}</label>
                <input
                  type="text"
                  value={previewBuilding}
                  onChange={(e) => setPreviewBuilding(e.target.value)}
                  className="w-full bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">{lang === 'he' ? 'דירה' : 'Unit'}</label>
                <input
                  type="text"
                  value={previewUnit}
                  onChange={(e) => setPreviewUnit(e.target.value)}
                  className="w-full bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">{lang === 'he' ? 'תאריך תיאום' : 'Date'}</label>
              <input
                type="text"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="w-full bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">{lang === 'he' ? 'בעל מקצוע' : 'Profession'}</label>
              <select
                value={previewProfession}
                onChange={(e) => setPreviewProfession(e.target.value)}
                className="w-full bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                {professions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SMS Bubble Preview */}
          <div className="mt-2 pt-4 border-t border-slate-200/60 flex-1 flex flex-col justify-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{lang === 'he' ? 'איך ההודעה תיראה:' : 'Message output:'}</span>
            <div className="bg-blue-600 text-white rounded-3xl rounded-br-none p-4 text-xs font-bold leading-relaxed shadow-md text-right relative animate-in fade-in duration-300">
              <p className="whitespace-pre-line">{getPreviewMessage()}</p>
              <div className="absolute bottom-1 left-2 text-[8px] opacity-65">12:00</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
