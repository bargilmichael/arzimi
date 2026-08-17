
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  NEEDS_FOLLOWUP = 'NEEDS_FOLLOWUP',
  BLOCKED = 'BLOCKED',
  COORDINATION_REQUIRED = 'COORDINATION_REQUIRED'
}

export enum QuoteWorkflowStep {
  REQUEST_SENT = 'REQUEST_SENT',                       // שלב 1: נשלחה בקשה לספק
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',             // שלב 2: ממתין לחתימת ממונה
  SIGNED_PENDING_DISPATCH = 'SIGNED_PENDING_DISPATCH', // שלב 3: נחתם - דורש שליחה לספק
  ORDERED_CLOSED = 'ORDERED_CLOSED'                    // שלב 4: הוזמן / נסגר
}

export interface QuoteDocument {
  name: string;
  url?: string;      // Base64 data URL or storage URL
  type?: string;     // 'pdf' | 'image' | etc.
  size?: number;
  uploadedAt: number;
  uploadedBy?: string;
}

export interface QuoteHistoryEntry {
  step: QuoteWorkflowStep;
  timestamp: number;
  user: string;
  action: string;
  details?: string;
}

export interface PriceQuote {
  id: string;
  projectId: string;
  buildingId: string;
  buildingName?: string;
  plotId?: string;
  unitNumber?: number | string; // Apartment number or "שטח ציבורי"
  unitId?: string;
  supplier: string;            // e.g. "רב בריח", "דלתות חמדיה", "סטודיו קרמיקה", "נגב", "שיש בראנץ", "מטבחי קרמיקה", or custom
  status: QuoteWorkflowStep;
  
  // Step 1: Request sent (פקידה)
  requestDate: string;         // YYYY-MM-DD
  requestTime?: string;
  requestedBy: string;         // Coordinator name
  requestEmail?: string;       // Target supplier email
  itemDescription: string;     // מה נדרש? פרטי הצעת המחיר (דלת, ריצוף, שיש...)
  urgency?: 'normal' | 'urgent' | 'immediate';
  notes?: string;

  // Step 2: Quote received (פקידה)
  quoteReceivedDate?: string;  // YYYY-MM-DD
  quoteReceivedTime?: string;
  quoteNumber?: string;        // מספר הצעת מחיר מהספק
  quoteAmount?: number;        // סכום ההצעה (לפני / כולל מע"מ)
  quoteCurrency?: string;      // ₪
  quoteFile?: QuoteDocument;   // קובץ הצעת מחיר שנתקבל מהספק
  receivedNotes?: string;

  // Step 3: Approval & signature by manager (ממונה)
  approvedDate?: string;       // YYYY-MM-DD
  approvedTime?: string;
  approvedBy?: string;         // מנהל / ממונה מאשר
  approvedAmount?: number;     // סכום שאושר
  signatureImage?: string;     // חתימה דיגיטלית (Base64)
  signedQuoteFile?: QuoteDocument; // קובץ חתום
  managerNotes?: string;

  // Step 4: Final dispatch to supplier (פקידה)
  dispatchedDate?: string;     // YYYY-MM-DD
  dispatchedTime?: string;
  dispatchedBy?: string;       // פקידה ששלחה לספק
  orderNumber?: string;        // מספר הזמנה / אישור קבלה מספק
  expectedDeliveryDate?: string;
  closingNotes?: string;

  createdAt: number;
  updatedAt: number;
  history?: QuoteHistoryEntry[];
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
