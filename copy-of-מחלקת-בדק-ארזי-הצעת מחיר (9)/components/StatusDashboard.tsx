
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
  onStatusClick: (status: TaskStatus | null) => void;
}

const StatusDashboard: React.FC<Props> = ({ state, lang, selectedPlotId, discipline, statusFilter, onStatusClick }) => {
  const t = translations[lang];

  const getStats = () => {
    const stats: Record<TaskStatus, number> = {
      [TaskStatus.NOT_STARTED]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.DONE]: 0,
      [TaskStatus.NEEDS_FOLLOWUP]: 0,
      [TaskStatus.BLOCKED]: 0,
      [TaskStatus.COORDINATION_REQUIRED]: 0,
    };

    const targetBuildings = selectedPlotId 
      ? state.buildings.filter(b => b.plotId === selectedPlotId)
      : state.buildings;

    const buildingIds = new Set(targetBuildings.map(b => b.id));

    // Iterate over all units that have data
    (Object.values(state.units) as Unit[]).forEach(unit => {
      if (!buildingIds.has(unit.buildingId)) return;
      countUnitStats(unit);
    });

    function countUnitStats(unit: Unit) {
      if (!unit || !unit.history || unit.history.length === 0) return;

      // Identify the LATEST status for each contractor/discipline
      const latestStatuses = new Map<string, TaskStatus>();
      
      const logs = (discipline === 'general' || discipline === 'all') 
        ? unit.history 
        : unit.history.filter(h => h.discipline === discipline);
        
      logs.forEach(log => {
        const key = log.contractorId || log.discipline || 'unknown';
        if (!latestStatuses.has(key)) {
          latestStatuses.set(key, log.status);
        }
      });

      // Statuses across all active tasks of this unit
      latestStatuses.forEach(status => {
        stats[status]++;
      });
    }

    return stats;
  };

  const stats = getStats();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-4">
      {Object.entries(STATUS_CONFIG).map(([status, config]) => {
        const isActive = statusFilter === status;
        const count = stats[status as TaskStatus] || 0;
        
        return (
          <button
            key={status}
            onClick={() => onStatusClick(isActive ? null : (status as TaskStatus))}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all shadow-sm active:scale-95 ${
              isActive 
                ? config.color + ' border-current scale-102 z-10 shadow-md transform'
                : 'bg-white border-gray-100 hover:border-gray-200 text-gray-700'
            }`}
            style={isActive ? { backgroundColor: config.color.includes('green') ? '#22c55e' : config.color.includes('yellow') ? '#eab308' : config.color.includes('red') ? '#ef4444' : config.color.includes('blue') ? '#3b82f6' : config.color.includes('indigo') ? '#6366f1' : '#64748b', borderColor: 'transparent', color: 'white' } : {}}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{config.icon}</span>
              <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {(t as any)[config.labelKey]}
              </span>
            </div>
            <span className={`text-2xl font-black ${isActive ? 'text-white' : 'text-gray-900'}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default StatusDashboard;
