
import React from 'react';
import { Building, ProjectState, Discipline, TaskStatus } from '../types';
import { Language, translations } from '../translations';
import { getUnit, getUnitStatus } from '../services/dataService';
import { UNITS_PER_BUILDING } from '../constants';

interface Props {
  buildings: Building[];
  selectedBuildingId: string | null;
  onSelect: (id: string) => void;
  state: ProjectState;
  lang: Language;
  discipline: Discipline;
}

const BuildingSelector: React.FC<Props> = ({ buildings, selectedBuildingId, onSelect, state, lang, discipline }) => {
  const t = translations[lang];

  const getCompletionStats = (b: Building) => {
    let completed = 0;
    const totalUnits = b.totalUnits || UNITS_PER_BUILDING;
    for (let i = 1; i <= totalUnits; i++) {
      const unit = getUnit(state, b.id, i);
      const status = getUnitStatus(unit, discipline);
      if (status === TaskStatus.DONE) completed++;
    }
    return Math.round((completed / totalUnits) * 100);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
      {buildings.map((b) => {
        const progress = getCompletionStats(b);
        const isActive = selectedBuildingId === b.id;
        const buildingName = lang === 'ru' ? b.name.replace('בניין', 'Здание') : lang === 'ar' ? b.name.replace('בניין', 'مبنى') : b.name;
        
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all border-2 shadow-sm ${
              isActive 
                ? 'bg-blue-600 border-blue-700 text-white transform scale-105 z-10' 
                : 'bg-white border-gray-100 hover:border-blue-300 text-gray-700'
            }`}
          >
            <span className="text-lg font-bold whitespace-nowrap">{buildingName}</span>
            <div className="w-full mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${isActive ? 'bg-white' : 'bg-blue-500'}`} 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={`text-[10px] mt-1 ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
              {progress}% {t.completed}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default BuildingSelector;
