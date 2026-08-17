
import React from 'react';
import { Plot, ProjectState, Discipline, TaskStatus } from '../types';
import { Language, translations } from '../translations';
import { getUnit, getUnitStatus } from '../services/dataService';

interface Props {
  plots: Plot[];
  selectedPlotId: string | null;
  onSelect: (id: string) => void;
  state: ProjectState;
  lang: Language;
  discipline: Discipline;
}

const PlotSelector: React.FC<Props> = ({ plots, selectedPlotId, onSelect, state, lang, discipline }) => {
  const t = translations[lang] || translations.he;

  const getPlotStats = (plotId: string) => {
    const plotBuildings = state.buildings.filter(b => b.plotId === plotId);
    if (plotBuildings.length === 0) return 0;
    
    let totalCompleted = 0;
    let totalUnits = 0;
    
    plotBuildings.forEach(b => {
      totalUnits += b.totalUnits;
      for (let i = 1; i <= b.totalUnits; i++) {
        const unit = getUnit(state, b.id, i);
        const status = getUnitStatus(unit, discipline);
        if (status === TaskStatus.DONE) totalCompleted++;
      }
    });
    
    return Math.round((totalCompleted / totalUnits) * 100);
  };

  return (
    <div className="flex flex-wrap gap-2 p-4 justify-center md:justify-start">
      {plots.map((p) => {
        const progress = getPlotStats(p.id);
        const isActive = selectedPlotId === p.id;
        
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex flex-col items-center justify-center px-6 py-4 rounded-3xl transition-all border-2 shadow-sm min-w-[120px] ${
              isActive 
                ? 'bg-slate-900 border-slate-900 text-white transform scale-110 z-10 shadow-xl' 
                : 'bg-white border-gray-100 hover:border-slate-300 text-slate-700'
            }`}
          >
            <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">{(t as any).plot}</span>
            <span className="text-xl font-black whitespace-nowrap">{p.id}</span>
            <div className="w-full mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${isActive ? 'bg-blue-400' : 'bg-slate-400'}`} 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-[8px] mt-1 font-black ${isActive ? 'text-white' : 'text-gray-400'}`}>
              {progress}%
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default PlotSelector;
