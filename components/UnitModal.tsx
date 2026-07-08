
import React, { useState, useEffect, useRef } from 'react';
import { Unit, TaskStatus, Discipline, TaskLog, WorkConfirmation, ProjectState, DisciplineDefinition } from '../types';
import { STATUS_CONFIG, PUBLIC_AREAS, CONTRACTORS } from '../constants';
import { Language, translations } from '../translations';
import WorkConfirmationModal from './WorkConfirmationModal';
import ExpandableText from './ExpandableText';
import { generateWorkConfirmationPDF } from '../services/pdfService';
import { auth } from '../firebase';
import { Phone } from 'lucide-react';

interface Props {
  unit: Unit;
  state: ProjectState;
  onClose: () => void;
  onSave: (updates: { 
    newLog?: { status: TaskStatus, workerName: string, contractor: string, contractorId: string, description: string, discipline: Discipline, images?: string[] },
    updateLogStatus?: { logId: string, newStatus: TaskStatus },
    deleteLogId?: string,
    editLog?: { id: string, status: TaskStatus, workerName: string, contractor: string, contractorId: string, description: string, discipline: Discipline, images?: string[] },
    updateTenantInfo?: { name: string, phone: string },
    workConfirmation?: {
      signerName: string,
      tenantEmail?: string,
      originalDescription: string,
      translatedDescription: string,
      attachmentUrl: string,
      language: 'ru' | 'ar'
    }
  }) => void;
  lang: Language;
  activeDiscipline: Discipline;
  userRole: 'admin' | 'contractor' | 'viewer';
  userDiscipline: string;
  disciplines: DisciplineDefinition[];
}

