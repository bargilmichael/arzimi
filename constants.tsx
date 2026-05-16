
import { TaskStatus } from './types';

export const STATUS_CONFIG: Record<TaskStatus, { labelKey: string; color: string; icon: string }> = {
  [TaskStatus.NOT_STARTED]: {
    labelKey: 'notStarted',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: '⚪'
  },
  [TaskStatus.IN_PROGRESS]: {
    labelKey: 'inProgress',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: '🔵'
  },
  [TaskStatus.DONE]: {
    labelKey: 'completed',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: '🟢'
  },
  [TaskStatus.NEEDS_FOLLOWUP]: {
    labelKey: 'needsFollowup',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: '🟡'
  },
  [TaskStatus.BLOCKED]: {
    labelKey: 'blocked',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: '🔴'
  }
};

export const BUILDINGS_COUNT = 33;
export const UNITS_PER_BUILDING = 50;

export const PUBLIC_AREAS = [
  { id: 'lobby', labelKey: 'area_lobby', icon: '🏢' },
  { id: 'parking', labelKey: 'area_parking', icon: '🚗' },
  { id: 'yard', labelKey: 'area_yard', icon: '🌳' },
  { id: 'roof', labelKey: 'area_roof', icon: '🏠' },
  { id: 'stairwell', labelKey: 'area_stairwell', icon: '🪜' },
  { id: 'elevators', labelKey: 'area_elevators', icon: '🛗' }
];

export const CONTRACTORS = [
  { id: 'manager', labelKey: 'contractor_manager', icon: '👔' },
  { id: 'workers', labelKey: 'contractor_workers', icon: '👷' },
  { id: 'plumber', labelKey: 'contractor_plumber', icon: '🚰' },
  { id: 'rappelling', labelKey: 'contractor_rappelling', icon: '🧗' },
  { id: 'telefire', labelKey: 'contractor_telefire', icon: '🔥' },
  { id: 'emperion', labelKey: 'contractor_emperion', icon: '⚙️' },
  { id: 'itumit', labelKey: 'contractor_itumit', icon: '💧' },
  { id: 'electrician', labelKey: 'contractor_electrician', icon: '⚡' }
];
