
import React, { useState, useEffect, useRef } from 'react';
import { Unit, TaskStatus, Discipline, Appointment, TaskLog, WorkConfirmation } from '../types';
import { STATUS_CONFIG, PUBLIC_AREAS, CONTRACTORS } from '../constants';
import { Language, translations } from '../translations';
import WorkConfirmationModal from './WorkConfirmationModal';
import { generateWorkConfirmationPDF } from '../services/pdfService';

interface Props {
  unit: Unit;
  onClose: () => void;
  onSave: (updates: { 
    newLog?: { status: TaskStatus, workerName: string, contractor: string, description: string, discipline: Discipline, images?: string[] },
    updateLogStatus?: { logId: string, newStatus: TaskStatus },
    deleteLogId?: string,
    editLog?: { id: string, status: TaskStatus, workerName: string, contractor: string, description: string, discipline: Discipline, images?: string[] },
    newAppointment?: Omit<Appointment, 'id' | 'createdAt' | 'isCompleted'>,
    completeAppointmentId?: string,
    updateTenantInfo?: { name: string, phone: string },
    workConfirmation?: {
      signerName: string,
      tenantEmail?: string,
      originalDescription: string,
      translatedDescription: string,
      signatureUrl: string,
      language: 'ru' | 'ar'
    }
  }) => void;
  lang: Language;
  activeDiscipline: Discipline;
  userRole: 'admin' | 'contractor' | 'viewer';
}

