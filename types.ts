
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  NEEDS_FOLLOWUP = 'NEEDS_FOLLOWUP',
  BLOCKED = 'BLOCKED',
  COORDINATION_REQUIRED = 'COORDINATION_REQUIRED'
}

export type Discipline = string;

export interface DisciplineDefinition {
  id: string;
  labels: {
    he: string;
    ru: string;
    ar: string;
  };
  isActive: boolean;
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
  projectId: string;
  buildingId: string;
  number: number;
  tenantInfo?: TenantInfo;
  statuses: Record<string, TaskStatus>;
  history: TaskLog[];
  workConfirmation?: WorkConfirmation;
  workConfirmations?: WorkConfirmation[];
}

export interface Building {
  id: string;
  projectId: string;
  name: string;
  plotId: string;
  totalUnits: number;
  committeeContact?: TenantInfo;
}

export interface Plot {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  location?: string;
  imageUrl?: string;
  plots: Plot[];
  buildingConfigs: { plotId: string, buildings: number[] }[];
}

export interface ProjectState {
  projects: Project[];
  plots: Plot[];
  buildings: Building[];
  units: Record<string, Unit>;
}
