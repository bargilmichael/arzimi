import React from 'react';
import { ProjectState, TaskStatus, Discipline, Unit, TaskLog } from '../types';
import { STATUS_CONFIG, PUBLIC_AREAS, CONTRACTORS } from '../constants';
import { Language, translations } from '../translations';

interface Props {
  state: ProjectState;
  lang: Language;
  selectedPlotId: string | null;
  discipline: Discipline;
  statusFilter: TaskStatus | 'OVERDUE' | null;
  contractorFilter: string | null;
  onSelectUnit: (buildingId: string, unitId: string | number) => void;
  onClearFilter?: () => void;
}

const FilteredUnitList: React.FC<Props> = ({ 
  state, 
  lang, 
  selectedPlotId, 
  discipline, 
  statusFilter, 
  contractorFilter,
  onSelectUnit,
  onClearFilter
}) => {
  const t = translations[lang];

  const getFilteredUnits = () => {
    const results: Unit[] = [];
    
    const targetBuildings = selectedPlotId 
      ? state.buildings.filter(b => b.plotId === selectedPlotId)
      : state.buildings;

    const buildingIds = new Set(targetBuildings.map(b => b.id));

    // Iterate over all units that have data in the state
    (Object.values(state.units) as Unit[]).forEach(unit => {
      if (!buildingIds.has(unit.buildingId)) return;
      if (checkUnitMatch(unit)) results.push(unit);
    });

    function checkUnitMatch(unit: Unit) {
      if (!unit || !unit.history || unit.history.length === 0) return false;

      // Identify the LATEST status and log for each contractor/discipline
      const latestLogs = new Map<string, TaskLog>();
      
      const logs = (discipline === 'general' || discipline === 'all') 
        ? unit.history 
        : unit.history.filter(h => h.discipline === discipline);
        
      logs.forEach(log => {
        const key = log.contractorId || log.discipline || 'unknown';
        if (!latestLogs.has(key)) {
          latestLogs.set(key, log);
        }
      });

      if (contractorFilter) {
        const hasMatchingContractorTask = Array.from(latestLogs.values()).some(log => {
          const cId = log.contractorId || log.contractor || 'workers';
          const isOpenDefect = log.status !== TaskStatus.NOT_STARTED && log.status !== TaskStatus.DONE;
          return cId === contractorFilter && isOpenDefect;
        });
        if (!hasMatchingContractorTask) return false;
      }

      if (statusFilter) {
        if (statusFilter === 'OVERDUE') {
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return Array.from(latestLogs.values()).some(log => 
            log.status !== TaskStatus.NOT_STARTED && 
            log.status !== TaskStatus.DONE && 
            log.timestamp < sevenDaysAgo
          );
        }
        return Array.from(latestLogs.values()).some(log => log.status === statusFilter);
      }

      if (!contractorFilter && !statusFilter) {
        return Array.from(latestLogs.values()).some(log => log.status !== TaskStatus.DONE);
      }

      return true;
    }

    return results;
  };

  const filteredUnits = getFilteredUnits();
  const config = statusFilter && statusFilter !== 'OVERDUE' ? STATUS_CONFIG[statusFilter as TaskStatus] : null;

  return (
    <div className="mt-8 bg-white rounded-[3rem] shadow-2xl p-8 border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-4">
          <span className="text-4xl">
            {statusFilter === 'OVERDUE' ? '⚠️' : config?.icon || (contractorFilter ? '👷' : '⚙️')}
          </span>
          <span>
            {filteredUnits.length} {
              statusFilter === 'OVERDUE' 
                ? (lang === 'he' ? 'באיחור' : lang === 'ru' ? 'Просроченные' : 'Overdue')
                : config 
                  ? (t as any)[config.labelKey] 
                  : contractorFilter
                    ? `${lang === 'he' ? 'ליקויים בטיפול:' : 'Defects for:'} ${
                        (() => {
                          const contractorObj = CONTRACTORS.find(c => c.id === contractorFilter);
                          return contractorObj ? `${contractorObj.icon} ${(translations[lang] as any)[contractorObj.labelKey]}` : contractorFilter;
                        })()
                      }`
                    : (t as any).viewProcesses
            }
          </span>
        </h2>
        {(statusFilter || contractorFilter) && (
          <button 
            onClick={onClearFilter}
            className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition-all"
            style={{ cursor: 'pointer' }}
          >
            ❌ {lang === 'he' ? 'נקה סינון' : 'Clear Filter'}
          </button>
        )}
        <div className="bg-slate-100 px-6 py-2 rounded-full border border-slate-200">
           <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {selectedPlotId ? `${t.plot} ${selectedPlotId}` : t.allPlots}
           </span>
        </div>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <span className="text-6xl mb-4 block">🔍</span>
          <p className="text-xl font-bold text-slate-400">{(t as any).noResultsFound}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredUnits.map((unit) => {
            const building = state.buildings.find(b => b.id === unit.buildingId);
            const buildingName = lang === 'ru' ? building?.name.replace('בניין', 'Зд.') : lang === 'ar' ? building?.name.replace('בניין', 'م.') : building?.name;
            
            const unitIdParts = unit.id.split('-');
            const unitIdentifier = unitIdParts[unitIdParts.length - 1];
            const isPublicArea = isNaN(Number(unitIdentifier));
            const publicAreaConfig = isPublicArea ? PUBLIC_AREAS.find(a => a.id === unitIdentifier) : null;

            if (statusFilter === 'OVERDUE') {
              const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
              const latestLogs = new Map<string, TaskLog>();
              const logs = (discipline === 'general' || discipline === 'all')
                ? unit.history
                : unit.history.filter(h => h.discipline === discipline);

              logs.forEach(log => {
                const key = log.contractorId || log.discipline || 'unknown';
                if (!latestLogs.has(key)) {
                  latestLogs.set(key, log);
                }
              });

              let oldestOverdueLog: TaskLog | null = null;
              latestLogs.forEach(log => {
                if (log.status !== TaskStatus.NOT_STARTED && log.status !== TaskStatus.DONE && log.timestamp < sevenDaysAgo) {
                  if (!oldestOverdueLog || log.timestamp < oldestOverdueLog.timestamp) {
                    oldestOverdueLog = log;
                  }
                }
              });

              const dueDateVal = oldestOverdueLog ? oldestOverdueLog.timestamp + 7 * 24 * 60 * 60 * 1000 : Date.now();
              const dueDateStr = new Date(dueDateVal).toLocaleDateString('he-IL');

              return (
                <button
                  key={unit.id}
                  onClick={() => onSelectUnit(unit.buildingId, isPublicArea ? unitIdentifier : unit.number)}
                  className="flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 text-right bg-red-50 border-red-200 text-red-950 shadow-sm w-full group"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-red-500 tracking-widest leading-none mb-1">{buildingName}</span>
                    <span className="text-xl font-black">{isPublicArea ? (t as any)[publicAreaConfig?.labelKey || ''] : `${t.apartment} ${unitIdentifier}`}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-md mb-2">{isPublicArea ? 'PL' : 'AP'}-{unit.number || '0'}</span>
                    <span className="text-xs font-black text-red-600 animate-pulse">
                      {lang === 'he' ? `פג תוקף: ${dueDateStr}` : lang === 'ru' ? `Просрочено: ${dueDateStr}` : `منتهي الصلاحية: ${dueDateStr}`}
                    </span>
                  </div>
                </button>
              );
            }

            const isCoordTask = statusFilter === TaskStatus.COORDINATION_REQUIRED || 
                                unit.history.some(h => h.status === TaskStatus.COORDINATION_REQUIRED);

            if (isCoordTask && statusFilter === TaskStatus.COORDINATION_REQUIRED) {
              const projectObj = state.projects.find(p => p.id === unit.projectId);
              const projectName = projectObj ? projectObj.name : (unit.projectId === 'beer-yaakov' ? 'באר יעקב תלמים' : 'בני ברק');
              const lastCoordinationLog = unit.history.find(h => h.status === TaskStatus.COORDINATION_REQUIRED);
              const professionTitle = lastCoordinationLog?.workerName || (lang === 'he' ? 'דרוש: בעל מקצוע' : 'Required: Profession');

              return (
                <button
                  key={unit.id}
                  onClick={() => onSelectUnit(unit.buildingId, isPublicArea ? unitIdentifier : unit.number)}
                  className="flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 text-right bg-indigo-50 border-indigo-200 text-indigo-950 shadow-sm w-full"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest leading-none mb-1">{projectName}</span>
                    <span className="text-[11px] font-bold text-slate-500 leading-tight mb-1">{buildingName}</span>
                    <span className="text-xl font-black">{isPublicArea ? (t as any)[publicAreaConfig?.labelKey || ''] : `${t.apartment} ${unitIdentifier}`}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md mb-2">{isPublicArea ? 'PL' : 'AP'}-{unit.number || '0'}</span>
                    <span className="text-xs font-black text-indigo-600 animate-pulse">{professionTitle}</span>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={unit.id}
                onClick={() => onSelectUnit(unit.buildingId, isPublicArea ? unitIdentifier : unit.number)}
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 text-right group w-full ${config?.color || 'bg-slate-50 border-slate-100 text-slate-700'}`}
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">{buildingName}</span>
                  <span className="text-xl font-black">{isPublicArea ? (t as any)[publicAreaConfig?.labelKey || ''] : `${t.apartment} ${unitIdentifier}`}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black opacity-40">{isPublicArea ? 'PL' : 'AP'}-{unit.number || '0'}</span>
                  {unit.tenantInfo?.name && (
                    <span className="text-[10px] font-bold mt-1 max-w-[100px] truncate">{unit.tenantInfo.name}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilteredUnitList;