const UnitModal: React.FC<Props> = ({ unit, onClose, onSave, lang, activeDiscipline, userRole }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'schedule' | 'history'>('history');
  
  // Tenant State
  const [tenantName, setTenantName] = useState(unit.tenantInfo?.name || '');
  const [tenantPhone, setTenantPhone] = useState(unit.tenantInfo?.phone || '');
  const [isEditingTenant, setIsEditingTenant] = useState(false);

  const [worker, setWorker] = useState('');
  const [desc, setDesc] = useState('');
  const [contractor, setContractor] = useState(CONTRACTORS[0].id);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.DONE);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [reportEmail, setReportEmail] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Appointment Form State
  const [appDate, setAppDate] = useState('');
  const [appTime, setAppTime] = useState('');
  const [appTenant, setAppTenant] = useState(unit.tenantInfo?.name || '');
  const [appContractor, setAppContractor] = useState(CONTRACTORS[0].id);
  const [appEmail, setAppEmail] = useState('');
  const [appNotes, setAppNotes] = useState('');

  // Summary Form State
  const [summarizingAppId, setSummarizingAppId] = useState<string | null>(null);
  const [visitSummary, setVisitSummary] = useState('');
  const [needsFollowup, setNeedsFollowup] = useState(false);
  const [followupContractorId, setFollowupContractorId] = useState(CONTRACTORS[1].id); // Default to workers
  
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const t = translations[lang];
  const canEdit = userRole === 'admin' || userRole === 'contractor';
  const isAdmin = userRole === 'admin';
  const isRestricted = userRole === 'contractor' && activeDiscipline !== 'general';

  const filteredHistory = isRestricted 
    ? unit.history.filter(log => log.discipline === activeDiscipline)
    : unit.history;

  const activeTasks = filteredHistory.filter(log => log.status !== TaskStatus.DONE);
  const canAddReport = isAdmin || (userRole === 'contractor' && activeTasks.length > 0);
  const upcomingAppointments = unit.appointments.filter(app => !app.isCompleted);

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
        signatureUrl: unit.workConfirmation.signatureUrl,
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
    const discipline: Discipline = 
      contractor === 'plumber' ? 'plumbing' :
      contractor === 'rappelling' ? 'rappelling' :
      contractor === 'telefire' ? 'telefire' :
      contractor === 'itumit' ? 'itumit' :
      contractor === 'emperion' ? 'emperion' :
      contractor === 'workers' ? 'workers' : 'general';

    const selectedContractorLabel = (t as any)[CONTRACTORS.find(c => c.id === contractor)?.labelKey || ''];
    
    if (editingLogId) {
      onSave({
        editLog: {
          id: editingLogId,
          status,
          workerName: worker,
          contractor: selectedContractorLabel,
          description: desc,
          discipline,
          images: selectedImages.length > 0 ? selectedImages : undefined
        }
      });
      setEditingLogId(null);
    } else {
      const updates: any = { 
        newLog: { 
          status, 
          workerName: worker, 
          contractor: selectedContractorLabel, 
          description: desc, 
          discipline, 
          images: selectedImages.length > 0 ? selectedImages : undefined 
        } 
      };

      // Sync with calendar if it's a manager (Foreman) task
      if (contractor === 'manager') {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
        updates.newAppointment = {
          date: today,
          time: now,
          tenantName: displayName,
          contractor: selectedContractorLabel,
          contractorEmail: reportEmail,
          notes: desc
        };

        if (reportEmail) {
          const title = encodeURIComponent(`${t.appName}: ${displayName}`);
          const details = encodeURIComponent(`${t.building}: ${unit.buildingId.split('-')[1]}, ${t.unitLabel}: ${unit.id.split('-')[1]}\n${t.workerName}: ${worker}\n${t.whatWasDone}: ${desc}`);
          const dateStr = today.replace(/-/g, '');
          const timeStr = now.replace(/:/g, '') + '00';
          const endTimeStr = (Number(timeStr) + 10000).toString().padStart(6, '0');
          
          const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}T${timeStr}/${dateStr}T${endTimeStr}`;
          const body = encodeURIComponent(`${t.newReport} (${t.contractor_manager}):\n${t.dateLabel}: ${today}\n${t.timeLabel}: ${now}\n${t.building}: ${unit.buildingId.split('-')[1]}\n${t.whatWasDone}: ${desc}\n\n${lang === 'he' ? 'להוספה ליומן לחץ כאן' : lang === 'ru' ? 'Нажмите здесь, чтобы добавить في التقويم' : 'اضغط هنا للإضافة إلى التقويم'}:\n${gCalUrl}`);
          
          window.location.href = `mailto:${reportEmail}?subject=${title}&body=${body}`;
        }
      }

      onSave(updates);
    }

    setWorker(''); setDesc(''); setSelectedImages([]); setStatus(TaskStatus.DONE); setReportEmail(''); setActiveTab('history');
  };

  const handleAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appDate || !appTime || !appTenant) return alert(t.alertFillFields);
    const selectedContractor = (t as any)[CONTRACTORS.find(c => c.id === appContractor)?.labelKey || ''];
    onSave({ newAppointment: { date: appDate, time: appTime, tenantName: appTenant, contractor: selectedContractor, contractorEmail: appEmail, notes: appNotes } });
    
    // Auto-open mail client if email is provided
    if (appEmail) {
      const title = encodeURIComponent(`${t.appName}: ${displayName}`);
      const details = encodeURIComponent(`${t.building}: ${unit.buildingId.split('-')[1]}, ${t.unitLabel}: ${unit.id.split('-')[1]}\n${t.tenantLabel}: ${appTenant}\n${t.notesLabel}: ${appNotes}`);
      const dateStr = appDate.replace(/-/g, '');
      const timeStr = appTime.replace(/:/g, '') + '00';
      const endTimeStr = (Number(timeStr) + 10000).toString().padStart(6, '0'); // +1 hour approx
      
      const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}T${timeStr}/${dateStr}T${endTimeStr}`;
      
      const body = encodeURIComponent(`${t.scheduleTitle}:\n${t.dateLabel}: ${appDate}\n${t.timeLabel}: ${appTime}\n${t.tenantLabel}: ${appTenant}\n\n${t.notesLabel}: ${appNotes}\n\n${lang === 'he' ? 'להוספה ליומן לחץ כאן' : lang === 'ru' ? 'Нажмите здесь, чтобы добавить في التقويم' : 'اضغط هنا للإضافة إلى التقويم'}:\n${gCalUrl}`);
      
      window.location.href = `mailto:${appEmail}?subject=${title}&body=${body}`;
    }

    setAppDate(''); setAppTime(''); setAppTenant(''); setAppNotes(''); setAppEmail('');
  };

  const handleSaveVisitSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitSummary) return alert(t.alertFillFields);
    
    const updates: any = { completeAppointmentId: summarizingAppId };
    
    // Create a history log for the visit itself
    const managerLabel = (t as any)[CONTRACTORS.find(c => c.id === 'manager')?.labelKey || ''];
    const workerNameForSummary = lang === 'he' ? 'סיכום ביקור' : lang === 'ru' ? 'Итоги визита' : 'ملخص الزيارة';
    updates.newLog = {
      status: needsFollowup ? TaskStatus.NEEDS_FOLLOWUP : TaskStatus.DONE,
      workerName: workerNameForSummary,
      contractor: managerLabel,
      description: visitSummary,
      discipline: 'general'
    };

    // If followup is needed, the next task will be for the selected contractor
    if (needsFollowup) {
      const selectedContractorLabel = (t as any)[CONTRACTORS.find(c => c.id === followupContractorId)?.labelKey || ''];
      // We'll let the user create the specific contractor task in the history log by tagging it
      updates.newLog.description = `[${selectedContractorLabel}] ${visitSummary}`;
    }

    onSave(updates);
    setSummarizingAppId(null);
    setVisitSummary('');
    setNeedsFollowup(false);
    setActiveTab('history');
  };

  const triggerCalendarInvite = (app: Appointment) => {
    const title = encodeURIComponent(`${t.appName}: ${displayName}`);
    const details = encodeURIComponent(`${t.building}: ${unit.buildingId.split('-')[1]}, ${t.unitLabel}: ${unit.id.split('-')[1]}\n${t.tenantLabel}: ${app.tenantName}\n${t.notesLabel}: ${app.notes}`);
    const dateStr = app.date.replace(/-/g, '');
    const timeStr = app.time.replace(/:/g, '') + '00';
    const endTimeStr = (Number(timeStr) + 10000).toString().padStart(6, '0');
    
    const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}T${timeStr}/${dateStr}T${endTimeStr}`;
    
    const body = encodeURIComponent(`${t.scheduleTitle}:\n${t.dateLabel}: ${app.date}\n${t.timeLabel}: ${app.time}\n${t.tenantLabel}: ${app.tenantName}\n\n${t.notesLabel}: ${app.notes}\n\n${lang === 'he' ? 'להוספה ליומן לחץ כאן' : lang === 'ru' ? 'Нажмите здесь, чтобы добавить في التقويم' : 'اضغط هنا للإضافة إلى التقويم'}:\n${gCalUrl}`);
    
    window.location.href = `mailto:${app.contractorEmail}?subject=${title}&body=${body}`;
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
      onSave(updates);
      setIsSignModalOpen(false);
      setCompletingTaskId(null);
    } catch (error) {
      console.error("Error confirming work:", error);
      setIsSignModalOpen(false); // Close anyway so user isn't stuck
      setCompletingTaskId(null);
    }
  };

  const handleEditHistoryLog = (log: TaskLog) => {
    setEditingLogId(log.id);
    setWorker(log.workerName);
    setDesc(log.description);
    setStatus(log.status);
    setSelectedImages(log.images || []);
    
    // Find contractor ID by label
    const contractorMatch = CONTRACTORS.find(c => (t as any)[c.labelKey] === log.contractor);
    if (contractorMatch) {
      setContractor(contractorMatch.id);
    }
    
    setActiveTab('report');
  };

  const handleDeleteHistoryLog = (logId: string) => {
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
               <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.building}: {unit.buildingId.split('-')[1]}</span>
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
                       <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                         👤 {unit.tenantInfo?.name || t.tenantLabel} {unit.tenantInfo?.phone && `(${unit.tenantInfo.phone})`}
                       </span>
                       {userRole === 'admin' && (
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
          <button onClick={() => setActiveTab('schedule')} className={`flex-1 py-4 font-black text-xs md:text-sm transition-all border-b-4 ${activeTab === 'schedule' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>📅 {t.viewSchedule}</button>
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
                    {canEdit && (
                       <button 
                         onClick={() => setIsSignModalOpen(true)}
                         className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
                       >
                         🖋️ {t.signAndFinish}
                       </button>
                    )}
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

                      {unit.workConfirmation.signatureUrl && (
                        <div className="mt-4 pt-4 border-t border-green-100 flex flex-col items-center gap-4">
                          <div className="bg-white p-2 rounded-2xl border border-green-200 shadow-inner">
                            <img src={unit.workConfirmation.signatureUrl} alt="Signature" className="h-20 object-contain" />
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
                  {activeTasks.map(task => (
                    <div key={task.id} className="bg-white border-2 border-blue-500 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden ring-8 ring-blue-500/5">
                      <div className="absolute top-0 left-0 w-3 h-full bg-blue-600"></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl border-2 border-blue-100 shadow-inner">{task.contractor.includes('אינסטלטור') ? '🚰' : '👷'}</div>
                          <div>
                            <span className="font-black text-blue-900 text-xl block leading-tight">{task.workerName}</span>
                            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-black uppercase mt-1 inline-block shadow-sm">{task.contractor}</span>
                          </div>
                        </div>
                        <div className={`text-[10px] font-black px-3 py-1 rounded-full border-2 shadow-sm ${STATUS_CONFIG[task.status].color}`}>{(t as any)[STATUS_CONFIG[task.status].labelKey]}</div>
                      </div>
                      <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-100 shadow-inner mb-6">
                        <p className="text-sm font-bold text-gray-700 leading-relaxed">{task.description}</p>
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
                        {canEdit && (
                          <div className="flex gap-4 flex-1">
                            <button 
                              onClick={() => {
                                setCompletingTaskId(task.id);
                                setIsSignModalOpen(true);
                              }} 
                              className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                              ✅ {t.finishWorkAction}
                            </button>
                            {isAdmin && <button onClick={() => handleQuickStatusUpdate(task.id, TaskStatus.NEEDS_FOLLOWUP)} className="flex-1 bg-yellow-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-yellow-600 active:scale-95 transition-all">🔄 {t.needsFollowup}</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : unit.history.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
                  <div className="text-6xl mb-6 opacity-20 grayscale">🏗️</div>
                  {isAdmin && (
                    <button onClick={handleStartWork} className="bg-blue-600 text-white px-10 py-6 rounded-[2rem] text-xl font-black shadow-2xl hover:bg-blue-700 active:scale-95 transition-all">
                      {lang === 'he' ? '🚀 פתח משימה חדשה לביצוע' : lang === 'ru' ? '🚀 Открыть новую задачу' : '🚀 فتح مهمة تنفيذ جديدة'}
                    </button>
                  )}
                  {userRole === 'contractor' && (
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
                               {isAdmin && (
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
                               <span className="text-[10px] text-gray-300 font-black bg-gray-50 px-2 py-1 rounded-lg">{new Date(log.timestamp).toLocaleDateString()}</span>
                             </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{log.contractor}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">{log.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Existing Appointments Section */}
              {upcomingAppointments.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2">{t.upcomingAppointments}</h4>
                  {upcomingAppointments.map(app => (
                    <div key={app.id} className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm">
                      {summarizingAppId === app.id ? (
                        <form onSubmit={handleSaveVisitSummary} className="space-y-4 animate-in zoom-in-95 duration-200">
                           <h5 className="font-black text-blue-900 text-lg border-b pb-2 mb-4">📝 {t.summarizeVisit}</h5>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.visitSummaryPlaceholder}</label>
                             <textarea 
                               value={visitSummary} 
                               onChange={e => setVisitSummary(e.target.value)} 
                               rows={3} 
                               className="w-full p-4 rounded-2xl border-2 border-blue-100 focus:border-blue-500 outline-none font-bold bg-blue-50/30" 
                               placeholder={t.visitSummaryPlaceholder}
                             />
                           </div>
                           <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                             <label className="flex items-center gap-3 cursor-pointer">
                               <input type="checkbox" checked={needsFollowup} onChange={e => setNeedsFollowup(e.target.checked)} className="w-6 h-6 rounded-lg accent-blue-600" />
                               <span className="font-black text-gray-700 text-sm">{t.needFollowupTask}</span>
                             </label>
                           </div>
                           {needsFollowup && (
                             <div className="space-y-2 animate-in slide-in-from-top-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.followupContractor}</label>
                               <select 
                                 value={followupContractorId} 
                                 onChange={e => setFollowupContractorId(e.target.value)} 
                                 className="w-full p-4 rounded-xl border-2 border-blue-100 bg-white font-black"
                               >
                                 {CONTRACTORS.filter(c => c.id !== 'manager').map(c => <option key={c.id} value={c.id}>{c.icon} {(t as any)[c.labelKey]}</option>)}
                               </select>
                             </div>
                           )}
                           <div className="flex gap-2 pt-2">
                             <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all">{t.saveSummary}</button>
                             <button type="button" onClick={() => setSummarizingAppId(null)} className="px-6 bg-slate-200 text-gray-600 rounded-2xl font-black hover:bg-slate-300">
                               {lang === 'he' ? 'ביטול' : lang === 'ru' ? 'Отмена' : 'إلغاء'}
                             </button>
                           </div>
                        </form>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                               <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-lg">{app.date} | {app.time}</span>
                               <span className="text-gray-400 font-black text-[10px] uppercase">{app.contractor}</span>
                            </div>
                            <span className="font-black text-blue-900 text-xl block">{app.tenantName}</span>
                            {app.notes && <p className="text-xs text-gray-500 mt-2 italic font-bold">"{app.notes}"</p>}
                            {app.contractorEmail && (
                              <button 
                                onClick={() => triggerCalendarInvite(app)}
                                className="mt-3 flex items-center gap-2 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                              >
                                📧 {t.sendInvite}
                              </button>
                            )}
                          </div>
                          <button 
                            onClick={() => setSummarizingAppId(app.id)} 
                            className="bg-white border-2 border-blue-500 text-blue-600 px-6 py-2.5 rounded-xl text-xs font-black hover:bg-blue-50 transition-all shadow-sm"
                          >
                            {canEdit ? `✏️ ${t.summarizeVisit}` : `👁️ ${lang === 'he' ? 'צפה בפרטים' : 'Просмотр'}`}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && (
                <section className="bg-yellow-50/40 p-8 rounded-[2.5rem] border-2 border-yellow-100/60 shadow-inner">
                  <h4 className="text-xs font-black text-yellow-800 mb-8 uppercase tracking-[0.2em] flex items-center gap-4"><span className="bg-yellow-100 p-3 rounded-2xl">📅</span> {t.scheduleTitle}</h4>
                  <form onSubmit={handleAppSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.dateLabel}</label>
                      <input type="date" value={appDate} onChange={e => setAppDate(e.target.value)} disabled={!canEdit} className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-yellow-400 outline-none transition-all font-black bg-white shadow-sm disabled:opacity-50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.timeLabel}</label>
                      <input type="time" value={appTime} onChange={e => setAppTime(e.target.value)} disabled={!canEdit} className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-yellow-400 outline-none transition-all font-black bg-white shadow-sm disabled:opacity-50" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.contractorLabel}</label>
                      <select value={appContractor} onChange={e => setAppContractor(e.target.value)} disabled={!canEdit} className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-yellow-400 outline-none bg-white font-black shadow-sm disabled:opacity-50">
                        {CONTRACTORS.map(c => <option key={c.id} value={c.id}>{c.icon} {(t as any)[c.labelKey]}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.tenantLabel}</label>
                      <input type="text" value={appTenant} onChange={e => setAppTenant(e.target.value)} disabled={!canEdit} className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-yellow-400 outline-none font-black shadow-sm bg-white disabled:opacity-50" placeholder="שם מלא / טלפון" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{(t as any).emailLabel}</label>
                      <input type="email" value={appEmail} onChange={e => setAppEmail(e.target.value)} disabled={!canEdit} className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-yellow-400 outline-none font-black shadow-sm bg-white disabled:opacity-50" placeholder="example@email.com" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.notesLabel}</label>
                      <textarea value={appNotes} onChange={e => setAppNotes(e.target.value)} disabled={!canEdit} rows={2} className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-yellow-400 outline-none resize-none font-bold bg-white shadow-sm disabled:opacity-50" />
                    </div>
                    <button type="submit" className="md:col-span-2 bg-yellow-500 text-white font-black py-6 rounded-3xl hover:bg-yellow-600 transition-all shadow-xl active:scale-95 text-lg">{t.addAppointment}</button>
                  </form>
                </section>
              )}
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
                        <div className="text-sm font-bold text-gray-400">{unit.tenantInfo?.phone || (lang === 'he' ? 'אין טלפון' : 'Нет телефона')}</div>
                      </div>
                      {canEdit && (
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
                        setWorker(''); setDesc(''); setSelectedImages([]); setStatus(TaskStatus.DONE);
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
                    <select value={contractor} onChange={e => setContractor(e.target.value)} disabled={isRestricted} className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none bg-white font-black shadow-sm text-lg disabled:opacity-50">
                      {CONTRACTORS.filter(c => {
                        if (!isRestricted) return true;
                        if (activeDiscipline === 'plumbing') return c.id === 'plumber';
                        return c.id === activeDiscipline;
                      }).map(c => <option key={c.id} value={c.id}>{c.icon} {(t as any)[c.labelKey]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.workerName}</label>
                    <input value={worker} onChange={e => setWorker(e.target.value)} className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none font-black shadow-sm text-lg placeholder:opacity-20" placeholder={t.workerExample} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.currentStatus}</label>
                    <select 
                      value={status} 
                      onChange={e => setStatus(e.target.value as TaskStatus)} 
                      disabled={userRole === 'contractor'}
                      className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none bg-white font-black shadow-sm text-lg disabled:opacity-50"
                    >
                      {Object.entries(STATUS_CONFIG).map(([s, cfg]) => <option key={s} value={s}>{(t as any)[cfg.labelKey]}</option>)}
                    </select>
                  </div>
                  {contractor === 'manager' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2 transition-all">
                      <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{(t as any).emailLabel}</label>
                      <input type="email" value={reportEmail} onChange={e => setReportEmail(e.target.value)} className="w-full px-6 py-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none font-black shadow-sm text-lg placeholder:opacity-20" placeholder="manager@email.com" />
                    </div>
                  )}
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
                    <label className="text-[11px] font-black text-gray-400 uppercase px-1 tracking-widest">{t.whatWasDone}</label>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} className="w-full px-6 py-5 rounded-[2.5rem] border-2 border-gray-100 focus:border-blue-500 outline-none resize-none font-bold shadow-sm text-lg placeholder:opacity-20" placeholder={t.descriptionPlaceholder} />
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

      {isSignModalOpen && (
        <WorkConfirmationModal 
          lang={lang} 
          unitId={unit.id}
          onClose={() => { setIsSignModalOpen(false); setCompletingTaskId(null); }}
          onConfirm={handleWorkConfirmation}
        />
      )}
    </div>
  );
};

export default UnitModal;
