import React, { useState, useMemo } from 'react';
import { ProjectState, TaskLog, Unit, TaskStatus, DisciplineDefinition } from '../types';
import { STATUS_CONFIG, CONTRACTORS, PUBLIC_AREAS, UNITS_PER_BUILDING } from '../constants';
import { Language, translations } from '../translations';

interface Props {
  state: ProjectState;
  lang: Language;
  onSelectUnit: (buildingId: string, unitId: string | number) => void;
  onUpdate: (updates: any, unit: Unit) => void;
  onClearAll?: () => void;
  onDeleteMyTasks?: () => void;
  userRole: 'admin' | 'contractor' | 'viewer';
  userDiscipline: string;
  disciplines: DisciplineDefinition[];
}

const ProjectHistoryView: React.FC<Props> = ({ state, lang, onSelectUnit, onUpdate, onClearAll, onDeleteMyTasks, userRole, userDiscipline, disciplines }) => {
  const [filterPlot, setFilterPlot] = useState<string>('all');
  const [filterBuilding, setFilterBuilding] = useState<string>('all');
  const [filterContractor, setFilterContractor] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [viewingConfirmationId, setViewingConfirmationId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>(TaskStatus.NOT_STARTED);
  const [editWorkerName, setEditWorkerName] = useState('');
  const [editDisciplineId, setEditDisciplineId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'single' | 'my-tasks' | 'clear-all';
    unit?: Unit;
    logId?: string;
  }>({ show: false, type: 'single' });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr; // Already formatted
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  const t = translations[lang];

  const handleEditSave = (unit: Unit, log: TaskLog) => {
    const newTimestamp = new Date(`${editDate}T${editTime}`).getTime();
    const selectedDisc = disciplines.find(d => d.id === editDisciplineId);
    const contractorLabel = selectedDisc?.labels[lang] || selectedDisc?.labels.he || editDisciplineId;

    onUpdate({
      editLog: {
        ...log,
        description: editDescription,
        status: editStatus,
        timestamp: newTimestamp,
        workerName: editWorkerName,
        discipline: editDisciplineId,
        contractor: contractorLabel
      }
    }, unit);
    setEditingLogId(null);
  };

  const confirmDelete = () => {
    if (confirmModal.type === 'single' && confirmModal.unit && confirmModal.logId) {
      onUpdate({ deleteLogId: confirmModal.logId }, confirmModal.unit);
    } else if (confirmModal.type === 'my-tasks' && onDeleteMyTasks) {
      onDeleteMyTasks();
    } else if (confirmModal.type === 'clear-all' && onClearAll) {
      onClearAll();
    }
    setConfirmModal({ show: false, type: 'single' });
  };

  const handleDelete = (unit: Unit, logId: string) => {
    setConfirmModal({ show: true, type: 'single', unit, logId });
  };

  const handleEditStart = (log: TaskLog) => {
    setEditingLogId(log.id);
    setEditDescription(log.description);
    setEditStatus(log.status);
    setEditWorkerName(log.workerName);
    setEditDisciplineId(log.discipline);
    const dateObj = new Date(log.timestamp);
    setEditDate(dateObj.toISOString().split('T')[0]);
    setEditTime(dateObj.toTimeString().split(' ')[0].substring(0, 5));
  };

  // Map building to plot for quick lookup
  const buildingToPlot = useMemo(() => {
    const map: Record<string, string> = {};
    state.buildings.forEach(b => {
      map[b.id] = b.plotId;
    });
    return map;
  }, [state.buildings]);

  // Flatten and filter logs
  const filteredLogs = useMemo(() => {
    const allLogs: { log: TaskLog, unit: Unit }[] = [];
    (Object.values(state.units) as Unit[]).forEach(unit => {
      unit.history.forEach(log => {
        const plotId = buildingToPlot[unit.buildingId];
        const matchesPlot = filterPlot === 'all' || plotId === filterPlot;
        const matchesBuilding = filterBuilding === 'all' || unit.buildingId === filterBuilding;
        const matchesContractor = filterContractor === 'all' || log.contractor === filterContractor;
        const isSupervisor = userRole === 'admin' || userDiscipline === 'general' || userDiscipline === 'all';
        const matchesDiscipline = userRole !== 'contractor' || userDiscipline === 'all' || isSupervisor || log.discipline === userDiscipline;
        
        const unitIdParts = unit.id.split('-');
        const unitIdentifier = unitIdParts[unitIdParts.length - 1];
        const matchesUnit = filterUnit === 'all' || unitIdentifier === filterUnit;

        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        const matchesDate = !filterDate || logDate === filterDate;

        if (matchesPlot && matchesBuilding && matchesContractor && matchesUnit && matchesDiscipline && matchesDate) {
          allLogs.push({ log, unit });
        }
      });
    });
    // Sort by newest first
    return allLogs.sort((a, b) => b.log.timestamp - a.log.timestamp);
  }, [state, filterPlot, filterBuilding, filterContractor, filterUnit, filterDate, buildingToPlot]);

  const resetFilters = () => {
    setFilterPlot('all');
    setFilterBuilding('all');
    setFilterContractor('all');
    setFilterUnit('all');
    setFilterDate('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">📜</span>
            {t.fullHistoryTitle}
          </h2>
            <div className="flex gap-2">
              {onDeleteMyTasks && filteredLogs.length > 0 && (
                <button 
                  onClick={() => setConfirmModal({ show: true, type: 'my-tasks' })}
                  className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-100 transition-all border border-blue-100 flex items-center gap-2"
                >
                  🧹 {lang === 'he' ? 'מחק את כל המשימות שלי' : 'Delete My Tasks'}
                </button>
              )}
              {(userRole === 'admin' || userDiscipline === 'general' || userDiscipline === 'all') && onClearAll && filteredLogs.length > 0 && (
                <button 
                  onClick={() => setConfirmModal({ show: true, type: 'clear-all' })}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-100 transition-all border border-red-100 flex items-center gap-2"
                >
                  🗑️ {lang === 'he' ? 'מחק את כל ההיסטוריה' : 'Clear All History'}
                </button>
              )}
            </div>
        </div>
        
        {/* Filters Grid */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Plot Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{(t as any).filterByPlot}</label>
            <select 
              value={filterPlot} 
              onChange={(e) => {
                setFilterPlot(e.target.value);
                setFilterBuilding('all');
                setFilterUnit('all');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">{(t as any).allPlots}</option>
              {state.plots.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Building Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.filterByBuilding}</label>
            <select 
              value={filterBuilding} 
              onChange={(e) => {
                setFilterBuilding(e.target.value);
                setFilterUnit('all'); // Reset unit when building changes to avoid confusion
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">{t.allBuildings}</option>
              {state.buildings.filter(b => filterPlot === 'all' || b.plotId === filterPlot).map(b => (
                <option key={b.id} value={b.id}>
                  {lang === 'ru' ? b.name.replace('בניין', 'Здание') : lang === 'ar' ? b.name.replace('בניין', 'مבنى') : b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contractor Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.filterByContractor}</label>
            <select 
              value={filterContractor} 
              onChange={(e) => setFilterContractor(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">{t.allContractors}</option>
              {disciplines.filter(d => {
                if (userRole !== 'contractor' || userDiscipline === 'all' || userDiscipline === 'general') return true;
                return d.id === userDiscipline;
              }).map(d => (
                <option key={d.id} value={d.labels[lang] || d.labels.he}>👷 {d.labels[lang] || d.labels.he}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.filterByUnit}</label>
            <select 
              value={filterUnit} 
              onChange={(e) => setFilterUnit(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">{t.allUnits}</option>
              <optgroup label={t.apartment}>
                {Array.from({ length: UNITS_PER_BUILDING }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num.toString()}>{t.apartment} {num}</option>
                ))}
              </optgroup>
              <optgroup label={t.publicAreas}>
                {PUBLIC_AREAS.map(area => (
                  <option key={area.id} value={area.id}>{(t as any)[area.labelKey]}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Date Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase px-1">{t.dateLabel}</label>
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none h-[42px]"
            />
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button 
              onClick={resetFilters}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-400 text-xs font-bold hover:bg-gray-50 transition-colors"
            >
              {lang === 'he' ? 'הסר מסננים ×' : lang === 'ru' ? 'Сбросить фильтры ×' : 'إزالة الفلاتر ×'}
            </button>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed text-gray-400">
          <div className="text-4xl mb-4">📂</div>
          <p>{t.noHistory}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-[10px] font-bold text-gray-400 px-2 uppercase tracking-widest">
            {t.resultsFound.replace('{count}', filteredLogs.length.toString())}
          </div>
          {filteredLogs.map(({ log, unit }) => {
            const buildingIdParts = unit.buildingId.split('-');
            const buildingNum = buildingIdParts[3] || buildingIdParts[buildingIdParts.length - 1];
            const plotId = buildingToPlot[unit.buildingId];
            const plot = state.plots.find(p => p.id === plotId);
            const plotName = plot ? plot.name : plotId;
            const unitIdParts = unit.id.split('-');
            const unitIdentifier = unitIdParts[unitIdParts.length - 1];
            const isPublic = isNaN(Number(unitIdentifier));
            const statusCfg = STATUS_CONFIG[log.status];

            const dateObj = new Date(log.timestamp);
            const formattedDate = formatDate(dateObj.toISOString().split('T')[0]);
            const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            return (
              <div 
                key={log.id} 
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-start md:items-center hover:border-blue-200 transition-colors overflow-hidden"
              >
                <div 
                  className="flex gap-2 min-w-[120px] cursor-pointer group"
                  onClick={() => onSelectUnit(unit.buildingId, isPublic ? unitIdentifier : Number(unitIdentifier))}
                >
                  <div className={`flex flex-col items-center justify-center p-2 rounded-xl border flex-1 bg-gray-50 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors`}>
                    <span className="text-[8px] text-gray-400 font-bold uppercase">{plotName}</span>
                    <span className="text-[10px] text-blue-600 font-black tracking-tighter">{t.building} {buildingNum}</span>
                    <span className="text-lg font-black text-blue-900 leading-tight">
                      {isPublic ? (lang === 'he' ? 'ציבורי' : lang === 'ru' ? 'Общ.' : 'عام') : unitIdentifier}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-1 min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-800 truncate max-w-[150px]">{log.workerName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold whitespace-nowrap ${log.contractor.includes('מנהל') ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      {log.contractor}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                      {formattedDate} | {formattedTime}
                    </span>
                  </div>
                  
                  {editingLogId === log.id ? (
                    <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.workerName}</label>
                          <input 
                            type="text"
                            value={editWorkerName}
                            onChange={(e) => setEditWorkerName(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.disciplineLabel}</label>
                          <select 
                            value={editDisciplineId}
                            onChange={(e) => setEditDisciplineId(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            {disciplines.map(d => (
                              <option key={d.id} value={d.id}>{d.labels[lang] || d.labels.he}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.dateLabel}</label>
                          <input 
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.timeLabel}</label>
                          <input 
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.descriptionPlaceholder}</label>
                        <textarea 
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="space-y-1 flex-1">
                           <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.currentStatus}</label>
                           <select 
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                              <option key={status} value={status}>{(t as any)[config.labelKey]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditSave(unit, log)}
                            className="bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-all"
                          >
                            {(t as any).save}
                          </button>
                          <button 
                            onClick={() => setEditingLogId(null)}
                            className="bg-gray-100 text-gray-600 text-[10px] font-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-all"
                          >
                            {(t as any).cancel}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 break-words line-clamp-2 md:line-clamp-2 leading-tight">
                      {log.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-shrink-0 border-t md:border-t-0 pt-3 md:pt-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {editingLogId !== log.id && (
                      <div className="flex gap-1 mr-2 border-r pr-2 border-gray-100 items-center">
                        {log.confirmationId && (
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setViewingConfirmationId(log.confirmationId || null);
                            }}
                            className="flex items-center gap-1 px-2 py-1.5 bg-green-50 hover:bg-green-100 rounded-xl text-green-700 transition-all border border-green-100 shadow-sm"
                            title={t.viewConfirmation}
                          >
                            <span className="text-sm">📄</span>
                            <span className="text-[10px] font-black hidden sm:inline uppercase">{(t as any).viewConfirmation || 'אישור'}</span>
                          </button>
                        )}
                        {(userRole === 'admin' || userDiscipline === 'general' || userDiscipline === 'all') && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditStart(log);
                              }}
                              className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                              title={(t as any).edit}
                            >
                              <span className="pointer-events-none">✏️</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(unit, log.id);
                              }}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                              title={(t as any).delete}
                            >
                              <span className="pointer-events-none">🗑️</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <span className={`text-[10px] px-3 py-1 rounded-full border font-bold whitespace-nowrap ${statusCfg.color}`}>
                      {(t as any)[statusCfg.labelKey]}
                    </span>
                  </div>
                  <button 
                    className="text-blue-600 text-[11px] font-black hover:underline whitespace-nowrap bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm"
                    onClick={() => onSelectUnit(unit.buildingId, isPublic ? unitIdentifier : Number(unitIdentifier))}
                  >
                    {(t as any).viewDetails} ←
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-6xl mb-6 text-center">⚠️</div>
            <h3 className="text-xl font-black text-center text-gray-800 mb-3">
              {confirmModal.type === 'single' ? (t as any).confirmDelete : 
               confirmModal.type === 'my-tasks' ? (lang === 'he' ? 'מחיקת כל המשימות שלי' : 'Delete All My Tasks') : 
               (lang === 'he' ? 'מחיקת כל ההיסטוריה' : 'Clear All History')}
            </h3>
            <p className="text-center text-gray-500 font-bold mb-8">
              {confirmModal.type === 'single' ? (t as any).confirmDelete : 
               confirmModal.type === 'my-tasks' ? (lang === 'he' ? 'האם אתה בטוח שברצונך למחוק את כל המשימות שלך מההיסטוריה?' : 'Are you sure you want to delete all your tasks from history?') :
               (lang === 'he' ? 'האם אתה בטוח שברצונך למחוק את כל ההיסטוריה?' : 'Are you sure you want to clear all history?')}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200"
              >
                {(t as any).delete}
              </button>
              <button 
                onClick={() => setConfirmModal({ show: false, type: 'single' })}
                className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-95"
              >
                {(t as any).cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingConfirmationId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingConfirmationId(null)}>
           {(() => {
             // Find the log and unit to get the confirmation
             let foundConf = null;
             for (const unit of Object.values(state.units) as Unit[]) {
               const conf = unit.workConfirmations?.find(c => c.id === viewingConfirmationId) || 
                            (unit.workConfirmation?.id === viewingConfirmationId ? unit.workConfirmation : null);
               if (conf) {
                 foundConf = conf;
                 break;
               }
             }

             if (!foundConf) return null;

             return (
               <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="text-2xl font-black text-blue-900">📄 {t.workConfirmationTitle}</h3>
                   <button onClick={() => setViewingConfirmationId(null)} className="text-3xl text-gray-400 hover:text-red-500">&times;</button>
                 </div>
                 <div className="space-y-6">
                   <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                     <span>{(t as any).signedBy}: {foundConf.signerName}</span>
                     <span>{new Date(foundConf.timestamp).toLocaleDateString()}</span>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.descriptionInLang}</label>
                     <div className="max-h-[200px] overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                       <p className="text-sm font-bold whitespace-pre-wrap">{foundConf.originalDescription}</p>
                     </div>
                   </div>
                   {foundConf.translatedDescription && (
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t.translatedDescriptionLabel}</label>
                       <div className="max-h-[200px] overflow-y-auto p-4 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100 shadow-inner">
                         <p className="text-sm font-black italic whitespace-pre-wrap">{foundConf.translatedDescription}</p>
                       </div>
                     </div>
                   )}
                   {foundConf.attachmentUrl && (
                     <div className="rounded-3xl overflow-hidden border-4 border-white shadow-lg">
                       <img 
                         src={foundConf.attachmentUrl} 
                         alt="confirmation" 
                         className="w-full h-auto max-h-64 object-cover cursor-pointer" 
                         onClick={() => window.open(foundConf.attachmentUrl)} 
                       />
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

export default ProjectHistoryView;