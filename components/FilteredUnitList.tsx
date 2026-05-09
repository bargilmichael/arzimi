
import React from 'react';
import { ProjectState, TaskStatus, Discipline, Unit } from '../types';
import { STATUS_CONFIG } from '../constants';
import { Language, translations } from '../translations';
import { getUnit, getUnitStatus } from '../services/dataService';

interface Props {
  state: ProjectState;
  lang: Language;
  selectedPlotId: string | null;
  discipline: Discipline;
  statusFilter: TaskStatus;
  onSelectUnit: (buildingId: string, unitId: string | number) => void;
}

const FilteredUnitList: React.FC<Props> = ({ state, lang, selectedPlotId, discipline, statusFilter, onSelectUnit }) => {
  const t = translations[lang];

  const getFilteredUnits = () => {
    const results: Unit[] = [];
    
    const targetBuildings = selectedPlotId 
      ? state.buildings.filter(b => b.plotId === selectedPlotId)
      : state.buildings;

    targetBuildings.forEach(building => {
      for (let i = 1; i <= building.totalUnits; i++) {
        const unit = getUnit(state, building.id, i);
        const finalStatus = getUnitStatus(unit, discipline);
        
        if (finalStatus === statusFilter) {
          results.push(unit);
        }
      }
    });

    return results;
  };

  const filteredUnits = getFilteredUnits();
  const config = STATUS_CONFIG[statusFilter];

  return (
    <div className="mt-8 bg-white rounded-[3rem] shadow-2xl p-8 border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-4">
          <span className="text-4xl">{config.icon}</span>
          <span>{filteredUnits.length} {(t as any)[config.labelKey]}</span>
        </h2>
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
            
            return (
              <button
                key={unit.id}
                onClick={() => onSelectUnit(unit.buildingId, unit.number)}
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 text-right group ${config.color}`}
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">{buildingName}</span>
                  <span className="text-xl font-black">{t.apartment} {unit.number}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-black opacity-40">#{unit.id}</span>
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