const UnitModal: React.FC<Props> = ({ unit, state, onClose, onSave, lang, activeDiscipline, userRole, userDiscipline, disciplines }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('history');
  
  // Tenant State
  const [tenantName, setTenantName] = useState(unit.tenantInfo?.name || '');
  const [tenantPhone, setTenantPhone] = useState(unit.tenantInfo?.phone || '');
  const [isEditingTenant, setIsEditingTenant] = useState(false);

  const [worker, setWorker] = useState('');
  const [desc, setDesc] = useState('');
  const [contractorId, setContractorId] = useState<string>('');

  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [lastTranslatedLang, setLastTranslatedLang] = useState(lang);

  const handleTranslateDescription = async (targetLang: string) => {
    if (!desc || !desc.trim()) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: desc,
          targetLanguage: targetLang,
        }),
      });
      if (!response.ok) {
        throw new Error(lang === 'he' ? 'שגיאה בתרגום' : lang === 'ru' ? 'Ошибка перевода' : 'خطأ في الترجمة');
      }
      const data = await response.json();
      if (data.translation) {
        setDesc(data.translation);
        setLastTranslatedLang(targetLang);
      }
    } catch (err: any) {
      console.error('Translation error:', err);
      setTranslationError(lang === 'he' ? 'אירעה שגיאה בתרגום הטקסט באמצעות AI' : lang === 'ru' ? 'Произошла ошибка при переводе через AI' : 'حدث خطأ أثناء الترجمة באמצעות AI');
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (desc && desc.trim() && lang !== lastTranslatedLang) {
      handleTranslateDescription(lang);
    } else {
      setLastTranslatedLang(lang);
    }
  }, [lang]);

  useEffect(() => {
    if (disciplines.length > 0) {
      if (userRole === 'contractor' && activeDiscipline && activeDiscipline !== 'all' && activeDiscipline !== 'general') {
        setContractorId(activeDiscipline);
      } else if (!contractorId) {
        setContractorId(disciplines[0].id);
      }
    }
  }, [disciplines, userRole, activeDiscipline]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportTime, setReportTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.IN_PROGRESS);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [reportEmail, setReportEmail] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [viewingConfirmationId, setViewingConfirmationId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const t = translations[lang];
  const canEdit = userRole === 'admin' || userRole === 'contractor';
  const isAdmin = userRole === 'admin';
  const isWorkManager = userRole === 'contractor' && (userDiscipline === 'general' || userDiscipline === 'all');
  const isSupervisor = isAdmin || isWorkManager;
  const isRestricted = userRole === 'contractor' && userDiscipline !== 'all' && userDiscipline !== 'general';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const filteredHistory = isRestricted 
    ? unit.history.filter(log => log.discipline === activeDiscipline)
    : unit.history;

  const activeTasks = filteredHistory.filter(log => log.status !== TaskStatus.DONE);
  const canAddReport = isSupervisor;
  
  const handleQuickStatusUpdate = (logId: string, newStatus: TaskStatus) => {
    onSave({ updateLogStatus: { logId, newStatus } });
    setEditingLogId(null);
  };

  const handleStartWork = () => {
    setActiveTab('report');
    setStatus(TaskStatus.IN_PROGRESS);
  };

  const handleDownloadPDF = async () => {
    if (!unit.workConfirmation) return;
    setIsGeneratingPDF(true);
    try {
      const buildingId = unit.buildingId.split('-')[1] || unit.buildingId;
      const unitIdentifier = unit.id.split('-').slice(1).join('-');
      
      const pdf = await generateWorkConfirmationPDF({
        appName: t.appName,
        unitIdentifier: `${t.apartment} ${unitIdentifier}`,
        buildingId: buildingId,
        signerName: unit.workConfirmation.signerName,
        date: new Date(unit.workConfirmation.timestamp).toLocaleString('he-IL'),
        description: unit.workConfirmation.translatedDescription || unit.workConfirmation.originalDescription,
        attachmentUrl: unit.workConfirmation.attachmentUrl,
        lang: lang as 'he' | 'ru' | 'ar'
      });
      
      pdf.save(`work_confirmation_${unit.id}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker || !desc) return alert(t.alertFillFields);
    
    const discipline = contractorId;
    const selectedDisc = disciplines.find(d => d.id === discipline);
    const selectedContractorLabel = selectedDisc?.labels[lang] || selectedDisc?.labels.he || discipline;
    
    const reportTimestamp = new Date(`${reportDate}T${reportTime}`).getTime();

    if (editingLogId) {
      onSave({
        editLog: {
          id: editingLogId,
          status,
          workerName: worker,
          contractor: selectedContractorLabel,
          contractorId: discipline,
          description: desc,
          discipline,
          images: selectedImages.length > 0 ? selectedImages : undefined,
          timestamp: reportTimestamp
        } as any
      });
      setEditingLogId(null);
    } else {
      const updates: any = { 
        newLog: { 
          status, 
          workerName: worker, 
          contractor: selectedContractorLabel, 
          contractorId: discipline,
          description: desc, 
          discipline, 
          images: selectedImages.length > 0 ? selectedImages : undefined,
          timestamp: reportTimestamp
        } 
      };

      onSave(updates);
    }

    setWorker(''); setDesc(''); setSelectedImages([]); setStatus(TaskStatus.IN_PROGRESS); setReportEmail(''); 
    setReportDate(new Date().toISOString().split('T')[0]);
    setReportTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
    setActiveTab('history');
  };

  const handleSaveTenantInfo = () => {
    onSave({ updateTenantInfo: { name: tenantName, phone: tenantPhone } });
    setIsEditingTenant(false);
  };

  const handleWorkConfirmation = (data: any) => {
    try {
      const updates: any = { workConfirmation: data };
      
      if (completingTaskId) {
        updates.updateLogStatus = { logId: completingTaskId, newStatus: TaskStatus.DONE };
      }

      if (data.followupDisciplineId && data.followupDisciplineId !== 'none') {
        const disc = disciplines.find(d => d.id === data.followupDisciplineId);
        const discName = disc?.labels[lang] || disc?.labels.he || data.followupDisciplineId;
        
        updates.newLog = {
          status: TaskStatus.COORDINATION_REQUIRED,
          workerName: `${lang === 'he' ? 'דרוש' : lang === 'ru' ? 'Требуется' : 'مطلوب'}: ${discName}`,
          contractor: discName,
          contractorId: data.followupDisciplineId,
          description: lang === 'he' ? 'נדרש תיאום בעל מקצוע המשך לאחר סיום עבודה' : lang === 'ru' ? 'Требуется координация следующего специалиста после завершения работ' : 'مطلوب تنسيق مهني متابع بعد انتهاء العمل',
          discipline: data.followupDisciplineId,
        };
      }
      
      onSave(updates);
      setIsPhotoModalOpen(false);
      setCompletingTaskId(null);
      setActiveTab('history');
    } catch (error) {
      console.error("Error confirming work:", error);
      setIsPhotoModalOpen(false); // Close anyway so user isn't stuck
      setCompletingTaskId(null);
    }
  };

  const handleEditHistoryLog = (log: TaskLog) => {
    setEditingLogId(log.id);
    setWorker(log.workerName);
    setDesc(log.description);
    setStatus(log.status);
    setSelectedImages(log.images || []);
    
    const dateObj = new Date(log.timestamp);
    setReportDate(dateObj.toISOString().split('T')[0]);
    setReportTime(dateObj.toTimeString().split(' ')[0].substring(0, 5));
    
    setContractorId(log.contractorId);
    
    setActiveTab('report');
  };

  const handleDeleteHistoryLog = (logId: string) => {
    if (!isSupervisor) return;
    if (confirm(lang === 'he' ? 'האם אתה בטוח שברצונך למחוק דיווח זה?' : 'Are you sure you want to delete this report?')) {
      onSave({ deleteLogId: logId });
    }
  };

  const unitIdentifier = unit.id.split('-').slice(1).join('-');
  const isPublicArea = isNaN(Number(unitIdentifier));
  const publicAreaConfig = isPublicArea ? PUBLIC_AREAS.find(a => a.id === unitIdentifier) : null;
  const displayName = isPublicArea ? (t as any)[publicAreaConfig?.labelKey || ''] : `${t.apartment} ${unitIdentifier}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-white/20">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b flex justify-between items-center bg-white">
          <div className={(lang === 'he' || lang === 'ar') ? 'text-right' : 'text-left'}>
            <h3 className="text-3xl font-black text-blue-900 tracking-tight">{displayName}</h3>
            <div className="flex items-center gap-3 mt-1">
               <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.plot}: {unit.buildingId.split('-')[1]} | {t.building}: {unit.buildingId.split('-')[3]}</span>
               {!isPublicArea && (
                 <div className="flex items-center gap-2">
                   <span className="text-gray-300">|</span>
                   {isEditingTenant ? (
                     <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl animate-in zoom-in-95">
                       <input 
                         value={tenantName} 
                         onChange={e => setTenantName(e.target.value)} 
                         placeholder={t.tenantNameField} 
                         className="px-2 py-1 text-[11px] font-bold rounded-lg border focus:border-blue-500 outline-none w-24"
                       />
                       <input 
                         value={tenantPhone} 
                         onChange={e => setTenantPhone(e.target.value)} 
                         placeholder={t.tenantPhoneField} 
                         className="px-2 py-1 text-[11px] font-bold rounded-lg border focus:border-blue-500 outline-none w-24"
                       />
                       <button onClick={handleSaveTenantInfo} className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-black">{t.saveTenantInfo}</button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2">
                       <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                         👤 {unit.tenantInfo?.name || t.tenantLabel} {unit.tenantInfo?.phone && `(${unit.tenantInfo.phone})`}
                          {unit.tenantInfo?.phone && (
                            <a
                              href={`tel:${unit.tenantInfo.phone}`}
                              className="bg-green-500 hover:bg-green-600 text-white p-0.5 rounded-full transition-all flex items-center justify-center shadow-sm ml-1 inline-block"
                              title={lang === 'he' ? 'חיוג לדייר' : 'Call tenant'}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-2.5 h-2.5 inline" />
                            </a>
                          )}
                       </span>
                       {isSupervisor && (
                         <button onClick={() => setIsEditingTenant(true)} className="text-[10px] text-gray-400 hover:text-blue-500 transition-colors">✏️</button>
                       )}
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all text-4xl font-light shadow-sm bg-slate-50">&times;</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white border-b sticky top-0 z-10">
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 font-black text-xs md:text-sm transition-all border-b-4 ${activeTab === 'history' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>📜 {t.viewHistory}</button>
          {canAddReport && (
            <button onClick={() => setActiveTab('report')} className={`flex-1 py-4 font-black text-xs md:text-sm transition-all border-b-4 ${activeTab === 'report' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>➕ {t.newReport}</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === 'history' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              {activeTasks.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t.activeTask}</h4>
                    <div className="flex gap-2">
                      {isSupervisor && (
                         <button 
                           onClick={() => setActiveTab('report')}
                           className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
                         >
                           ➕ {t.newReport}
                         </button>
                      )}
                      {canEdit && (
                         <button 
                           onClick={() => setIsPhotoModalOpen(true)}
                           className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-green-700 transition-all hover:scale-105"
                         >
                           📸 {t.signAndFinish}
                         </button>
                      )}
                    </div>
                  </div>

                  {unit.workConfirmation && (
                    <div className="bg-green-50 border-2 border-green-500 rounded-[2.5rem] p-6 shadow-lg animate-in fade-in zoom-in-95">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-2xl border-2 border-green-200">✅</div>
                          <div>
                            <span className="font-black text-green-900 text-lg block leading-tight">{t.workConfirmationTitle}</span>
                            <div className="flex flex-col gap-1 mt-1">
                              <span className="text-[10px] text-green-600 font-black uppercase">{(t as any).signedBy}: {unit.workConfirmation.signerName}</span>
                              {unit.workConfirmation.tenantEmail && (
                                <span className="text-[10px] text-blue-600 font-black flex items-center gap-1">
                                  📧 {unit.workConfirmation.tenantEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 font-black">{new Date(unit.workConfirmation.timestamp).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.descriptionInLang}</label>
                           <p className="text-xs font-bold text-gray-600 bg-white/50 p-3 rounded-xl border border-green-100">{unit.workConfirmation.originalDescription}</p>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-green-600 uppercase tracking-widest">{t.translatedDescriptionLabel}</label>
                           <p className="text-xs font-black text-green-800 bg-white p-3 rounded-xl border border-green-200">{unit.workConfirmation.translatedDescription}</p>
                        </div>
                      </div>

                      {unit.workConfirmation.attachmentUrl && (
                        <div className="mt-4 pt-4 border-t border-green-100 flex flex-col items-center gap-4">
                          <div className="bg-white p-2 rounded-2xl border border-green-200 shadow-inner overflow-hidden max-w-full">
                            <img src={unit.workConfirmation.attachmentUrl} alt="Confirmation Photo" className="max-h-48 object-contain rounded-xl" />
                          </div>
                          
                          <button 
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-white border-2 border-blue-600 text-blue-600 font-black text-sm hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isGeneratingPDF ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                {(t as any).generatingPDF}
                              </>
                            ) : (
                              <>
                                📥 {(t as any).downloadPDF}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {activeTasks.map(task => {
                    const isCoordination = task.status === TaskStatus.COORDINATION_REQUIRED;
                    const cardBorderClass = isCoordination ? 'border-indigo-500 ring-indigo-500/5' : 'border-blue-500 ring-blue-500/5';
                    const stripBgClass = isCoordination ? 'bg-indigo-600' : 'bg-blue-600';
                    const avatarBgClass = isCoordination ? 'bg-indigo-50 border-indigo-100 font-mono text-xl' : 'bg-blue-50 border-blue-100 text-2xl';
                    const badgeBgClass = isCoordination ? 'bg-indigo-600' : 'bg-blue-600';

                    return (
                      <div key={task.id} className={`bg-white border-2 ${cardBorderClass} rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden ring-8`}>
                        <div className={`absolute top-0 left-0 w-3 h-full ${stripBgClass}`}></div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl ${avatarBgClass} flex items-center justify-center border-2 shadow-inner`}>
                              {task.contractor.includes('אינסטלטור') || task.contractor.includes('אינסטלציה') ? '🚰' : task.contractor.includes('חשמלאי') || task.contractor.includes('חשמל') ? '⚡' : task.contractor.includes('איטום') || task.contractor.includes('עזר') ? '💧' : task.contractor.includes('גז') || task.contractor.includes('gas') ? '⛽' : '👷'}
                            </div>
                            <div>
                              <span className="font-black text-blue-900 text-xl block leading-tight">{task.workerName}</span>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`text-[10px] ${badgeBgClass} text-white px-2 py-0.5 rounded-md font-black uppercase inline-block shadow-sm`}>{task.contractor}</span>
                                <span className="text-[10px] text-gray-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                                  📅 {(t as any).taskOpeningDate || (lang === 'he' ? 'תאריך פתיחה' : 'Opening Date')}: {formatDate(new Date(task.timestamp).toISOString().split('T')[0])}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={`text-[10px] font-black px-3 py-1 rounded-full border-2 shadow-sm ${STATUS_CONFIG[task.status].color}`}>{(t as any)[STATUS_CONFIG[task.status].labelKey]}</div>
                        </div>
                      <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-100 shadow-inner mb-6">
                        <ExpandableText text={task.description} lang={lang} className="text-sm font-bold text-gray-700 leading-relaxed" defaultClamped={false} />
                        {task.images && task.images.length > 0 && (
                          <div className="grid grid-cols-3 gap-3 mt-4">
                            {task.images.map((img, idx) => img && (
                              <div key={idx} className="aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-md cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(img)}>
                                <img src={img} alt="progress" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-4">
                      {isSupervisor && (
                         <div className="flex gap-4 flex-1">
                           <button 
                             onClick={() => {
                               setCompletingTaskId(task.id);
                               setIsPhotoModalOpen(true);
                             }} 
                             className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                           >
                             ✅ {t.finishWorkAction}
                           </button>
                           <button onClick={() => handleQuickStatusUpdate(task.id, TaskStatus.NEEDS_FOLLOWUP)} className="flex-1 bg-yellow-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-yellow-600 active:scale-95 transition-all">🔄 {t.needsFollowup}</button>
                         </div>
                       )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
                  <div className="text-6xl mb-6 opacity-20 grayscale">🏗️</div>
                  {isSupervisor && (
                    <button onClick={handleStartWork} className="bg-blue-600 text-white px-10 py-6 rounded-[2rem] text-xl font-black shadow-2xl hover:bg-blue-700 active:scale-95 transition-all">
                      {lang === 'he' ? '🚀 פתח משימה חדשה לביצוע' : lang === 'ru' ? '🚀 Открыть новую задачу' : '🚀 فتح مهمة تنفيذ جديدة'}
                    </button>
                  )}
                  {isRestricted && (
                    <p className="text-gray-400 font-bold px-8">
                       {(t as any).waitingForManager}
                    </p>
                  )}
                </div>
              ) : null}
              <div className="space-y-4 pt-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{t.workHistory}</h4>
                <div className="space-y-4">
                  {filteredHistory.map((log) => (
                    <div key={log.id} className={`bg-white border rounded-[2rem] p-5 shadow-sm flex flex-col transition-all hover:border-blue-200 ${log.status === TaskStatus.DONE ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                      <div className="flex items-center gap-4 mb-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner border-2 ${STATUS_CONFIG[log.status].color.split(' ')[0]}`}>{STATUS_CONFIG[log.status].icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                             <span className="font-black text-blue-900 truncate text-lg">{log.workerName}</span>
                             <div className="flex items-center gap-2">
                               {(isSupervisor || (userRole === 'contractor' && log.workerName === (auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0]))) && (
                                 <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleEditHistoryLog(log)} 
                                      className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-colors"
                                      title={lang === 'he' ? 'ערוך' : 'Edit'}
                                    >
                                      ✏️
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteHistoryLog(log.id)} 
                                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-300 hover:text-red-500 transition-colors"
                                      title={lang === 'he' ? 'מחק' : 'Delete'}
                                    >
                                      🗑️
                                    </button>
                                 </div>
                               )}
                               <div className="flex flex-col items-end gap-1">
                                 <span className="text-[9px] text-gray-400 font-black px-2 py-0.5 rounded-lg border border-gray-100 italic">
                                   {(t as any).taskOpeningDate}: {formatDate(new Date(log.timestamp).toISOString().split('T')[0])}
                                 </span>
                                 {log.completedAt && (
                                   <span className="text-[9px] text-green-600 font-black px-2 py-0.5 rounded-lg border border-green-100 italic">
                                     {(t as any).taskCompletionDate}: {formatDate(new Date(log.completedAt).toISOString().split('T')[0])}
                                   </span>
                                 )}
                               </div>
                             </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{log.contractor}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <ExpandableText text={log.description} lang={lang} className="text-xs text-gray-600 font-medium leading-relaxed" />
                      </div>
                      {log.confirmationId && (
                        <button 
                          onClick={() => setViewingConfirmationId(log.confirmationId || null)}
                          className="mt-3 w-full py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] hover:bg-blue-100 transition-all border border-blue-100 flex items-center justify-center gap-2"
                        >
                          👁️ {t.viewConfirmation}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              {/* Prominent Tenant Info Section */}
              {!isPublicArea && (
                <div className="bg-white border-2 border-blue-500/20 rounded-[2rem] p-6 shadow-sm overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl select-none">👤</div>
                  <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span>🏠</span> {lang === 'he' ? 'פרטי דייר' : lang === 'ru' ? 'Данные жильца' : 'بيانات المستأجر'}
                  </h4>
                  
                  {isEditingTenant ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in zoom-in-95">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.tenantNameField}</label>
                         <input 
                           value={tenantName} 
                           onChange={e => setTenantName(e.target.value)} 
                           placeholder={t.tenantNameField} 
                           className="w-full px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-blue-500 outline-none font-bold"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.tenantPhoneField}</label>
                         <input 
                           value={tenantPhone} 
                           onChange={e => setTenantPhone(e.target.value)} 
                           placeholder={t.tenantPhoneField} 
                           className="w-full px-4 py-3 rounded-xl border-2 border-blue-100 focus:border-blue-500 outline-none font-bold"
                         />
                      </div>
                      <div className="sm:col-span-2 flex gap-2">
                        <button onClick={handleSaveTenantInfo} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all">{t.saveTenantInfo}</button>
                        <button onClick={() => setIsEditingTenant(false)} className="px-6 bg-slate-100 text-gray-500 py-3 rounded-xl font-black hover:bg-slate-200">{lang === 'he' ? 'ביטול' : 'Отмена'}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="text-xl font-black text-blue-900">{unit.tenantInfo?.name || (lang === 'he' ? 'אין שם דייר' : 'Нет имени')}</div>
                        <div className="text-sm font-bold text-gray-400 flex items-center gap-2">
                          <span>{unit.tenantInfo?.phone || (lang === 'he' ? 'אין טלפון' : 'Нет телефона')}</span>
                          {unit.tenantInfo?.phone && (
                            <a
                              href={`tel:${unit.tenantInfo.phone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500 hover:bg-green-600 text-white text-xs font-black transition-all shadow-sm"
                              title={lang === 'he' ? 'חיוג לדייר' : 'Call tenant'}
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{lang === 'he' ? 'חיוג' : 'Call'}</span>
                            </a>
                          )}
                        </div>
                      </div>
                      {isSupervisor && (
                        <button 
                          onClick={() => setIsEditingTenant(true)} 
                          className="bg-blue-50 text-blue-600 px-5 py-3 rounded-xl font-black text-xs hover:bg-blue-100 transition-all border border-blue-100"
                        >
                          ✏️ {lang === 'he' ? 'ערוך פרטי דייר' : 'Редактировать'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <section className="bg-blue-50/40 p-8 rounded-[3rem] border-2 border-blue-100 shadow-inner">
                <div className="flex items-center justify-center relative border-b-2 pb-6 border-blue-100/50 mb-8">
                  <h4 className="text-md font-black text-blue-800 uppercase tracking-[0.3em]">
                    {editingLogId ? (lang === 'he' ? '✍️ עריכת דיווח' : '✍️ Edit Report') : `🚀 ${t.newReport}`}
                  </h4>
                  {editingLogId && (
                    <button 
                      onClick={() => {
                        setEditingLogId(null);
                        setWorker(''); setDesc(''); setSelectedImages([]); setStatus(TaskStatus.IN_PROGRESS);
                        setReportDate(new Date().toISOString().split('T')[0]);
                        setReportTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
                      }}
                      className="absolute right-0 text-xs font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-xl hover:bg-red-100 transition-all border border-red-100"
                    >
                      {lang === 'he' ? 'בטל עריכה' : 'Cancel Edit'}
                    </button>
                  )}
                </div>
                <form onSubmit={handleReportSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.contractorLabel}</label>
                    <select value={contractorId} onChange={e => setContractorId(e.target.value)} disabled={isRestricted} className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none bg-white font-black shadow-sm text-lg disabled:opacity-50">
                      {disciplines.map(d => (
                        <option key={d.id} value={d.id}>{d.labels[lang] || d.labels.he}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.workerName}</label>
                    <input value={worker} onChange={e => setWorker(e.target.value)} className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none font-black shadow-sm text-lg placeholder:opacity-20" placeholder={t.workerExample} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.dateLabel}</label>
                    <input 
                      type="date" 
                      value={reportDate} 
                      onChange={e => {
                        const newDate = e.target.value;
                        setReportDate(newDate);
                        const today = new Date().toISOString().split('T')[0];
                        if (newDate !== today) {
                          setStatus(TaskStatus.IN_PROGRESS);
                        }
                      }} 
                      className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none font-black shadow-sm text-lg" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.timeLabel}</label>
                    <input 
                      type="time" 
                      value={reportTime} 
                      onChange={e => setReportTime(e.target.value)} 
                      className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none font-black shadow-sm text-lg" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.currentStatus}</label>
                      <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value as TaskStatus)} 
                        className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none bg-white font-black shadow-sm text-lg"
                      >
                      {Object.entries(STATUS_CONFIG).map(([s, cfg]) => <option key={s} value={s}>{(t as any)[cfg.labelKey]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">
                      {lang === 'he' ? 'צרף תמונות 📸' : lang === 'ru' ? 'Прикрепить фото 📸' : 'إرفاق صور 📸'}
                    </label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-6 py-5 rounded-2xl border-2 border-dashed border-blue-300 bg-white text-blue-500 font-black hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                        <span>📷</span> {lang === 'he' ? 'העלה תמונות' : lang === 'ru' ? 'Загрузить фото' : 'تحميل صور'}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" multiple accept="image/*" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    {selectedImages.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-4 p-4 bg-white rounded-3xl border shadow-inner">
                        {selectedImages.map((img, idx) => img && (
                          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                            <img src={img} alt="preview" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.whatWasDone}</label>
                      {desc && desc.trim() && (
                        <button
                          type="button"
                          onClick={() => handleTranslateDescription(lang)}
                          disabled={isTranslating}
                          className="text-[10px] sm:text-[11px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/60 active:scale-95 disabled:opacity-50 border border-indigo-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          {isTranslating ? (
                            <span className="inline-block animate-spin h-3 w-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                          ) : (
                            <span className="text-yellow-500">✨</span>
                          )}
                          {lang === 'he' ? 'תרגם תיאור עם AI' : lang === 'ru' ? 'Перевести описание с AI' : 'ترجمة الوصف باستخدام الذكي'}
                        </button>
                      )}
                    </div>
                    <textarea value={desc} onChange={e => { setDesc(e.target.value); setTranslationError(null); }} rows={4} className="w-full px-6 py-5 rounded-[2.5rem] border-2 border-gray-100 focus:border-blue-500 outline-none resize-none font-bold shadow-sm text-lg placeholder:opacity-20" placeholder={t.descriptionPlaceholder} />
                    {translationError && (
                      <p className="text-xs font-bold text-red-500 px-1 animate-pulse">{translationError}</p>
                    )}
                  </div>
                  <button type="submit" className="md:col-span-2 bg-blue-600 text-white font-black py-7 rounded-[2rem] hover:bg-blue-700 transition-all shadow-2xl active:scale-95 text-2xl tracking-[0.2em]">
                    {editingLogId ? (lang === 'he' ? 'שמור שינויים' : 'Save Changes') : t.updateButton}
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>

      {isPhotoModalOpen && (
        <WorkConfirmationModal 
          lang={lang} 
          unitId={unit.id}
          disciplines={disciplines}
          onClose={() => { setIsPhotoModalOpen(false); setCompletingTaskId(null); }}
          onConfirm={handleWorkConfirmation}
        />
      )}

      {viewingConfirmationId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           {(() => {
             const conf = unit.workConfirmations?.find(c => c.id === viewingConfirmationId) || 
                          (unit.workConfirmation?.id === viewingConfirmationId ? unit.workConfirmation : null);
             if (!conf) return null;
             return (
               <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="text-2xl font-black text-blue-900">📄 {t.workConfirmationTitle}</h3>
                   <button onClick={() => setViewingConfirmationId(null)} className="text-3xl text-gray-400 hover:text-red-500">&times;</button>
                 </div>
                 <div className="space-y-6">
                   <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                     <span>{(t as any).signedBy}: {conf.signerName}</span>
                     <span>{new Date(conf.timestamp).toLocaleDateString()}</span>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.descriptionInLang}</label>
                     <div className="max-h-[150px] overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                       <p className="text-sm font-bold whitespace-pre-wrap">{conf.originalDescription}</p>
                     </div>
                   </div>
                   {conf.translatedDescription && (
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t.translatedDescriptionLabel}</label>
                       <div className="max-h-[150px] overflow-y-auto p-4 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100 shadow-inner">
                         <p className="text-sm font-black italic whitespace-pre-wrap">{conf.translatedDescription}</p>
                       </div>
                     </div>
                   )}
                   {conf.attachmentUrl && (
                     <div className="rounded-3xl overflow-hidden border-4 border-white shadow-lg">
                       <img src={conf.attachmentUrl} alt="confirmation" className="w-full h-auto max-h-64 object-cover cursor-pointer" onClick={() => window.open(conf.attachmentUrl)} />
                     </div>
                   )}
                   <button onClick={() => setViewingConfirmationId(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-black transition-all">
                     {lang === 'he' ? 'סגור' : lang === 'ru' ? 'Закрыть' : 'إغلاق'}
                   </button>
                 </div>
               </div>
             );
           })()}
        </div>
      )}
    </div>
  );
};

export default UnitModal;
