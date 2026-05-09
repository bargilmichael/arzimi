import React, { useState, useMemo } from 'react';
import { ProjectState, TaskLog, Unit, TaskStatus } from '../types';
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
}

const ProjectHistoryView: React.FC<Props> = ({ state, lang, onSelectUnit, onUpdate, onClearAll, onDeleteMyTasks, userRole, userDiscipline }) => {
  const [filterPlot, setFilterPlot] = useState<string>('all');
  const [filterBuilding, setFilterBuilding] = useState<string>('all');
  const [filterContractor, setFilterContractor] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>(TaskStatus.NOT_STARTED);
  
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'single' | 'my-tasks' | 'clear-all';
    unit?: Unit;
    logId?: string;
  }>({ show: false, type: 'single' });

  const t = translations[lang];

  const handleEditSave = (unit: Unit, log: TaskLog) => {
    onUpdate({
      editLog: {
        ...log,
        description: editDescription,
        status: editStatus
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
        const matchesDiscipline = userRole !== 'contractor' || userDiscipline === 'all' || log.discipline === userDiscipline;
        
        const unitIdParts = unit.id.split('-');
        const unitIdentifier = unitIdParts[unitIdParts.length - 1];
        const matchesUnit = filterUnit === 'all' || unitIdentifier === filterUnit;

        if (matchesPlot && matchesBuilding && matchesContractor && matchesUnit && matchesDiscipline) {
          allLogs.push({ log, unit });
        }
      });
    });
    // Sort by newest first
    return allLogs.sort((a, b) => b.log.timestamp - a.log.timestamp);
  }, [state, filterPlot, filterBuilding, filterContractor, filterUnit, buildingToPlot]);

  const resetFilters = () => {
    setFilterPlot('all');
    setFilterBuilding('all');
    setFilterContractor('all');
    setFilterUnit('all');
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
            {userRole === 'admin' && onClearAll && filteredLogs.length > 0 && (
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
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              {CONTRACTORS.filter(c => {
                if (userRole !== 'contractor' || userDiscipline === 'all') return true;
                if (userDiscipline === 'plumbing') return c.id === 'plumber';
                return c.id === userDiscipline;
              }).map(c => (
                <option key={c.id} value={(t as any)[c.labelKey]}>{c.icon} {(t as any)[c.labelKey]}</option>
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
            const buildingNum = unit.buildingId.split('-').pop();
            const plotId = buildingToPlot[unit.buildingId];
            const plot = state.plots.find(p => p.id === plotId);
            const plotName = plot ? plot.name : plotId;
            const unitIdParts = unit.id.split('-');
            const unitIdentifier = unitIdParts[unitIdParts.length - 1];
            const isPublic = isNaN(Number(unitIdentifier));
            const statusCfg = STATUS_CONFIG[log.status];

            return (
              <div 
                key={log.id} 
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-start md:items-center hover:border-blue-200 transition-colors"
                // Removed onClick from parent to avoid event conflicts
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

                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{log.workerName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${log.contractor.includes('מנהל') ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      {log.contractor}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                      {new Date(log.timestamp).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'ar' ? 'ar-SA' : 'he-IL')}
                    </span>
                  </div>
                  
                  {editingLogId === log.id ? (
                    <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <textarea 
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-blue-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <select 
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                          className="text-xs border border-gray-200 rounded-lg p-1"
                        >
                          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                            <option key={status} value={status}>{(t as any)[config.labelKey]}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => handleEditSave(unit, log)}
                          className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-lg hover:bg-blue-700"
                        >
                          {(t as any).save}
                        </button>
                        <button 
                          onClick={() => setEditingLogId(null)}
                          className="bg-gray-100 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-lg hover:bg-gray-200"
                        >
                          {(t as any).cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 line-clamp-2 md:line-clamp-1">{log.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {userRole === 'admin' && editingLogId !== log.id && (
                      <div className="flex gap-1 mr-2 border-r pr-2 border-gray-100">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEditStart(log);
                          }}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors z-10"
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
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors z-10"
                          title={(t as any).delete}
                        >
                          <span className="pointer-events-none">🗑️</span>
                        </button>
                      </div>
                    )}
                    <span className={`text-[10px] px-3 py-1 rounded-full border font-bold ${statusCfg.color}`}>
                      {(t as any)[statusCfg.labelKey]}
                    </span>
                  </div>
                  <button 
                    className="text-blue-600 text-xs font-bold hover:underline whitespace-nowrap bg-blue-50 px-3 py-1.5 rounded-lg"
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
    </div>
  );
};

export default ProjectHistoryView;