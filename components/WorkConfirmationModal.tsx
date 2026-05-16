
import React, { useState, useRef } from 'react';
import { Language, translations } from '../translations';
import { translateToHebrew } from '../services/aiService';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Helper to convert dataURL to Blob
const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

interface Props {
  lang: Language;
  unitId: string;
  onClose: () => void;
  onConfirm: (data: {
    signerName: string;
    tenantEmail?: string;
    originalDescription: string;
    translatedDescription: string;
    attachmentUrl: string;
    language: 'ru' | 'ar';
  }) => void;
}

const WorkConfirmationModal: React.FC<Props> = ({ lang, unitId, onClose, onConfirm }) => {
  const t = translations[lang] as any;
  const [signerName, setSignerName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [description, setDescription] = useState('');
  const [translatedDescription, setTranslatedDescription] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [workLang, setWorkLang] = useState<'ru' | 'ar'>(lang === 'ar' ? 'ar' : 'ru');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranslate = async () => {
    if (!description.trim()) return;
    setIsTranslating(true);
    const result = await translateToHebrew(description, workLang);
    setTranslatedDescription(result);
    setIsTranslating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSave = async () => {
    if (!signerName || !description) {
      alert(lang === 'he' ? "נא למלא שם מנהל עבודה ותיאור" : "Please fill foreman name and description");
      return;
    }
    
    setIsSaving(true);
    let attachmentUrl = '';
    
    try {
      if (selectedFile) {
        console.log("Starting image upload to Firebase Storage...");
        const storageRef = ref(storage, `confirmations/${unitId}_${Date.now()}_${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        attachmentUrl = await getDownloadURL(storageRef);
        console.log("Image uploaded, URL:", attachmentUrl);
      }

      onConfirm({
        signerName,
        tenantEmail: tenantEmail || undefined,
        originalDescription: description,
        translatedDescription: translatedDescription || description,
        attachmentUrl,
        language: workLang
      });
    } catch (error: any) {
      console.error("Error saving work confirmation:", error);
      alert(lang === 'he' ? `שגיאה בשמירת הנתונים: ${error.message}` : `Error saving data: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-blue-900/40 backdrop-blur-xl">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="text-2xl font-black text-blue-900">📄 {t.workConfirmationTitle}</h3>
          <button onClick={onClose} className="text-3xl text-gray-400 hover:text-red-500 transition-colors">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex gap-2">
            <button 
              onClick={() => setWorkLang('ru')} 
              className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all border-2 ${workLang === 'ru' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 text-gray-400 border-slate-100'}`}
            >
              Русский
            </button>
            <button 
              onClick={() => setWorkLang('ar')} 
              className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all border-2 ${workLang === 'ar' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 text-gray-400 border-slate-100'}`}
            >
              العربية
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.workerNameField}</label>
            <input 
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder={t.workerNamePlaceholder}
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold bg-slate-50/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.tenantEmailLabel}</label>
            <input 
              type="email"
              value={tenantEmail}
              onChange={e => setTenantEmail(e.target.value)}
              placeholder={t.tenantEmailPlaceholder}
              className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold bg-slate-50/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.descriptionInLang}</label>
            <div className="relative">
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="..."
                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold bg-slate-50/50 resize-none"
              />
              <button 
                onClick={handleTranslate}
                disabled={isTranslating || !description}
                className="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isTranslating ? <span className="animate-spin text-sm">⏳</span> : <span>🌐</span>}
                {t.translateToHebrew}
              </button>
            </div>
          </div>

          {translatedDescription && (
            <div className="space-y-2 animate-in slide-in-from-top-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">{t.translatedDescriptionLabel}</label>
              <div className="w-full px-6 py-4 rounded-2xl border-2 border-blue-100 bg-blue-50/30 font-bold text-blue-900 leading-relaxed max-h-[150px] overflow-y-auto">
                {translatedDescription}
              </div>
            </div>
          )}

          {/* Image Upload Instead of Signature */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.uploadPhotoLabel}</label>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {!previewUrl ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-10 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-all group"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">📸</span>
                <span className="text-sm font-black text-slate-400 group-hover:text-blue-500">{t.selectPhoto}</span>
              </button>
            ) : (
              <div className="relative rounded-3xl overflow-hidden border-4 border-white shadow-xl animate-in zoom-in-95">
                <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-64 object-cover" />
                <button 
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                  className="absolute top-4 right-4 bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-black shadow-lg hover:bg-red-600 transition-all"
                >
                  &times;
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-3 text-center">
                  <p className="text-[10px] text-white font-black uppercase tracking-widest">{t.photoSelected}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 border-t bg-slate-50">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSaving ? "⏳ ..." : `✅ ${t.confirmAndSave}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkConfirmationModal;
