import React, { useState } from 'react';
import { ProjectState, Unit, TaskStatus, DisciplineDefinition } from '../types';
import { Language, translations } from '../translations';
import { CONTRACTORS, PUBLIC_AREAS } from '../constants';
import { getSMSDetailsForTask, sendSMS } from '../services/smsService';

interface Props {
  state: ProjectState;
  lang: Language;
  onSelectUnit: (buildingId: string, unitId: string | number) => void;
  userRole: 'admin' | 'contractor' | 'viewer';
  userDiscipline: string;
  disciplines: DisciplineDefinition[];
  smsTemplate?: string;
}

const ITEMS_PER_PAGE = 4;

const ScheduleView: React.FC<Props> = ({ state, lang, onSelectUnit, userRole, userDiscipline, disciplines, smsTemplate }) => {
  const t = translations[lang] as any;
  const [currentPage, setCurrentPage] = useState(0);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'range'>('all');
  const [contractorFilter, setContractorFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // SMS status state variables
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [smsSuccessId, setSmsSuccessId] = useState<Record<string, boolean>>({});
  const [smsErrorId, setSmsErrorId] = useState<Record<string, string>>({});

  // Bulk send state
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const resetFilters = () => {
    setDateFilter('all');
    setContractorFilter('all');
    setStartDate('');
    setEndDate('');
  };

  // Flatten tasks from all units
  const unifiedItems: { 
    unit: Unit; 
    item: any; 
    type: 'task';
    date: string;
    time: string;
    title: string;
    contractor: string;
    contractorId?: string;
    isCompleted: boolean;
  }[] = [];

  const today = new Date().toISOString().split('T')[0];

  (Object.values(state.units) as Unit[]).forEach(unit => {
    // Add Tasks
    unit.history.forEach(log => {
      const logDate = new Date(log.timestamp);
      const taskDate = logDate.toISOString().split('T')[0];
      const contractorId = log.contractorId;
      unifiedItems.push({
        unit,
        item: log,
        type: 'task',
        date: taskDate,
        time: logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        title: log.workerName,
        contractor: log.contractor,
        contractorId,
        isCompleted: log.status === TaskStatus.DONE
      });
    });
  });

  // Filter based on role/discipline and user-selected filters
  const filteredItems = unifiedItems.filter(item => {
    // 1. Role/Discipline restriction
    let matchesDiscipline = userRole !== 'contractor' || userDiscipline === 'all' || userDiscipline === 'general';
    if (!matchesDiscipline) {
      matchesDiscipline = item.contractorId === userDiscipline;
    }
    if (!matchesDiscipline) return false;

    // 2. Contractor Filter
    if (contractorFilter !== 'all' && item.contractorId !== contractorFilter) return false;

    // 3. Date Filter
    if (dateFilter === 'today') {
      if (item.date !== today) return false;
    } else if (dateFilter === 'tomorrow') {
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = tomorrowDate.toISOString().split('T')[0];
      if (item.date !== tomorrow) return false;
    } else if (dateFilter === 'range') {
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;
    } else {
      // 'all' filter shows everything
    }

    return true;
  });

  // Calculate tomorrow's date format and filter items for Tomorrow bulk action
  const tomorrowDateObj = new Date();
  tomorrowDateObj.setDate(tomorrowDateObj.getDate() + 1);
  const tomorrowStr = tomorrowDateObj.toISOString().split('T')[0];

  const tomorrowItems = filteredItems.filter(item => {
    return item.date === tomorrowStr && item.unit.tenantInfo?.phone;
  });

  const handleSendAllTomorrow = async () => {
    if (tomorrowItems.length === 0) return;
    const confirmMessage = lang === 'he' 
      ? `האם אתה בטוח שברצונך לשלוח תזכורת SMS אוטומטית ל-${tomorrowItems.length} דיירים שמתואמת להם משימה למחר?` 
      : `Are you sure you want to send automatic SMS reminders to ${tomorrowItems.length} tenants with coordination scheduled for tomorrow?`;

    if (!confirm(confirmMessage)) return;

    setSendingBulk(true);
    setBulkResult(null);

    let sentCount = 0;
    let failedCount = 0;

    for (const item of tomorrowItems) {
      const details = getSMSDetailsForTask(item.unit, item.item, state.buildings, smsTemplate);
      if (details.tenantPhone) {
        const res = await sendSMS(details.tenantPhone, details.message);
        if (res.success) {
          sentCount++;
          setSmsSuccessId(prev => ({ ...prev, [item.item.id]: true }));
        } else {
          failedCount++;
          setSmsErrorId(prev => ({ ...prev, [item.item.id]: res.error || 'Failed' }));
        }
      } else {
        failedCount++;
      }
    }

    setSendingBulk(false);
    setBulkResult({
      total: tomorrowItems.length,
      sent: sentCount,
      failed: failedCount
    });

    setTimeout(() => {
      setBulkResult(null);
    }, 6000);
  };

  const handleSendIndividualSMS = async (e: React.MouseEvent, unit: Unit, log: any) => {
    e.stopPropagation(); // Avoid triggering open card onClick on parent card button
    
    const details = getSMSDetailsForTask(unit, log, state.buildings, smsTemplate);
    if (!details.tenantPhone) {
      alert(lang === 'he' ? 'שגיאה: לא מוגדר מספר טלפון לדייר בדירה זו.' : 'Error: No phone number specified for this tenant.');
      return;
    }

    setSendingSmsId(log.id);
    setSmsSuccessId(prev => ({ ...prev, [log.id]: false }));
    setSmsErrorId(prev => {
      const copy = { ...prev };
      delete copy[log.id];
      return copy;
    });

    const res = await sendSMS(details.tenantPhone, details.message);
    setSendingSmsId(null);

    if (res.success) {
      setSmsSuccessId(prev => ({ ...prev, [log.id]: true }));
      setTimeout(() => {
        setSmsSuccessId(prev => ({ ...prev, [log.id]: false }));
      }, 4000);
    } else {
      setSmsErrorId(prev => ({ ...prev, [log.id]: res.error || 'Failed' }));
    }
  };

  // Sort by date and time (descending for history)
  filteredItems.sort((a, b) => 
    new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime()
  );

  // Group by date for load analysis
  const loadByDate: Record<string, Record<string, number>> = {};
  filteredItems.forEach(item => {
    if (!loadByDate[item.date]) {
      loadByDate[item.date] = {};
    }
    loadByDate[item.date][item.contractor] = (loadByDate[item.date][item.contractor] || 0) + 1;
  });

  const sortedDates = Object.keys(loadByDate).sort();
  const totalPages = Math.ceil(sortedDates.length / ITEMS_PER_PAGE);
  const visibleDates = sortedDates.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Primary Header & Quick Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-200">📅</div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 leading-none">{t.viewSchedule}</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">{t.totalItems}: {filteredItems.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {(['all', 'today', 'tomorrow'] as const).map((filter) => (
              <button 
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${dateFilter === filter ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t[filter]}
              </button>
            ))}
            <button 
              onClick={() => setDateFilter('range')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${dateFilter === 'range' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🗓️ {lang === 'he' ? 'טווח תאריכים' : 'Range'}
            </button>
          </div>
          
          <button 
            onClick={resetFilters}
            className="px-6 py-2.5 rounded-2xl text-xs font-black bg-slate-100 text-gray-400 hover:bg-slate-200 hover:text-gray-600 transition-all"
          >
            {t.resetFilters} ↺
          </button>
        </div>
      </div>

      {/* Bulk Tomorrow SMS Invitation Banner */}
      {tomorrowItems.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-4 text-right">
            <span className="text-3xl bg-white/20 p-3 rounded-2xl">📱</span>
            <div>
              <h3 className="text-lg font-black">{lang === 'he' ? 'שליחת תזכורות SMS מרוכזת' : 'Batch SMS Reminders'}</h3>
              <p className="text-xs text-blue-100 font-bold mt-1">
                {lang === 'he' 
                  ? `נמצאו ${tomorrowItems.length} תיאומים פעילים למחר עם מספרי טלפון תקינים. באפשרותך לשלוח תזכורת אוטומטית לכולם.` 
                  : `Found ${tomorrowItems.length} active coordination tasks scheduled for tomorrow with phone numbers.`}
              </p>
            </div>
          </div>
          <button
            onClick={handleSendAllTomorrow}
            disabled={sendingBulk}
            className="bg-white text-blue-900 hover:bg-blue-50 px-6 py-3.5 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition-all disabled:opacity-50 min-w-[180px]"
          >
            {sendingBulk ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="animate-spin">⏳</span>
                {lang === 'he' ? 'שולח...' : 'Sending...'}
              </span>
            ) : (
              <span>{lang === 'he' ? 'שליחת תזכורות לכולם 🚀' : 'Send Reminders to All 🚀'}</span>
            )}
          </button>
        </div>
      )}

      {bulkResult && (
        <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-950 p-4 rounded-3xl text-xs font-black text-center animate-in fade-in">
          {lang === 'he' 
            ? `סיום שליחה מרוכזת: ${bulkResult.sent} נשלחו בהצלחה, ${bulkResult.failed} נכשלו (מתוך ${bulkResult.total} סה"כ).` 
            : `Batch send completed: ${bulkResult.sent} sent, ${bulkResult.failed} failed of ${bulkResult.total}.`}
        </div>
      )}

      {/* Advanced Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/60 backdrop-blur-sm p-6 rounded-[2.5rem] border border-white shadow-sm ring-1 ring-gray-100">
        {/* Contractor Filter */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.contractorLabel}</label>
          <select 
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
            className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-sm focus:border-blue-500 transition-all outline-none"
          >
            <option value="all">{t.allContractors}</option>
            {disciplines.map(d => (
              <option key={d.id} value={d.id}>👷 {d.labels[lang] || d.labels.he}</option>
            ))}
          </select>
        </div>

        {/* Date Range Inputs */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.fromDate}</label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateFilter('range');
              }}
              className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-sm focus:border-blue-500 transition-all outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{t.toDate}</label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateFilter('range');
              }}
              className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-white font-black text-sm focus:border-blue-500 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {/* Load Analysis Section */}
      {filteredItems.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="bg-blue-50 p-2 rounded-xl text-xl">📊</span>
              <div>
                <h3 className="font-black text-gray-800 leading-tight">{t.loadAnalysis}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{lang === 'he' ? 'סה"כ פגישות ומשימות' : 'Total schedule items'}: {filteredItems.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
              <button 
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-2 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title={lang === 'he' ? 'הקודם' : lang === 'ru' ? 'Назад' : 'السابق'}
              >
                {(lang === 'he' || lang === 'ar') ? '←' : '←'}
              </button>
              <span className="text-xs font-black text-gray-500 px-2 min-w-[60px] text-center">
                {currentPage + 1} / {totalPages || 1}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-2 hover:bg-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title={lang === 'he' ? 'הבא' : lang === 'ru' ? 'Вперед' : 'التالي'}
              >
                {(lang === 'he' || lang === 'ar') ? '→' : '→'}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleDates.map(date => (
              <div key={date} className={`p-4 rounded-2xl border-2 transition-all ${date === today ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-transparent'}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-black text-gray-700">{date === today ? t.today : formatDate(date)}</span>
                  <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-black text-blue-600 shadow-sm border border-blue-50">
                    {Object.values(loadByDate[date]).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
                <div className="space-y-2">
                  {Object.entries(loadByDate[date]).map(([contractor, count]) => {
                    return (
                      <div key={contractor} className="flex justify-between items-center group">
                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5">
                          <span className="opacity-70">👷</span>
                          {contractor}
                        </span>
                        <span className={`text-[11px] font-black px-1.5 rounded-md ${count > 3 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {Object.values(loadByDate[date]).reduce((a, b) => a + b, 0) > 5 && (
                  <div className="mt-3 pt-2 border-t border-red-100">
                    <p className="text-[9px] text-red-500 font-black uppercase text-center">
                      {lang === 'he' ? '⚠️ עומס גבוה ביום זה' : lang === 'ru' ? '⚠️ Высокая нагрузка' : '⚠️ ضغط عمل مرتفع היום'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed text-gray-400">
          <div className="text-4xl mb-4">📭</div>
          <p>{lang === 'he' ? 'אין פגישות או משימות לטווח שנבחר' : lang === 'ru' ? 'Нет назначенных встреч или задач' : 'لا يوجد مواعيد או مهام'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(({ unit, item, type, date, time, title, contractor }) => {
            // Correct extraction of building number and unit identifier
            const buildingNum = unit.buildingId.split('-')[1];
            const unitIdParts = unit.id.split('-');
            const unitIdentifier = unitIdParts[unitIdParts.length - 1];
            const isPublic = isNaN(Number(unitIdentifier));
            const isToday = date === today;
            
            // Find contractor icon
            const isManager = contractor.includes('מנהל') || contractor.includes('Manager');

            return (
              <div
                key={`${type}-${item.id}`}
                onClick={() => onSelectUnit(unit.buildingId, isPublic ? unitIdentifier : Number(unitIdentifier))}
                className={`text-right group p-4 rounded-2xl border-2 transition-all hover:shadow-lg cursor-pointer ${
                  isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'
                } ${type === 'task' ? 'border-indigo-100' : ''}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {isToday ? t.today : formatDate(date)}
                  </div>
                  <div className="flex items-center gap-2">
                    {type === 'task' && (
                      <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded-md border border-indigo-100 italic uppercase">
                        {lang === 'he' ? 'משימה' : 'Task'}
                      </span>
                    )}
                    <div className="text-lg font-bold text-blue-900">{time}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-sm text-gray-800">
                    <span className="font-medium opacity-60">
                      {state.buildings.find(b => b.id === unit.buildingId)?.plotId && `${t.plot} ${state.buildings.find(b => b.id === unit.buildingId)?.plotId}, `}
                      {state.buildings.find(b => b.id === unit.buildingId)?.name || `${t.building} ${unit.buildingId.split('-')[3]}`}
                    </span>
                    <span className="mx-2 opacity-30">|</span>
                    <span className="font-bold text-blue-800">
                      {isPublic ? (t as any)[`area_${unitIdentifier}`] : `${t.apartment} ${unitIdentifier}`}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <span>👤</span> {title}
                    </span>
                    <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1 ${isManager ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-white text-blue-700 border-blue-100'}`}>
                      {isManager ? '👔' : '👷'} {contractor}
                    </span>
                  </div>
                </div>

                {(item.notes || item.description) && (
                  <div className="text-[11px] text-gray-600 bg-white/50 p-2 rounded-lg border border-gray-200/50 italic mt-2">
                    {item.notes || item.description}
                  </div>
                )}

                {/* SMS Coordination Section */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-right">
                    <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">{lang === 'he' ? 'טלפון דייר' : 'Tenant Phone'}</span>
                    <span className="text-xs font-black text-gray-700">
                      {unit.tenantInfo?.phone ? (
                        <span className="flex items-center gap-1">
                          📱 {unit.tenantInfo.phone}
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1 font-bold">
                          ⚠️ {lang === 'he' ? 'אין טלפון' : 'No phone'}
                        </span>
                      )}
                    </span>
                  </div>

                  {unit.tenantInfo?.phone && (
                    <button
                      onClick={(e) => handleSendIndividualSMS(e, unit, item)}
                      disabled={sendingSmsId === item.id}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border shadow-sm flex items-center gap-1.5 active:scale-95 ${
                        smsSuccessId[item.id]
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : smsErrorId[item.id]
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : 'bg-slate-50 text-blue-700 border-slate-200 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-100'
                      }`}
                      title={smsErrorId[item.id] ? `Error: ${smsErrorId[item.id]}` : 'Send SMS reminder'}
                    >
                      {sendingSmsId === item.id ? (
                        <>
                          <span className="animate-spin text-[10px]">⏳</span>
                          <span>{lang === 'he' ? 'שולח...' : 'Sending...'}</span>
                        </>
                      ) : smsSuccessId[item.id] ? (
                        <>
                          <span>✓</span>
                          <span>{lang === 'he' ? 'נשלח!' : 'Sent!'}</span>
                        </>
                      ) : smsErrorId[item.id] ? (
                        <>
                          <span>⚠️</span>
                          <span>{lang === 'he' ? 'נכשל' : 'Failed'}</span>
                        </>
                      ) : (
                        <>
                          <span>✉️</span>
                          <span>{lang === 'he' ? 'תזכורת' : 'Reminder'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                <div className="mt-3 flex justify-end">
                   <span className="text-[10px] text-blue-500 font-bold group-hover:underline">
                     {lang === 'he' ? 'צפייה בכרטיס הדירה ←' : lang === 'ru' ? 'Посмотреть карту ←' : 'عرض ملف الشقة ←'}
                   </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduleView;
