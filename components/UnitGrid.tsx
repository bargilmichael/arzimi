
import React, { useState } from 'react';
import { ProjectState, TaskStatus, Discipline } from '../types';
import { STATUS_CONFIG, UNITS_PER_BUILDING } from '../constants';
import { getUnit, getUnitStatus } from '../services/dataService';
import { Language, translations } from '../translations';

interface Props {
  buildingId: string;
  state: ProjectState;
  onSelectUnit: (unitNumber: number) => void;
  onUpdateTenant?: (unitNumber: number, name: string, phone: string) => void;
  lang: Language;
  discipline: Discipline;
  userRole?: string;
  userDiscipline?: string;
  statusFilter?: TaskStatus | null;
}

const UnitGrid: React.FC<Props> = ({ buildingId, state, onSelectUnit, onUpdateTenant, lang, discipline, userRole, userDiscipline, statusFilter, onStatusClick }) => {
  const building = state.buildings.find(b => b.id === buildingId);
  const totalUnits = building?.totalUnits || UNITS_PER_BUILDING;
  const units = Array.from({ length: totalUnits }, (_, i) => i + 1);
  const t = translations[lang];
  const [isBulkEditing, setIsBulkEditing] = useState(false);

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
            <span className="bg-blue-50 p-2 rounded-xl">🏘️</span> {t.unitList}
          </h2>
          {(userRole === 'admin' || userDiscipline === 'general' || userDiscipline === 'all') && (
            <button 
              onClick={() => setIsBulkEditing(!isBulkEditing)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-sm border ${isBulkEditing ? 'bg-blue-600 text-white border-blue-700' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
            >
              👤 {t.manageTenants}
            </button>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const isActive = statusFilter === status;
            return (
              <button 
                key={status} 
                onClick={() => onStatusClick?.(isActive ? null : (status as TaskStatus))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm active:scale-95 ${
                  isActive 
                    ? config.color + ' border-current'
                    : 'bg-slate-50 border-slate-100 hover:border-slate-300'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${config.color.split(' ')[0]}`}></span>
                <span className={`text-[11px] font-black ${isActive ? 'text-current' : 'text-gray-500'}`}>{(t as any)[config.labelKey]}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {isBulkEditing ? (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-blue-200">
            {units.map((num) => {
              const unitData = getUnit(state, buildingId, num);
              return (
                <div key={num} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex flex-col gap-3 group hover:border-blue-200 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-gray-400">{t.unitLabel} {num}</span>
                  </div>
                  <input 
                    type="text"
                    defaultValue={unitData.tenantInfo?.name || ''}
                    placeholder={t.tenantNameField}
                    onBlur={(e) => onUpdateTenant?.(num, e.target.value, unitData.tenantInfo?.phone || '')}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                  />
                  <input 
                    type="text"
                    defaultValue={unitData.tenantInfo?.phone || ''}
                    placeholder={t.tenantPhoneField}
                    onBlur={(e) => onUpdateTenant?.(num, unitData.tenantInfo?.name || '', e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-center">
             <button 
               onClick={() => setIsBulkEditing(false)}
               className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg hover:shadow-xl transition-all"
             >
               {lang === 'he' ? 'סיום עריכה' : 'Finish Editing'}
             </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
          {units.map((num) => {
            const unitData = getUnit(state, buildingId, num);
            const unitStatuses = new Set<TaskStatus>();
            unitData.history.forEach(h => {
              if (discipline === 'general' || discipline === 'all' || h.discipline === discipline) {
                unitStatuses.add(h.status);
              }
            });

            let finalStatus = getUnitStatus(unitData, discipline) || TaskStatus.NOT_STARTED;
            // If there's a filter active and the unit has that status, show that color
            if (statusFilter && unitStatuses.has(statusFilter)) {
              finalStatus = statusFilter;
            }
            
            const config = STATUS_CONFIG[finalStatus];
            
            return (
              <button
                key={num}
                onClick={() => onSelectUnit(num)}
                className={`aspect-square flex flex-col items-center justify-center rounded-2xl border-2 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 ${config.color} shadow-sm relative group`}
              >
                <span className="text-[9px] font-black uppercase opacity-50 tracking-tighter">{t.unitLabel}</span>
                <span className="text-xl font-black">{num}</span>
                {unitData.tenantInfo?.name && (
                  <div className="absolute -top-1 -right-1 bg-blue-600 w-3 h-3 rounded-full border-2 border-white shadow-sm"></div>
                )}
                {/* Hover info */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white text-[10px] py-2 px-3 rounded-lg shadow-xl whitespace-nowrap">
                    {unitData.tenantInfo?.name || t.notStarted}
                    {unitData.tenantInfo?.phone && <div className="opacity-60">{unitData.tenantInfo.phone}</div>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UnitGrid;
