import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Language, translations } from '../translations';
import axios from 'axios';
import { Map, UploadCloud, RefreshCw, Trash2, Check, AlertCircle } from 'lucide-react';

interface Props {
  projectId: string;
  lang: Language;
  userRole: string;
}

export const MapView: React.FC<Props> = ({ projectId, lang, userRole }) => {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang] || translations.he;

  // Real-time Firestore sync for project map
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    
    const unsub = onSnapshot(doc(db, 'projects', projectId), (snap) => {
      if (snap.exists()) {
        setMapUrl(snap.data().mapUrl || null);
      } else {
        setMapUrl(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching project map from Firestore:", err);
      // Fallback to fetch from backend API
      axios.get(`/api/projects/${projectId}/map`)
        .then(res => {
          setMapUrl(res.data.mapUrl);
          setLoading(false);
        })
        .catch(apiErr => {
          console.error("Backend API map fallback error:", apiErr);
          setError(lang === 'he' ? 'שגיאה בטעינת המפה' : 'Error loading map');
          setLoading(false);
        });
    });

    return () => unsub();
  }, [projectId, lang]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      const msg = lang === 'he' ? 'נא להעלות קובץ תמונה תקין בלבד (PNG/JPG)' : 'Please upload a valid image file only (PNG/JPG)';
      showToast(msg, 'error');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          if (!base64) {
            throw new Error("Failed to read file");
          }

          // Upload to Firebase Storage
          const storageRef = ref(storage, `projects/${projectId}/map`);
          await uploadString(storageRef, base64, 'data_url');
          const downloadUrl = await getDownloadURL(storageRef);

          // Save map URL in Firestore via Backend API
          await axios.post(`/api/projects/${projectId}/map`, { mapUrl: downloadUrl });

          showToast(lang === 'he' ? 'תוכנית האתר עודכנה בהצלחה!' : 'Site plan updated successfully!', 'success');
        } catch (uploadErr: any) {
          console.error("Upload process failed:", uploadErr);
          setError(lang === 'he' ? 'שגיאה בהעלאת התמונה. אנא נסה שוב.' : 'Error uploading image. Please try again.');
          showToast(lang === 'he' ? 'העלאת הקובץ נכשלה' : 'File upload failed', 'error');
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setError(lang === 'he' ? 'קריאת הקובץ נכשלה' : 'File reading failed');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("File selection error:", err);
      setError(err.message);
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDeleteMap = async () => {
    if (!confirm(lang === 'he' ? 'האם אתה בטוח שברצונך למחוק את תוכנית האתר הנוכחית?' : 'Are you sure you want to delete the current site plan?')) {
      return;
    }

    setUploading(true);
    try {
      // Clear URL in Firestore via Backend API
      await axios.post(`/api/projects/${projectId}/map`, { mapUrl: null });
      setMapUrl(null);
      showToast(lang === 'he' ? 'תוכנית האתר נמחקה בהצלחה' : 'Site plan deleted successfully', 'success');
    } catch (err: any) {
      console.error("Failed to delete map:", err);
      showToast(lang === 'he' ? 'שגיאה במחיקת המפה' : 'Error deleting map', 'error');
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center p-20 min-h-[400px]">
        <RefreshCw className="animate-spin text-blue-600 h-10 w-10 mb-4" />
        <span className="font-bold text-slate-500">{lang === 'he' ? 'טוען תוכנית אתר...' : 'Loading site plan...'}</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl mt-4 animate-in fade-in duration-300 text-right" dir={(lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr'}>
      {/* Toast message */}
      {toast && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-black shadow-2xl z-50 flex items-center gap-2 animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-4xl bg-blue-50 p-3 rounded-2xl">🗺️</span>
          <div>
            <h2 className="text-2xl font-black text-slate-800">
              {lang === 'he' ? 'תוכנית אתר כללית' : lang === 'ru' ? 'Общий план сайта' : 'مخطط الموقع العام'}
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              {lang === 'he' ? 'תצוגת פריסת הבניינים והשטח של הפרויקט' : 'Visual layout of project buildings and areas'}
            </p>
          </div>
        </div>

        {mapUrl && !uploading && (
          <div className="flex gap-2">
            <button
              onClick={triggerFileInput}
              className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              {lang === 'he' ? 'החלף תמונה' : lang === 'ru' ? 'Заменить' : 'استبدال الصورة'}
            </button>
            <button
              onClick={handleDeleteMap}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {lang === 'he' ? 'מחק' : lang === 'ru' ? 'Удалить' : 'حذف'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChangeFile}
        accept="image/png, image/jpeg, image/jpg"
        className="hidden"
      />

      {/* View Mode Switching */}
      {uploading ? (
        <div className="flex flex-col justify-center items-center border-2 border-dashed border-blue-200 rounded-[2rem] bg-blue-50/20 p-20 min-h-[350px]">
          <RefreshCw className="animate-spin text-blue-600 h-12 w-12 mb-4" />
          <h3 className="text-lg font-black text-slate-800 mb-2">
            {lang === 'he' ? 'מעלה ומעדכן תוכנית...' : 'Uploading and updating plan...'}
          </h3>
          <p className="text-sm text-slate-400 font-bold">
            {lang === 'he' ? 'נא לא לסגור את העמוד' : 'Please keep this page open'}
          </p>
        </div>
      ) : !mapUrl ? (
        /* Empty State with drag & drop support */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`flex flex-col justify-center items-center border-4 border-dashed rounded-[3rem] p-12 text-center cursor-pointer transition-all min-h-[400px] ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner'
              : 'border-slate-200 bg-slate-50/30 hover:border-blue-300 hover:bg-slate-50/80 hover:shadow-lg'
          }`}
        >
          <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-md shadow-blue-50/50">
            <UploadCloud className="h-12 w-12" />
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-3">
            {lang === 'he' ? 'העלה תוכנית אתר' : lang === 'ru' ? 'Загрузить план сайта' : 'تحميل مخطط الموقع'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md font-medium leading-relaxed mb-8">
            {lang === 'he'
              ? 'עדיין לא הועלתה תוכנית אתר כללית עבור פרויקט זה. גרור ושחרר קובץ תמונה כאן, או לחץ כדי לבחור קובץ (PNG / JPG) כדי שמשתמשים יוכלו להבין את פריסת הבניינים בשטח.'
              : 'No general site plan has been uploaded for this project yet. Drag & drop an image file here, or click to choose a file (PNG / JPG) to display the project building layout.'}
          </p>
          <button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700 font-black text-sm px-8 py-4 rounded-2xl shadow-xl hover:shadow-blue-500/20 active:scale-95 transition-all"
          >
            {lang === 'he' ? 'בחר קובץ תמונה' : lang === 'ru' ? 'Выбрать файл' : 'اختر ملف صورة'}
          </button>
        </div>
      ) : (
        /* Display Plan Map View */
        <div className="bg-slate-50 rounded-[2.5rem] p-4 sm:p-6 border border-slate-100 flex flex-col items-center">
          <div className="w-full relative rounded-2xl overflow-hidden bg-white border border-slate-200/60 shadow-md">
            <img
              src={mapUrl}
              alt="Site plan"
              referrerPolicy="no-referrer"
              className="max-w-full h-auto mx-auto object-contain max-h-[75vh]"
            />
          </div>
          
          <div className="mt-4 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
            {lang === 'he' ? 'תוכנית אתר כללית - ארזי הנגב' : 'General Site Plan - Arazi HaNegev'}
          </div>
        </div>
      )}
    </div>
  );
};
