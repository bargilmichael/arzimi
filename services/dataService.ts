
import { ProjectState, Building, Unit, TaskStatus, TaskLog, Discipline, Appointment, TenantInfo } from '../types';
import { BUILDINGS_COUNT, UNITS_PER_BUILDING } from '../constants';

import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, onSnapshot, query } from 'firebase/firestore';

const STORAGE_KEY = 'plumbtrack_data_v1';

// We'll add async versions for Firestore
export const saveUnitToFirestore = async (unit: Unit) => {
  try {
    console.log(`Saving unit ${unit.id} to Firestore...`);
    await setDoc(doc(db, 'units', unit.id), unit);
    console.log(`Unit ${unit.id} saved successfully!`);
  } catch (error) {
    console.error("Error saving unit to Firestore:", error);
  }
};

export const saveBuildingToFirestore = async (building: Building) => {
  try {
    console.log(`Saving building ${building.id} to Firestore...`);
    await setDoc(doc(db, 'buildings', building.id), building);
    console.log(`Building ${building.id} saved successfully!`);
  } catch (error) {
    console.error("Error saving building to Firestore:", error);
  }
};

export const initializeData = (): ProjectState => {
  const buildings: Building[] = Array.from({ length: BUILDINGS_COUNT }, (_, i) => ({
    id: `b-${i + 1}`,
    name: `בניין ${i + 1}`,
    totalUnits: UNITS_PER_BUILDING
  }));

  const initialState: ProjectState = {
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
    statuses: {
      plumbing: TaskStatus.NOT_STARTED,
      general: TaskStatus.NOT_STARTED,
      rappelling: TaskStatus.NOT_STARTED,
      telefire: TaskStatus.NOT_STARTED,
      itumit: TaskStatus.NOT_STARTED,
      emperion: TaskStatus.NOT_STARTED,
      workers: TaskStatus.NOT_STARTED
    },
    history: [],
    appointments: []
  };
};

export const updateUnit = (
  state: ProjectState, 
  unit: Unit, 
  updates: { 
    newLog?: Omit<TaskLog, 'id' | 'timestamp'>,
    updateLogStatus?: { logId: string, newStatus: TaskStatus },
    deleteLogId?: string,
    editLog?: TaskLog,
    newAppointment?: Omit<Appointment, 'id' | 'createdAt' | 'isCompleted'>,
    completeAppointmentId?: string,
    updateTenantInfo?: { name: string, phone: string },
    workConfirmation?: {
      workerName: string,
      originalDescription: string,
      translatedDescription: string,
      signatureUrl: string,
      language: 'ru' | 'ar'
    }
  }
): ProjectState => {
  const updatedUnit = { ...unit };

  if (updates.workConfirmation) {
    updatedUnit.workConfirmation = {
      ...updates.workConfirmation,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
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
        const updatedLog = { ...log, status: newStatus };
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
      timestamp: Date.now()
    };
    updatedUnit.history = [logEntry, ...updatedUnit.history];
    updatedUnit.statuses = {
      ...updatedUnit.statuses,
      [updates.newLog.discipline]: updates.newLog.status
    };
  }

  if (updates.newAppointment) {
    const appointment: Appointment = {
      ...updates.newAppointment,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      isCompleted: false
    };
    updatedUnit.appointments = [...updatedUnit.appointments, appointment].sort((a, b) => 
      new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime()
    );
  }

  if (updates.completeAppointmentId) {
    updatedUnit.appointments = updatedUnit.appointments.map(app => 
      app.id === updates.completeAppointmentId ? { ...app, isCompleted: true } : app
    );
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
