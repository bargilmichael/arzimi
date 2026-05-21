
import React from 'react';
import { ProjectState, TaskStatus, Discipline, Unit } from '../types';
import { STATUS_CONFIG, PUBLIC_AREAS } from '../constants';
import { Language, translations } from '../translations';
import { getUnit, getUnitStatus } from '../services/dataService';

interface Props {
  state: ProjectState;
  lang: Language;
  selectedPlotId: string | null;
  discipline: Discipline;
  statusFilter: TaskStatus | null;
  onSelectUnit: (buildingId: string, unitId: string | number) => void;
}

const FilteredUnitList: React.FC<Props> = ({ state, lang, selectedPlotId, discipline, statusFilter, onSelectUnit }) => {
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

      // Identify the LATEST status for each contractor/discipline
      const latestStatuses = new Map<string, TaskStatus>();
      
      const logs = (discipline === 'general' || discipline === 'all') 
        ? unit.history 
        : unit.history.filter(h => h.discipline === discipline);
        
      logs.forEach(log => {
        // Fallback to discipline if contractorId is missing or the same
        const key = log.contractorId || log.discipline || 'unknown';
        if (!latestStatuses.has(key)) {
          latestStatuses.set(key, log.status);
        }
      });

      // Current unique statuses for this unit
      const unitStatuses = Array.from(latestStatuses.values());
      
      if (!statusFilter) {
        // Default "In Processes" view: show anything not DONE
        return unitStatuses.some(s => s !== TaskStatus.DONE);
      }
      
      return unitStatuses.includes(statusFilter);
    }

    return results;
  };

  const filteredUnits = getFilteredUnits();
  const config = statusFilter ? STATUS_CONFIG[statusFilter] : null;

  return (
    <div className="mt-8 bg-white rounded-[3rem] shadow-2xl p-8 border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-4">
          <span className="text-4xl">{config?.icon || '⚙️'}</span>
          <span>{filteredUnits.length} {config ? (t as any)[config.labelKey] : (t as any).viewProcesses}</span>
        </h2>
        {statusFilter && (
          <button 
            onClick={() => onSelectUnit && (onSelectUnit as any)(null, null)} // Hack to trigger status clear if we had a callback for it
            className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition-all"
            style={{ cursor: 'pointer' }}
            onClickCapture={() => {
              // App.tsx doesn't provide a direct way to clear status from here currently, 
              // but we can assume the user would click the Processes tab again or we can add it later.
            }}
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
            const buildingName = lang === 'ru' ? building?.name.replace('בניין', 'Зד.') : lang === 'ar' ? building?.name.replace('בניין', 'م.') : building?.name;
            
            const unitIdParts = unit.id.split('-');
            const unitIdentifier = unitIdParts[unitIdParts.length - 1];
            const isPublicArea = isNaN(Number(unitIdentifier));
            const publicAreaConfig = isPublicArea ? PUBLIC_AREAS.find(a => a.id === unitIdentifier) : null;

            return (
              <button
                key={unit.id}
                onClick={() => onSelectUnit(unit.buildingId, isPublicArea ? unitIdentifier : unit.number)}
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 text-right group ${config?.color || 'bg-slate-50 border-slate-100 text-slate-700'}`}
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
