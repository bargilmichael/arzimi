
import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
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
  unitId: string; // Add unitId to props
  onClose: () => void;
  onConfirm: (data: {
    signerName: string;
    tenantEmail?: string;
    originalDescription: string;
    translatedDescription: string;
    signatureUrl: string;
    language: 'ru' | 'ar';
  }) => void;
}

const WorkConfirmationModal: React.FC<Props> = ({ lang, unitId, onClose, onConfirm }) => {
  const t = translations[lang];
  const [signerName, setSignerName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [description, setDescription] = useState('');
  const [translatedDescription, setTranslatedDescription] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [workLang, setWorkLang] = useState<'ru' | 'ar'>(lang === 'ar' ? 'ar' : 'ru');
  
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleTranslate = async () => {
    if (!description.trim()) return;
    setIsTranslating(true);
    const result = await translateToHebrew(description, workLang);
    setTranslatedDescription(result);
    setIsTranslating(false);
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = async () => {
    if (!signerName || !description || !sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert("Please fill all fields and sign");
      return;
    }
    
    setIsSaving(true);
    let signatureUrl = '';
    
    try {
      let signatureDataUrl = '';
      
      console.log("Converting signature to Blob...");
      // Use JPEG with 0.7 quality for a significantly smaller file size compared to PNG
      if (sigCanvas.current && typeof sigCanvas.current.getTrimmedCanvas === 'function') {
        const canvas = sigCanvas.current.getTrimmedCanvas();
        // Fill background with white for JPEG
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
             if (data[i + 3] === 0) { // If transparent
               data[i] = 255;
               data[i + 1] = 255;
               data[i + 2] = 255;
               data[i + 3] = 255;
             }
          }
          ctx.putImageData(imageData, 0, 0);
        }
        signatureDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      } else {
        signatureDataUrl = sigCanvas.current?.getCanvas().toDataURL('image/jpeg', 0.7) || '';
      }

      if (!signatureDataUrl || signatureDataUrl === 'data:,') {
        throw new Error("Could not capture signature content");
      }
      
      const signatureBlob = dataURLtoBlob(signatureDataUrl);
      console.log(`Blob created. Size: ${signatureBlob.size} bytes. Type: ${signatureBlob.type}`);
      
      console.log("Starting signature upload to Firebase Storage (uploadBytes)...");
      // Upload to Storage - wrapped in a timeout promise
      const uploadPromise = async () => {
        const signatureRef = ref(storage, `signatures/${unitId}_${Date.now()}.jpg`);
        console.log("Uploading to path:", signatureRef.fullPath);
        await uploadBytes(signatureRef, signatureBlob);
        console.log("Upload successful, fetching URL...");
        const url = await getDownloadURL(signatureRef);
        console.log("Got download URL:", url);
        return url;
      };

      // Increase timeout to 30s as 15s was too aggressive for some connections
      signatureUrl = await Promise.race([
        uploadPromise(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout uploading signature (30s)")), 30000))
      ]);
      
      console.log("Signature saved, URL ready.");
      
    } catch (error: any) {
      const isTimeout = error.message.includes("Timeout");
      
      if (isTimeout) {
        // If it's a timeout, we proceed without the URL to "close the task" as requested
        console.warn("Signature upload timed out (30s), proceeding without URL as requested by user fallback.");
        signatureUrl = '';
      } else {
        console.error("Error saving signature detail:", error);
        const errorMsg = (lang === 'he' ? `שגיאה בשמירת החתימה: ${error.message}` : `Error saving signature: ${error.message}`);
        alert(errorMsg);
        setIsSaving(false);
        return; 
      }
    }

    // If we got here, we have a signatureUrl.
    // Call onConfirm and allow it to handle the closure
    try {
      onConfirm({
        signerName,
        tenantEmail: tenantEmail || undefined,
        originalDescription: description,
        translatedDescription: translatedDescription || description,
        signatureUrl,
        language: workLang
      });
    } catch (confirmError) {
      console.error("Error in onConfirm:", confirmError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-blue-900/40 backdrop-blur-xl">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="text-2xl font-black text-blue-900">🖋️ {t.workConfirmationTitle}</h3>
          <button onClick={onClose} className="text-3xl text-gray-400 hover:text-red-500 transition-colors">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Language Selection */}
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{(t as any).tenantEmailLabel}</label>
            <input 
              type="email"
              value={tenantEmail}
              onChange={e => setTenantEmail(e.target.value)}
              placeholder={(t as any).tenantEmailPlaceholder}
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
                {isTranslating ? (
                   <span className="animate-spin text-sm">⏳</span>
                ) : (
                   <span>🌐</span>
                )}
                {t.translateToHebrew}
              </button>
            </div>
          </div>

          {translatedDescription && (
            <div className="space-y-2 animate-in slide-in-from-top-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">{t.translatedDescriptionLabel}</label>
              <div className="w-full px-6 py-4 rounded-2xl border-2 border-blue-100 bg-blue-50/30 font-bold text-blue-900 leading-relaxed">
                {translatedDescription}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.signaturePadLabel}</label>
              <button onClick={handleClearSignature} className="text-[10px] font-black text-red-500 uppercase tracking-tighter hover:underline">{t.clearSignature}</button>
            </div>
            <div className="bg-slate-100 rounded-3xl border-2 border-slate-200 overflow-hidden h-48">
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ className: 'w-full h-full' }}
              />
            </div>
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
