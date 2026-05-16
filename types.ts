
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  NEEDS_FOLLOWUP = 'NEEDS_FOLLOWUP',
  BLOCKED = 'BLOCKED'
}

export type Discipline = 'plumbing' | 'general' | 'rappelling' | 'telefire' | 'itumit' | 'emperion' | 'workers';

export interface Appointment {
  id: string;
  date: string;
  time: string;
  tenantName: string;
  contractor: string;
  contractorId: string;
  contractorEmail?: string;
  notes: string;
  isCompleted: boolean;
  createdAt: number;
}

export interface TaskLog {
  id: string;
  timestamp: number;
  workerName: string;
  contractor: string;
  contractorId: string;
  description: string;
  status: TaskStatus;
  discipline: Discipline;
  images?: string[]; // Array of base64 strings
  completedAt?: number;
  confirmationId?: string;
}

export interface TenantInfo {
  name: string;
  phone: string;
}

export interface WorkConfirmation {
  id: string;
  timestamp: number;
  signerName: string;
  tenantEmail?: string;
  originalDescription: string;
  translatedDescription: string;
  attachmentUrl: string; // Firebase Storage URL
  language: 'ru' | 'ar';
}

export interface Unit {
  id: string;
  buildingId: string;
  number: number;
  tenantInfo?: TenantInfo;
  statuses: Record<Discipline, TaskStatus>;
  history: TaskLog[];
  appointments: Appointment[];
  workConfirmation?: WorkConfirmation;
  workConfirmations?: WorkConfirmation[];
}

export interface Building {
  id: string;
  name: string;
  plotId: string;
  totalUnits: number;
  committeeContact?: TenantInfo;
}

export interface Plot {
  id: string;
  name: string;
}

export interface ProjectState {
  plots: Plot[];
  buildings: Building[];
  units: Record<string, Unit>;
}
