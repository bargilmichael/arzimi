import React from 'react';
import { ProjectState, TaskLog, Unit, TaskStatus, DisciplineDefinition } from '../types';
import { CONTRACTORS, STATUS_CONFIG } from '../constants';
import { Language, translations } from '../translations';

interface Props {
  state: ProjectState;
  lang: Language;
  onSelectUnit: (buildingId: string, unitId: string | number) => void;
  userRole: 'admin' | 'contractor' | 'viewer';
  userDiscipline: string;
  disciplines: DisciplineDefinition[];
}

const ContractorView: React.FC<Props> = ({ state, lang, onSelectUnit, userRole, userDiscipline, disciplines }) => {
  const t = translations[lang];

  // Map contractors by their labels for easier lookup in logs
  const contractorIdToLabel = (id: string) => {
    const disc = disciplines.find(d => d.id === id);
    return disc?.labels[lang] || disc?.labels.he || id;
  };

  const filteredContractors = disciplines.filter(d => {
    if (userRole !== 'contractor' || userDiscipline === 'all' || userDiscipline === 'general') return true;
    return d.id === userDiscipline;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">{t.viewContractors}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContractors.map(contractor => {
          const label = contractorIdToLabel(contractor.id);
          const icon = '👷'; // Default icon for dynamic disciplines
          
          // Find all logs related to this contractor
          const contractorLogs: { log: TaskLog, unit: Unit }[] = [];
          
          (Object.values(state.units) as Unit[]).forEach(unit => {
            unit.history.forEach(log => {
              if (log.contractor === label) {
                contractorLogs.push({ log, unit });
              }
            });
          });

          // Sorting by latest timestamp
          contractorLogs.sort((a, b) => b.log.timestamp - a.log.timestamp);
          
          // Unique units this contractor is currently "responsible" for (last log by them isn't DONE)
          const problematicUnits = contractorLogs.reduce((acc, curr) => {
            if (!acc.find(u => u.unit.id === curr.unit.id)) {
              if (curr.log.status === TaskStatus.NEEDS_FOLLOWUP || curr.log.status === TaskStatus.BLOCKED || curr.log.status === TaskStatus.IN_PROGRESS) {
                acc.push(curr);
              }
            }
            return acc;
          }, [] as typeof contractorLogs);

          return (
            <div key={contractor.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              {/* Card Header */}
              <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <span className="font-bold text-gray-800">{label}</span>
                </div>
                <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-bold">
                  {t.totalReports}: {contractorLogs.length}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 space-y-4">
                {contractorLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm italic">{t.noActivity}</div>
                ) : (
                  <>
                    {/* Problematic Units List */}
                    {problematicUnits.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">{t.activeTask} ({problematicUnits.length})</h4>
                        {problematicUnits.slice(0, 5).map(({ unit, log }) => {
                          const buildingNum = unit.buildingId.split('-')[1];
                          const unitIdParts = unit.id.split('-');
                          const unitIdentifier = unitIdParts[unitIdParts.length - 1];
                          const isPublic = isNaN(Number(unitIdentifier));

                          return (
                            <button 
                              key={unit.id}
                              onClick={() => onSelectUnit(unit.buildingId, isPublic ? unitIdentifier : Number(unitIdentifier))}
                              className="w-full flex items-center justify-between p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors border border-red-100 group"
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-xs font-bold text-gray-700">
                                  {t.building} {buildingNum} - {isPublic ? (t as any)[`area_${unitIdentifier}`] : `${t.apartment} ${unitIdentifier}`}
                                </span>
                                <span className="text-[9px] text-gray-500 truncate max-w-[150px]">{log.description}</span>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_CONFIG[log.status].color}`}>
                                {(t as any)[STATUS_CONFIG[log.status].labelKey]}
                              </span>
                            </button>
                          );
                        })}
                        {problematicUnits.length > 5 && (
                          <div className="text-[9px] text-center text-gray-400">
                            +{problematicUnits.length - 5} {lang === 'he' ? 'נוספים' : lang === 'ru' ? 'других' : 'إضافي'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Activity */}
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.lastReport}</h4>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="font-bold text-gray-600">{contractorLogs[0].log.workerName}</span>
                          <span className="text-gray-400">{new Date(contractorLogs[0].log.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-2">{contractorLogs[0].log.description}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContractorView;