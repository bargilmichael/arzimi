
import { ProjectState, Building, Unit, TaskStatus, TaskLog, Discipline, TenantInfo, Plot } from '../types';
import { BUILDINGS_COUNT, UNITS_PER_BUILDING } from '../constants';

import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, onSnapshot, query } from 'firebase/firestore';

const STORAGE_KEY = 'plumbtrack_data_v1';

const cleanObject = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const val = cleanObject(obj[key]);
      if (val !== undefined) {
        newObj[key] = val;
      }
    });
    return newObj;
  }
  return obj;
};

// We'll add async versions for Firestore
export const saveUnitToFirestore = async (unit: Unit) => {
  try {
    console.log(`Saving unit ${unit.id} to Firestore...`);
    const cleaned = cleanObject(unit);
    await setDoc(doc(db, 'units', unit.id), cleaned);
    console.log(`Unit ${unit.id} saved successfully!`);
  } catch (error) {
    console.error("Error saving unit to Firestore:", error);
  }
};

export const saveBuildingToFirestore = async (building: Building) => {
  try {
    console.log(`Saving building ${building.id} to Firestore...`);
    const cleaned = cleanObject(building);
    await setDoc(doc(db, 'buildings', building.id), cleaned);
    console.log(`Building ${building.id} saved successfully!`);
  } catch (error) {
    console.error("Error saving building to Firestore:", error);
  }
};

export const initializeData = (): ProjectState => {
  const plotConfigs = [
    { id: '800', name: 'מגרש 800', buildings: [1, 2, 3] },
    { id: '801A', name: 'מגרש 801A', buildings: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    { id: '803A', name: 'מגרש 803A', buildings: [14, 15, 16, 17, 18, 19] },
    { id: '806A', name: 'מגרש 806A', buildings: [20, 21, 22, 23, 24, 25, 26, 27] },
    { id: '807', name: 'מגרש 807', buildings: [28, 29, 30, 31] },
    { id: '808', name: 'מגרש 808', buildings: [1, 2, 3, 4, 5, 6, 7] },
    { id: '810', name: 'מגרש 810', buildings: [8, 9, 10, 11] },
    { id: '812', name: 'מגרש 812', buildings: [32, 33] },
  ];

  const plots: Plot[] = plotConfigs.map(p => ({ id: p.id, name: p.name }));
  const buildings: Building[] = [];

  plotConfigs.forEach(p => {
    p.buildings.forEach(bId => {
      buildings.push({
        id: `p-${p.id}-b-${bId}`,
        name: `בניין ${bId}`,
        plotId: p.id,
        totalUnits: UNITS_PER_BUILDING
      });
    });
  });

  const initialState: ProjectState = {
    plots,
    buildings,
    units: {}
  };

  return initialState;
};

export const saveData = (_state: ProjectState) => {
  // Local storage disabled to prevent stale data conflict with Firestore
  // localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getUnit = (state: ProjectState, buildingId: string, unitId: string | number): Unit => {
  const key = `${buildingId}-${unitId}`;
  if (state.units[key]) return state.units[key];
  
  return {
    id: key,
    buildingId,
    number: typeof unitId === 'number' ? unitId : 0,
    statuses: {},
    history: []
  };
};

export const getUnitStatus = (unit: Unit, discipline: Discipline): TaskStatus | null => {
  const hasHistory = unit.history.length > 0;
  
  if (discipline === 'general') {
    if (!hasHistory) return null;

    const statuses = Object.values(unit.statuses);
    if (statuses.includes(TaskStatus.BLOCKED)) return TaskStatus.BLOCKED;
    if (statuses.includes(TaskStatus.NEEDS_FOLLOWUP)) return TaskStatus.NEEDS_FOLLOWUP;
    if (statuses.includes(TaskStatus.IN_PROGRESS)) return TaskStatus.IN_PROGRESS;
    
    // If some are DONE and some are NOT_STARTED, it's effectively IN_PROGRESS for the whole unit
    const hasDone = statuses.includes(TaskStatus.DONE);
    const hasNotStarted = statuses.includes(TaskStatus.NOT_STARTED);
    
    if (hasDone && hasNotStarted) return TaskStatus.IN_PROGRESS;
    if (hasDone && !hasNotStarted) return TaskStatus.DONE;
    
    return TaskStatus.NOT_STARTED;
  }
  
  const hasDisciplineHistory = unit.history.some(h => h.discipline === discipline);
  if (!hasDisciplineHistory) return null;

  return unit.statuses[discipline] || TaskStatus.NOT_STARTED;
};

export const updateUnit = (
  state: ProjectState, 
  unit: Unit, 
  updates: { 
    newLog?: Omit<TaskLog, 'id' | 'timestamp'>,
    updateLogStatus?: { logId: string, newStatus: TaskStatus },
    deleteLogId?: string,
    editLog?: TaskLog,
    updateTenantInfo?: { name: string, phone: string },
    workConfirmation?: {
      signerName: string,
      tenantEmail?: string,
      originalDescription: string,
      translatedDescription: string,
      attachmentUrl: string,
      language: 'ru' | 'ar'
    }
  }
): ProjectState => {
  const updatedUnit = { ...unit };
  let activeConfirmationId: string | undefined = undefined;

  if (updates.workConfirmation) {
    activeConfirmationId = Math.random().toString(36).substr(2, 9);
    const newConfirmation = {
      ...updates.workConfirmation,
      id: activeConfirmationId,
      timestamp: Date.now()
    };
    
    updatedUnit.workConfirmation = newConfirmation;
    updatedUnit.workConfirmations = [newConfirmation, ...(updatedUnit.workConfirmations || [])];

    // If we are completing a task, link it to this confirmation
    if (updates.updateLogStatus && updates.updateLogStatus.newStatus === TaskStatus.DONE) {
      const { logId } = updates.updateLogStatus;
      updatedUnit.history = updatedUnit.history.map(log => {
        if (log.id === logId) {
          return { ...log, confirmationId: activeConfirmationId };
        }
        return log;
      });
    }
  }

  if (updates.updateTenantInfo) {
    updatedUnit.tenantInfo = updates.updateTenantInfo;
  }

  if (updates.deleteLogId) {
    const logToDelete = updatedUnit.history.find(l => l.id === updates.deleteLogId);
    if (logToDelete) {
      updatedUnit.history = updatedUnit.history.filter(l => l.id !== updates.deleteLogId);
      
      const remainingLogsForDiscipline = updatedUnit.history
        .filter(l => l.discipline === logToDelete.discipline)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      const newStatus = remainingLogsForDiscipline.length > 0 
        ? remainingLogsForDiscipline[0].status 
        : TaskStatus.NOT_STARTED;
        
      updatedUnit.statuses = {
        ...updatedUnit.statuses,
        [logToDelete.discipline]: newStatus
      };
    }
  }

  if (updates.editLog) {
    updatedUnit.history = updatedUnit.history.map(log => 
      log.id === updates.editLog?.id ? { ...updates.editLog } : log
    );
    updatedUnit.statuses = {
      ...updatedUnit.statuses,
      [updates.editLog.discipline]: updates.editLog.status
    };
  }

  if (updates.updateLogStatus) {
    const { logId, newStatus } = updates.updateLogStatus;
    updatedUnit.history = updatedUnit.history.map(log => {
      if (log.id === logId) {
        const updatedLog = { 
          ...log, 
          status: newStatus,
          confirmationId: activeConfirmationId || log.confirmationId,
          completedAt: newStatus === TaskStatus.DONE ? (log.completedAt || Date.now()) : undefined
        };
        updatedUnit.statuses = {
          ...updatedUnit.statuses,
          [log.discipline]: newStatus
        };
        return updatedLog;
      }
      return log;
    });
  }

  if (updates.newLog) {
    const logEntry: TaskLog = {
      ...updates.newLog,
      id: Math.random().toString(36).substr(2, 9),
      confirmationId: activeConfirmationId,
      timestamp: (updates.newLog as any).timestamp || Date.now(),
      completedAt: updates.newLog.status === TaskStatus.DONE ? Date.now() : undefined
    };
    updatedUnit.history = [logEntry, ...updatedUnit.history];
    updatedUnit.statuses = {
      ...updatedUnit.statuses,
      [updates.newLog.discipline]: updates.newLog.status
    };
  }

  const newState = { 
    ...state,
    units: { 
      ...state.units,
      [unit.id]: updatedUnit 
    }
  };

  saveData(newState);
  saveUnitToFirestore(updatedUnit);
  return newState;
};

export const updateBuilding = (
  state: ProjectState,
  buildingId: string,
  updates: { committeeContact?: TenantInfo }
): ProjectState => {
  const newState = { ...state };
  newState.buildings = newState.buildings.map(b => {
    if (b.id === buildingId) {
      const updated = { ...b, ...updates };
      saveBuildingToFirestore(updated); // Sync to firestore
      return updated;
    }
    return b;
  });
  saveData(newState);
  return newState;
};
