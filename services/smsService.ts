import { Unit, TaskLog, Building, ProjectState } from '../types';

/**
 * Normalizes and formats the date to DD/MM/YYYY
 */
export const formatDateForSMS = (dateStrOrTimestamp: string | number): string => {
  if (!dateStrOrTimestamp) return '';
  
  let date: Date;
  if (typeof dateStrOrTimestamp === 'number') {
    date = new Date(dateStrOrTimestamp);
  } else {
    // If it's already a formatted date or ISO string
    if (dateStrOrTimestamp.includes('-')) {
      const parts = dateStrOrTimestamp.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    date = new Date(dateStrOrTimestamp);
  }

  if (isNaN(date.getTime())) {
    return String(dateStrOrTimestamp);
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Normalizes and maps the discipline/contractor ID or label to clean Hebrew profession.
 */
export const getHebrewProfession = (input: string): string => {
  if (!input) return 'בעל מקצוע';
  const cleanInput = input.toLowerCase();
  
  if (cleanInput.includes('plumb') || cleanInput.includes('אינסטל')) {
    return 'אינסטלטור';
  }
  if (cleanInput.includes('elect') || cleanInput.includes('חשמל')) {
    return 'חשמלאי';
  }
  if (cleanInput.includes('rappel') || cleanInput.includes('סנפלינג')) {
    return 'איש סנפלינג';
  }
  if (cleanInput.includes('itum') || cleanInput.includes('איטום') || cleanInput.includes('איטומית')) {
    return 'קבלן איטום';
  }
  if (cleanInput.includes('gas') || cleanInput.includes('גז')) {
    return 'טכנאי גז';
  }
  if (cleanInput.includes('telefire') || cleanInput.includes('כיבוי') || cleanInput.includes('אש') || cleanInput.includes('טלפייר')) {
    return 'טכנאי כיבוי אש';
  }
  if (cleanInput.includes('emper') || cleanInput.includes('משאב')) {
    return 'טכנאי משאבות';
  }
  if (cleanInput.includes('work') || cleanInput.includes('פועל') || cleanInput.includes('general') || cleanInput.includes('גמר') || cleanInput.includes('מנהל')) {
    return 'גמרים';
  }
  
  return input;
};

/**
 * Generates the SMS template based on the user's requested Hebrew wording and dynamic variables.
 */
export const generateSMSMessage = (params: {
  tenantName: string;
  date: string;
  workerName: string;
  contractorRole: string;
  buildingNumber: string | number;
  unitNumber: string | number;
  template?: string;
}): string => {
  const { tenantName, date, workerName, contractorRole, buildingNumber, unitNumber, template } = params;
  
  const selectedTemplate = template || "שלום {שם_דייר}, תזכורת ממחלקת בדק שמחר בתאריך {תאריך} מתואם להגיע אליך {בעל_מקצוע} לבניין {בניין}, דירה {דירה}. אנא ודא זמינות.";

  const profession = getHebrewProfession(contractorRole);

  const msg = selectedTemplate
    .replace(/{שם_דייר}/g, tenantName || 'דייר')
    .replace(/{תאריך}/g, date)
    .replace(/{בעל_מקצוע}/g, profession)
    .replace(/{בניין}/g, String(buildingNumber))
    .replace(/{דירה}/g, String(unitNumber));

  return msg;
};

/**
 * Triggers the SMS API call to our backend node server
 */
export const sendSMS = async (phone: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, message }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Server error while sending SMS' };
    }

    return { success: true, data: result.data };
  } catch (error: any) {
    console.error('sendSMS error:', error);
    return { success: false, error: error.message || 'Network error while sending SMS' };
  }
};

/**
 * Utility to extract details from a Unit and a TaskLog to build the reminder SMS payload.
 */
export const getSMSDetailsForTask = (unit: Unit, log: TaskLog, buildings: Building[], template?: string) => {
  const tenantName = unit.tenantInfo?.name || '';
  const tenantPhone = unit.tenantInfo?.phone || '';
  
  // Format date
  const taskDate = formatDateForSMS(log.timestamp);
  
  // Extract building number from buildingId (e.g., p-800-b-1 -> building is "1")
  const building = buildings.find(b => b.id === unit.buildingId);
  const buildingNumber = building ? building.name.replace('בניין', '').trim() : (unit.buildingId.split('-')[3] || unit.buildingId.split('-')[1] || unit.buildingId);
  
  // Extract unit/apartment identifier
  const unitIdParts = unit.id.split('-');
  const unitNumber = unitIdParts[unitIdParts.length - 1];

  const workerName = log.workerName || '';
  const contractorRole = log.contractor || '';

  const message = generateSMSMessage({
    tenantName,
    date: taskDate,
    workerName,
    contractorRole,
    buildingNumber,
    unitNumber,
    template
  });

  return {
    tenantName,
    tenantPhone,
    message,
    taskDate,
    buildingNumber,
    unitNumber,
    workerName,
    contractorRole
  };
};
