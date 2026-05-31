import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TENANT_IMPORT_DATA } from '../services/tenantImportData';
import { Language } from '../translations';
import { Unit } from '../types';

interface Props {
  lang: Language;
}

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

const getBuildingIdFromNum = (bId: number): string | null => {
  if (bId >= 1 && bId <= 3) return `p-800-b-${bId}`;
  if (bId >= 4 && bId <= 13) return `p-801A-b-${bId}`;
  if (bId >= 14 && bId <= 19) return `p-803A-b-${bId}`;
  if (bId >= 20 && bId <= 27) return `p-806A-b-${bId}`;
  if (bId >= 28 && bId <= 31) return `p-807-b-${bId}`;
  if (bId >= 32 && bId <= 33) return `p-812-b-${bId}`;
  return null;
};

const standardizePhone = (phone: string): string => {
  let cleaned = phone.trim().replace(/-/g, '').replace(/\s+/g, '');
  if (cleaned.length === 9 && (cleaned.startsWith('5') || cleaned.startsWith('7') || cleaned.startsWith('2') || cleaned.startsWith('3') || cleaned.startsWith('4') || cleaned.startsWith('8') || cleaned.startsWith('9'))) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
};

const reverseVisualHebrew = (str: string): string => {
  if (!str) return '';
  const reversed = str.trim().split('').reverse().join('');
  let finalStr = '';
  for (let i = 0; i < reversed.length; i++) {
    const char = reversed[i];
    if (char === '(') finalStr += ')';
    else if (char === ')') finalStr += '(';
    else if (char === '[') finalStr += ']';
    else if (char === ']') finalStr += '[';
    else if (char === '{') finalStr += '}';
    else if (char === '}') finalStr += '{';
    else if (char === '<') finalStr += '>';
    else if (char === '>') finalStr += '<';
    else finalStr += char;
  }
  return finalStr;
};

interface ParsedRow {
  buildingNum: number;
  aptNum: number;
  rawName1: string;
  rawName2: string;
  name1: string;
  name2: string;
  originalText: string;
  unitKey: string;
}

const parsePastedText = (text: string, shouldReverse: boolean = true): ParsedRow[] => {
  const lines = text.split('\n');
  const results: ParsedRow[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Detect and clean dates, numbers, meta noise
    let cleanLine = line;
    cleanLine = cleanLine.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g, '');
    cleanLine = cleanLine.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '');
    cleanLine = cleanLine.replace(/\b[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?\b/g, '');
    cleanLine = cleanLine.replace(/\b[1-9]\d{0,2}(?:\.\d+)?\b(?=\s*ש"ח|\s*₪)/g, '');

    let buildingNum: number | null = null;
    let aptNum: number | null = null;

    // Pattern 1: cust number like 37.1.13 or 38.6.2 at the start or in middle
    const custMatch = cleanLine.match(/(\d{2})\.(\d{1,2})\.(\d{1,3})/);
    if (custMatch) {
      buildingNum = parseInt(custMatch[2], 10);
      aptNum = parseInt(custMatch[3], 10);
    }

    // Pattern 2: Hebrew keywords (including normal and reversed visual)
    if (buildingNum === null || aptNum === null) {
      const bMatch = cleanLine.match(/(?:ןיינב|בניין)(?:\s+|:|\/|-)*(\d+)/i);
      const aMatch = cleanLine.match(/(?:הריד|דירה)(?:\s+|:|\/|-)*(\d+)/i);
      
      const bMatchRev = cleanLine.match(/(\d+)(?:\s+|:|\/|-)*(?:ןיינב|בניין)/i);
      const aMatchRev = cleanLine.match(/(\d+)(?:\s+|:|\/|-)*(?:הריד|דירה)/i);

      if (bMatch) buildingNum = parseInt(bMatch[1], 10);
      else if (bMatchRev) buildingNum = parseInt(bMatchRev[1], 10);

      if (aMatch) aptNum = parseInt(aMatch[1], 10);
      else if (aMatchRev) aptNum = parseInt(aMatchRev[1], 10);
    }

    // Fallback: Plot Building Apartment (800 1 13)
    if (buildingNum === null || aptNum === null) {
      const numbers = cleanLine.match(/\b\d+\b/g);
      if (numbers && numbers.length >= 3) {
        const firstNum = parseInt(numbers[0], 10);
        if ([800, 801, 803, 806, 807, 812, 808, 810].includes(firstNum)) {
          const bVal = parseInt(numbers[1], 10);
          const aVal = parseInt(numbers[2], 10);
          
          if (bVal >= 1 && bVal <= 33 && aVal >= 1 && aVal <= 65) {
            buildingNum = bVal;
            aptNum = aVal;
          }
        }
      }
    }

    // Custom Pattern 4: space separated numbers check for building and apartment (e.g. "bldg apt name" or "2 13 name")
    if (buildingNum === null || aptNum === null) {
      const pairMatch = cleanLine.match(/\b(\d+)\s*[-/\\,]\s*(\d+)/) || cleanLine.match(/\b(\d+)\s+(\d+)\b/);
      if (pairMatch) {
        const bVal = parseInt(pairMatch[1], 10);
        const aVal = parseInt(pairMatch[2], 10);
        if (bVal >= 1 && bVal <= 33 && aVal >= 1 && aVal <= 75) {
          buildingNum = bVal;
          aptNum = aVal;
        }
      }
    }

    if (buildingNum === null || aptNum === null) continue;

    const buildingId = getBuildingIdFromNum(buildingNum);
    if (!buildingId) continue;

    // Now extract names. Clean extra numbers and meta words.
    let textPart = cleanLine;
    textPart = textPart.replace(/\b(800|801A|803A|806A|807|808|810|812|801)\b/g, ''); // strip plot
    textPart = textPart.replace(/\d{2}\.\d{1,2}\.\d{1,3}/g, ''); // strip customer number
    textPart = textPart.replace(/(?:ןיינב|בניין)\s*\d+|\d+\s*(?:ןיינב|בניין)/gi, '');
    textPart = textPart.replace(/(?:הריד|דירה)\s*\d+|\d+\s*(?:הריד|דירה)/gi, '');
    textPart = textPart.replace(/\b\d+\b/g, ''); // strip remaining digits
    textPart = textPart.replace(/[^\u0590-\u05FF\s"'\(\)\/\\-]/g, ''); // keep Hebrew and separators

    textPart = textPart.trim();
    if (!textPart) continue;

    // Check if there are 2 names separated by double space / tab or slash
    const rawNames = textPart.split(/\s{2,}/).map(n => n.trim()).filter(Boolean);
    let name1 = '';
    let name2 = '';
    let rawName1 = '';
    let rawName2 = '';

    if (rawNames.length >= 2) {
      rawName1 = rawNames[0];
      rawName2 = rawNames[1];
      name1 = shouldReverse ? reverseVisualHebrew(rawName1) : rawName1;
      name2 = shouldReverse ? reverseVisualHebrew(rawName2) : rawName2;
    } else if (rawNames.length === 1) {
      const slashSplit = rawNames[0].split(/[/\\]+/).map(n => n.trim()).filter(Boolean);
      if (slashSplit.length >= 2) {
        rawName1 = slashSplit[0];
        rawName2 = slashSplit[1];
        name1 = shouldReverse ? reverseVisualHebrew(rawName1) : rawName1;
        name2 = shouldReverse ? reverseVisualHebrew(rawName2) : rawName2;
      } else {
        rawName1 = rawNames[0];
        name1 = shouldReverse ? reverseVisualHebrew(rawName1) : rawName1;
      }
    }

    results.push({
      buildingNum,
      aptNum,
      rawName1,
      rawName2,
      name1,
      name2,
      originalText: rawLine,
      unitKey: `${buildingId}-${aptNum}`
    });
  }

  return results;
};

interface ParsedPhoneRow {
  buildingNum: number;
  aptNum: number;
  phone: string;
  originalText: string;
  unitKey: string;
}

const parsePastedPhoneText = (text: string): ParsedPhoneRow[] => {
  const lines = text.split('\n');
  const results: ParsedPhoneRow[] = [];

  const cleanPhone = (raw: string): string | null => {
    let cleaned = raw.replace(/\D/g, ''); // Extract only digits
    if (!cleaned) return null;

    // Check if reversed
    if (cleaned.length === 10 && cleaned.endsWith('50')) {
      const rev = cleaned.split('').reverse().join('');
      if (rev.startsWith('05')) cleaned = rev;
    } else if (cleaned.length === 9 && cleaned.endsWith('5')) {
      const rev = cleaned.split('').reverse().join('');
      if (rev.startsWith('5')) cleaned = rev;
    }

    if (cleaned.startsWith('05') && cleaned.length === 10) {
      return cleaned;
    }
    if (cleaned.startsWith('5') && cleaned.length === 9) {
      return '0' + cleaned;
    }
    
    // Landline
    if (cleaned.length === 9 && (cleaned.startsWith('02') || cleaned.startsWith('03') || cleaned.startsWith('04') || cleaned.startsWith('08') || cleaned.startsWith('09'))) {
      return cleaned;
    }
    if (cleaned.length === 8 && (cleaned.startsWith('2') || cleaned.startsWith('3') || cleaned.startsWith('4') || cleaned.startsWith('8') || cleaned.startsWith('9'))) {
      return '0' + cleaned;
    }

    return null;
  };

  const extractPhoneFromLine = (line: string): string | null => {
    // Try to find any sequence representing an Israeli phone number
    // We can search for 05 or 5 followed by other digits (and possibly space or dash)
    const matchDirect = line.match(/(?:05\d|5\d)[\d\s-]{7,9}/);
    if (matchDirect) {
      const cleaned = cleanPhone(matchDirect[0]);
      if (cleaned) return cleaned;
    }

    // Try finding any 8-12 digits in the line
    const allDigits = line.replace(/\D/g, '');
    if (allDigits.length >= 8) {
      for (let len = Math.min(12, allDigits.length); len >= 8; len--) {
        for (let i = 0; i <= allDigits.length - len; i++) {
          const sub = allDigits.substring(i, i + len);
          const cleaned = cleanPhone(sub);
          if (cleaned) return cleaned;
        }
      }
    }

    return null;
  };

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    let buildingNum: number | null = null;
    let aptNum: number | null = null;

    // Pattern 1: cust match (e.g., 37.1.13)
    const custMatch = line.match(/(\d{2})\.(\d{1,2})\.(\d{1,3})/);
    if (custMatch) {
      buildingNum = parseInt(custMatch[2], 10);
      aptNum = parseInt(custMatch[3], 10);
    }

    // Pattern 2: Hebrew keywords (e.g. בניין 1 / 1 בניין)
    if (buildingNum === null || aptNum === null) {
      const bMatch = line.match(/(?:ןיינב|בניין)(?:\s+|:|\/|-)*(\d+)/i);
      const aMatch = line.match(/(?:הריד|דירה)(?:\s+|:|\/|-)*(\d+)/i);
      
      const bMatchRev = line.match(/(\d+)(?:\s+|:|\/|-)*(?:ןיינב|בניין)/i);
      const aMatchRev = line.match(/(\d+)(?:\s+|:|\/|-)*(?:הריד|דירה)/i);

      if (bMatch) buildingNum = parseInt(bMatch[1], 10);
      else if (bMatchRev) buildingNum = parseInt(bMatchRev[1], 10);

      if (aMatch) aptNum = parseInt(aMatch[1], 10);
      else if (aMatchRev) aptNum = parseInt(aMatchRev[1], 10);
    }

    // Pattern 3: Plot/block numbers check (e.g. 800 1 13)
    if (buildingNum === null || aptNum === null) {
      const numbers = line.match(/\b\d+\b/g);
      if (numbers && numbers.length >= 3) {
        const firstNum = parseInt(numbers[0], 10);
        if ([800, 801, 803, 806, 807, 812, 808, 810].includes(firstNum)) {
          const bVal = parseInt(numbers[1], 10);
          const aVal = parseInt(numbers[2], 10);
          if (bVal >= 1 && bVal <= 33 && aVal >= 1 && aVal <= 65) {
            buildingNum = bVal;
            aptNum = aVal;
          }
        }
      }
    }

    // Pattern 4: Fallback Space-separated number fields (e.g. '2 61 0527695771')
    if (buildingNum === null || aptNum === null) {
      const exPhone = extractPhoneFromLine(line);
      if (exPhone) {
        const normalizedExPhone = exPhone.startsWith('0') ? exPhone.substring(1) : exPhone;
        let lineWithoutPhone = line.replace(new RegExp(exPhone, 'g'), '');
        if (normalizedExPhone) {
          lineWithoutPhone = lineWithoutPhone.replace(new RegExp(normalizedExPhone, 'g'), '');
        }
        
        const numbers = lineWithoutPhone.match(/\b\d+\b/g);
        if (numbers && numbers.length >= 2) {
          const val1 = parseInt(numbers[0], 10);
          const val2 = parseInt(numbers[1], 10);
          if (val1 >= 1 && val1 <= 33 && val2 >= 1 && val2 <= 75) {
            buildingNum = val1;
            aptNum = val2;
          }
        }
      }
    }

    if (buildingNum === null || aptNum === null) continue;

    const buildingId = getBuildingIdFromNum(buildingNum);
    if (!buildingId) continue;

    const phone = extractPhoneFromLine(line);
    if (!phone) continue;

    results.push({
      buildingNum,
      aptNum,
      phone,
      originalText: rawLine,
      unitKey: `${buildingId}-${aptNum}`
    });
  }

  return results;
};

export const TenantImporter: React.FC<Props> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'phones' | 'names'>('phones');
  
  // Phone importing states
  const [isImporting, setIsImporting] = useState(false);
  const [currentBuilding, setCurrentBuilding] = useState<number | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Pasted Phone importing states
  const [pastedPhonesText, setPastedPhonesText] = useState('');
  const [isSavingPhones, setIsSavingPhones] = useState(false);
  const [phonesSuccessMessage, setPhonesSuccessMessage] = useState<string | null>(null);
  const [phonesErrorMessage, setPhonesErrorMessage] = useState<string | null>(null);

  // Name importing/reversing states
  const [pastedNamesText, setPastedNamesText] = useState('');
  const [isSavingNames, setIsSavingNames] = useState(false);
  const [namesSuccessMessage, setNamesSuccessMessage] = useState<string | null>(null);
  const [namesErrorMessage, setNamesErrorMessage] = useState<string | null>(null);
  const [shouldReverseHebrew, setShouldReverseHebrew] = useState<boolean>(true);

  // New states for custom file uploads (drag-and-drop & manual selection)
  const [uploadedFileText, setUploadedFileText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileSuccessMessage, setFileSuccessMessage] = useState<string | null>(null);
  const [fileErrorMessage, setFileErrorMessage] = useState<string | null>(null);
  const [isSavingUploadedFile, setIsSavingUploadedFile] = useState(false);

  // Parse uploaded file texts dynamically
  const parsedUploadedPhonesList = useMemo(() => {
    if (!uploadedFileText) return [];
    return parsePastedPhoneText(uploadedFileText);
  }, [uploadedFileText]);

  const parsedUploadedNamesList = useMemo(() => {
    if (!uploadedFileText) return [];
    return parsePastedText(uploadedFileText, shouldReverseHebrew);
  }, [uploadedFileText, shouldReverseHebrew]);

  // File upload drag-and-drop & select methods
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setFileSuccessMessage(null);
    setFileErrorMessage(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileSuccessMessage(null);
    setFileErrorMessage(null);
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setUploadedFileText(text);
      } catch (err) {
        setFileErrorMessage(lang === 'he' ? 'שגיאה בקריאת הקובץ' : 'Error reading file');
      }
    };
    reader.onerror = () => {
      setFileErrorMessage(lang === 'he' ? 'שגיאה בקריאת הקובץ' : 'Error reading file');
    };
    reader.readAsText(file);
  };

  const handleClearUploadedFile = () => {
    setUploadedFileText('');
    setUploadedFileName(null);
    setFileSuccessMessage(null);
    setFileErrorMessage(null);
  };

  const handleSaveUploadedPhones = async () => {
    if (parsedUploadedPhonesList.length === 0 || isSavingUploadedFile) return;
    setIsSavingUploadedFile(true);
    setFileSuccessMessage(null);
    setFileErrorMessage(null);

    let successCount = 0;
    try {
      for (const row of parsedUploadedPhonesList) {
        const unitRef = doc(db, 'units', row.unitKey);
        const unitSnap = await getDoc(unitRef);

        let finalUnit: Unit;
        if (unitSnap.exists()) {
          const currentData = unitSnap.data() as Unit;
          finalUnit = {
            ...currentData,
            tenantInfo: {
              name: currentData.tenantInfo?.name || '',
              phone: row.phone
            }
          };
        } else {
          finalUnit = {
            id: row.unitKey,
            projectId: 'bnei-brak',
            buildingId: getBuildingIdFromNum(row.buildingNum) || '',
            number: row.aptNum,
            statuses: {},
            history: [],
            tenantInfo: {
              name: '',
              phone: row.phone
            }
          };
        }

        await setDoc(unitRef, cleanObject(finalUnit));
        successCount++;
      }

      setFileSuccessMessage(
        lang === 'he'
          ? `קובץ הטלפונים עובד וסונכרן בהצלחה! ${successCount} דירות עודכנו.`
          : `Uploaded phone list parsed and synchronized successfully! ${successCount} apartments updated.`
      );
      setUploadedFileText('');
      setUploadedFileName(null);
    } catch (error) {
      console.error("Error saving uploaded tenant phones:", error);
      setFileErrorMessage(
        lang === 'he'
          ? `שגיאה בשמירת מספרי הטלפון מהקובץ: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`
          : `Error saving phone numbers from file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSavingUploadedFile(false);
    }
  };

  const handleSaveUploadedNames = async () => {
    if (parsedUploadedNamesList.length === 0 || isSavingUploadedFile) return;
    setIsSavingUploadedFile(true);
    setFileSuccessMessage(null);
    setFileErrorMessage(null);

    let successCount = 0;
    try {
      for (const row of parsedUploadedNamesList) {
        const unitRef = doc(db, 'units', row.unitKey);
        const unitSnap = await getDoc(unitRef);

        let fullName = row.name1;
        if (row.name2) {
          fullName += ' / ' + row.name2;
        }

        let finalUnit: Unit;
        if (unitSnap.exists()) {
          const currentData = unitSnap.data() as Unit;
          finalUnit = {
            ...currentData,
            tenantInfo: {
              name: fullName,
              phone: currentData.tenantInfo?.phone || ''
            }
          };
        } else {
          finalUnit = {
            id: row.unitKey,
            projectId: 'bnei-brak',
            buildingId: getBuildingIdFromNum(row.buildingNum) || '',
            number: row.aptNum,
            statuses: {},
            history: [],
            tenantInfo: {
              name: fullName,
              phone: ''
            }
          };
        }

        await setDoc(unitRef, cleanObject(finalUnit));
        successCount++;
      }

      setFileSuccessMessage(
        lang === 'he'
          ? (shouldReverseHebrew 
              ? `קובץ השמות עובד וסונכרן בהצלחה! השמות הפוכים תוקנו בהצלחה ועדכנו ${successCount} דירות.` 
              : `קובץ השמות עובד וסונכרן בהצלחה! עודכנו ${successCount} דירות.`)
          : (shouldReverseHebrew
              ? `Uploaded name list parsed and reversed successfully! ${successCount} apartments updated.`
              : `Uploaded name list parsed and synchronized successfully! ${successCount} apartments updated.`)
      );
      setUploadedFileText('');
      setUploadedFileName(null);
    } catch (error) {
      console.error("Error saving uploaded tenant names:", error);
      setFileErrorMessage(
        lang === 'he'
          ? `שגיאה בשמירת שמות הדיירים מהקובץ: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`
          : `Error saving tenant names from file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSavingUploadedFile(false);
    }
  };

  // Calculate total units in the import dataset
  const stats = useMemo(() => {
    let totalUnits = 0;
    const buildingIds = Object.keys(TENANT_IMPORT_DATA).map(Number);
    buildingIds.forEach(bId => {
      totalUnits += Object.keys(TENANT_IMPORT_DATA[bId] || {}).length;
    });
    return {
      totalBuildings: buildingIds.length,
      totalUnits,
    };
  }, []);

  const parsedNamesList = useMemo(() => {
    return parsePastedText(pastedNamesText, shouldReverseHebrew);
  }, [pastedNamesText, shouldReverseHebrew]);

  const parsedPhonesList = useMemo(() => {
    return parsePastedPhoneText(pastedPhonesText);
  }, [pastedPhonesText]);

  const handleSavePastedPhones = async () => {
    if (parsedPhonesList.length === 0 || isSavingPhones) return;
    setIsSavingPhones(true);
    setPhonesSuccessMessage(null);
    setPhonesErrorMessage(null);

    let successCount = 0;
    try {
      for (const row of parsedPhonesList) {
        const unitRef = doc(db, 'units', row.unitKey);
        const unitSnap = await getDoc(unitRef);

        let finalUnit: Unit;
        if (unitSnap.exists()) {
          const currentData = unitSnap.data() as Unit;
          finalUnit = {
            ...currentData,
            tenantInfo: {
              name: currentData.tenantInfo?.name || '',
              phone: row.phone
            }
          };
        } else {
          finalUnit = {
            id: row.unitKey,
            projectId: 'bnei-brak',
            buildingId: getBuildingIdFromNum(row.buildingNum) || '',
            number: row.aptNum,
            statuses: {},
            history: [],
            tenantInfo: {
              name: '',
              phone: row.phone
            }
          };
        }

        await setDoc(unitRef, cleanObject(finalUnit));
        successCount++;
      }

      setPhonesSuccessMessage(
        lang === 'he'
          ? `מספרי הטלפון עובדו וסונכרנו בהצלחה! ${successCount} דירות עודכנו.`
          : `Phone numbers parsed and synchronized successfully! ${successCount} apartments updated.`
      );
      setPastedPhonesText('');
    } catch (error) {
      console.error("Error saving pasted tenant phones:", error);
      setPhonesErrorMessage(
        lang === 'he'
          ? `שגיאה בשמירת מספרי הטלפון: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`
          : `Error saving phone numbers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSavingPhones(false);
    }
  };

  const handleImport = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setImportedCount(0);
    setLogMessages([]);
    setStatusMessage(lang === 'he' ? 'מתחיל בייבוא דיירים מ-PDF...' : 'Starting tenant import from PDF...');

    const buildingIds = Object.keys(TENANT_IMPORT_DATA).map(Number).sort((a, b) => a - b);
    let overallCount = 0;

    try {
      for (const bId of buildingIds) {
        setCurrentBuilding(bId);
        const buildingId = getBuildingIdFromNum(bId);
        if (!buildingId) {
          console.warn(`Skipping building ${bId}, no plot assignment found.`);
          continue;
        }

        const buildingData = TENANT_IMPORT_DATA[bId];
        const aptNumbers = Object.keys(buildingData).map(Number).sort((a, b) => a - b);
        
        setStatusMessage(
          lang === 'he' 
            ? `מייבא בניין ${bId} (סך הכל ${aptNumbers.length} דירות)...` 
            : `Importing building ${bId} (${aptNumbers.length} apartments)...`
        );

        for (const aptNo of aptNumbers) {
          const rawPhone = buildingData[aptNo];
          if (!rawPhone) continue;

          const phone = standardizePhone(rawPhone);
          const key = `${buildingId}-${aptNo}`;
          const unitRef = doc(db, 'units', key);

          // Get existing to prevent overwriting other attributes
          const unitSnap = await getDoc(unitRef);
          let finalUnit: Unit;

          if (unitSnap.exists()) {
            const currentData = unitSnap.data() as Unit;
            finalUnit = {
              ...currentData,
              tenantInfo: {
                name: currentData.tenantInfo?.name || '',
                phone: phone
              }
            };
          } else {
            finalUnit = {
              id: key,
              projectId: 'bnei-brak',
              buildingId: buildingId,
              number: aptNo,
              statuses: {},
              history: [],
              tenantInfo: {
                name: '',
                phone: phone
              }
            };
          }

          await setDoc(unitRef, cleanObject(finalUnit));
          overallCount++;
          setImportedCount(overallCount);
        }

        // Output log for completed building
        const successLine = lang === 'he'
          ? `בניין ${bId}: ייבוא של ${aptNumbers.length} דירות הושלם בהצלחה.`
          : `Building ${bId}: Import of ${aptNumbers.length} apartments completed successfully.`;
        setLogMessages(prev => [successLine, ...prev].slice(0, 5));
      }

      setStatusMessage(
        lang === 'he' 
          ? `הייבוא הושלם! עודכנו ${overallCount} דירות בהצלחה.` 
          : `Import completed! ${overallCount} apartments updated successfully.`
      );
    } catch (error) {
      console.error("Error during tenant import:", error);
      setStatusMessage(
        lang === 'he' 
          ? `שגיאה בתהליך הייבוא: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}` 
          : `Error during import: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsImporting(false);
      setCurrentBuilding(null);
    }
  };

  const handleSaveNames = async () => {
    if (parsedNamesList.length === 0 || isSavingNames) return;
    setIsSavingNames(true);
    setNamesSuccessMessage(null);
    setNamesErrorMessage(null);

    let successCount = 0;
    try {
      for (const row of parsedNamesList) {
        const unitRef = doc(db, 'units', row.unitKey);
        const unitSnap = await getDoc(unitRef);

        let fullName = row.name1;
        if (row.name2) {
          fullName += ' / ' + row.name2;
        }

        let finalUnit: Unit;
        if (unitSnap.exists()) {
          const currentData = unitSnap.data() as Unit;
          finalUnit = {
            ...currentData,
            tenantInfo: {
              name: fullName,
              phone: currentData.tenantInfo?.phone || ''
            }
          };
        } else {
          finalUnit = {
            id: row.unitKey,
            projectId: 'bnei-brak',
            buildingId: getBuildingIdFromNum(row.buildingNum) || '',
            number: row.aptNum,
            statuses: {},
            history: [],
            tenantInfo: {
              name: fullName,
              phone: ''
            }
          };
        }

        await setDoc(unitRef, cleanObject(finalUnit));
        successCount++;
      }

      setNamesSuccessMessage(
        lang === 'he'
          ? (shouldReverseHebrew
              ? `השמות עובדו, הפוכו משמאל-לימין לימין-לשמאל, וסונכרנו בהצלחה! ${successCount} דירות עודכנו.`
              : `השמות עובדו וסונכרנו בהצלחה! ${successCount} דירות עודכנו בסך הכל.`)
          : (shouldReverseHebrew
              ? `Names reversed (from LTR to RTL) and synchronized successfully! ${successCount} apartments updated.`
              : `Names synchronized successfully! ${successCount} apartments updated.`)
      );
      setPastedNamesText('');
    } catch (error) {
      console.error("Error saving reversed tenant names:", error);
      setNamesErrorMessage(
        lang === 'he'
          ? `שגיאה בשמירת שמות הדיירים: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`
          : `Error saving tenant names: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSavingNames(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-5">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
          <span className="bg-indigo-50 p-2 rounded-xl">📄</span>
          {lang === 'he' ? 'בסיס נתונים דיירים מ-PDF' : 'Tenant Database PDF Import'}
        </h2>
        
        {/* Active Tabs selector */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab('phones')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'phones' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'he' ? '📱 ייבוא טלפונים' : '📱 Import Phones'}
          </button>
          <button
            onClick={() => setActiveTab('names')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'names' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'he' ? '👤 סנכרון שמות PDF הפוכים' : '👤 Sync Backwards Names'}
          </button>
        </div>
      </div>

      {activeTab === 'phones' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <p className="text-gray-500 font-bold text-sm leading-relaxed">
            {lang === 'he' 
              ? 'כלי ייבוא מרוכז לעדכון מספרי הטלפון של הדיירים ישירות מקובץ ניהול שמות הדיירים והבניינים. הכלי מעדכן את מספרי הטלפון עבור כל הדירות באופן אוטומטי מבלי לפגוע בהיסטוריה או בסטטוס המשימות הקיים במערכת.' 
              : 'Central import tool to update tenant phone numbers directly from the PDF manager. It updates phone numbers automatically for all apartments without affecting historical logs or current job statuses.'}
          </p>

          {/* Dataset Statistics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-center">
              <span className="text-3xl font-black text-indigo-700 block mb-1">{stats.totalBuildings}</span>
              <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                {lang === 'he' ? 'בניינים במאגר' : 'Mapped Buildings'}
              </span>
            </div>
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center">
              <span className="text-3xl font-black text-emerald-700 block mb-1">{stats.totalUnits}</span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                {lang === 'he' ? 'טלפונים של דיירים' : 'Tenant Phone Records'}
              </span>
            </div>
          </div>

          {statusMessage && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs font-black text-slate-500">
                <span>{statusMessage}</span>
                {isImporting && (
                  <span className="animate-pulse bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px]">
                    {lang === 'he' ? 'מעבד...' : 'Processing...'}
                  </span>
                )}
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isImporting ? 'bg-indigo-600 animate-pulse' : 'bg-green-500'}`} 
                  style={{ width: `${(importedCount / stats.totalUnits) * 100}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                <span>{importedCount} / {stats.totalUnits} {lang === 'he' ? 'דירות סונכרנו' : 'units sync status'}</span>
                <span>{Math.round((importedCount / stats.totalUnits) * 100)}%</span>
              </div>
            </div>
          )}

          {/* Active Logs */}
          {logMessages.length > 0 && (
            <div className="p-3 bg-slate-900 text-slate-300 rounded-2xl font-mono text-[11px] space-y-1">
              {logMessages.map((msg, index) => (
                <div key={index} className={index === 0 ? "text-green-400 font-bold" : "opacity-80"}>
                  &gt; {msg}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={isImporting}
            className={`w-full py-4.5 rounded-2xl font-black text-white text-md shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${
              isImporting 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/20'
            }`}
          >
            {isImporting ? (
              <>
                <span className="inline-block animate-spin font-sans">🔄</span>
                <span>{lang === 'he' ? `מייבא... בניין ${currentBuilding}` : `Importing... Building ${currentBuilding}`}</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>{lang === 'he' ? 'סנכרן את כל דיירי ה-PDF למערכת' : 'Sync all PDF tenants in Database'}</span>
              </>
            )}
          </button>

          <div className="mt-4 text-[10px] text-gray-400 font-bold text-center">
            ℹ️ {lang === 'he' ? 'תהליך זה עשוי להימשך מספר שניות בגלל עדכוני מסד הנתונים.' : 'This process may take a few seconds due to database sync rates.'}
          </div>

          {/* Option B: Pasted Phone list Importer */}
          <div className="border-t border-slate-150 pt-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              {lang === 'he' ? '✍️ אפשרות ב\': הדבק טקסט חופשי לעדכון טלפונים' : '✍️ Option B: Paste Free Text to Update Phones'}
            </h3>
            <p className="text-xs font-bold text-slate-450 leading-relaxed">
              {lang === 'he'
                ? 'העתק שורות מרשימת אימיילים או מרשימה המכילה מספרי בניין, דירה וטלפון (כמו עמוד 89 ב-PDF המכיל מספרי טלפון המופיעים בברירת המחדל של האימיילים) והדבק כאן. המערכת תזהה את מספרי הטלפון ותעדכן אותם אוטומטית.'
                : 'Copy lines from any phone or email list containing building, apartment, and phone numbers (such as page 89 of the PDF containing phone numbers in custom email addresses) and paste here. The system extracts and updates them automatically.'}
            </p>

            <div className="flex flex-col gap-2">
              <textarea
                value={pastedPhonesText}
                onChange={(e) => setPastedPhonesText(e.target.value)}
                placeholder={
                  lang === 'he' 
                    ? 'הדבק שורות המכילות בניין, דירה וטלפון... למשל:\nןיינב 2 הריד 61 com.gmail@0527695771y' 
                    : 'Paste lines containing building, apartment and phone here...'
                }
                rows={4}
                className="w-full bg-slate-50 border border-slate-250 p-4 rounded-2xl outline-none focus:border-indigo-500 font-mono text-xs text-slate-800 leading-relaxed animate-none"
              />
            </div>

            {pastedPhonesText.trim() !== '' && (
              <div className="space-y-3">
                {parsedPhonesList.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                        {lang === 'he' ? `זוהו ${parsedPhonesList.length} טלפונים לעדכון` : `Detected ${parsedPhonesList.length} phones to update`}
                      </span>
                    </div>

                    {/* Previews Table */}
                    <div className="max-h-40 overflow-y-auto border border-slate-150 rounded-2xl divide-y divide-slate-100 bg-slate-50/50 animate-in fade-in duration-200">
                      {parsedPhonesList.map((row, idx) => (
                        <div key={idx} className="p-3 text-xs flex justify-between gap-4 items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md min-w-[70px] text-center">
                              {lang === 'he' ? `בניין ${row.buildingNum}` : `Bldg ${row.buildingNum}`}
                            </span>
                            <span className="font-bold text-slate-700">
                              {lang === 'he' ? `דירה ${row.aptNum}` : `Apt ${row.aptNum}`}
                            </span>
                          </div>

                          <div className="font-mono text-emerald-700 font-black">
                            {row.phone}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSavePastedPhones}
                      disabled={isSavingPhones}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 py-4.5 rounded-2xl text-white font-black text-sm shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {isSavingPhones ? (
                        <>
                          <span className="inline-block animate-spin">🔄</span>
                          <span>{lang === 'he' ? 'מעדכן מספרי טלפון...' : 'Updating phone numbers...'}</span>
                        </>
                      ) : (
                        <>
                          <span>📱</span>
                          <span>{lang === 'he' ? `עדכן וסנכרן את ${parsedPhonesList.length} הטלפונים שזוהו` : `Update & Sync ${parsedPhonesList.length} parsed phones`}</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
                    <div className="font-black">⚠️ {lang === 'he' ? 'לא זוהו טלפונים לפענוח' : 'No phones detected and mapped'}</div>
                    <p className="font-bold text-[11.5px] text-slate-650 opacity-90 leading-relaxed">
                      {lang === 'he'
                        ? 'ודא שהשורות שהעתקת מכילות מזהי בניין, דירה ומספר טלפון תקין (למשל, 05 או 5 בתחילת המספר).'
                        : 'Verify the pasted text contains building and apartment identifiers along with a valid phone number.'}
                    </p>
                    <button
                      disabled
                      className="w-full mt-2 bg-slate-350 py-3.5 rounded-2xl text-white font-black text-xs cursor-default flex items-center justify-center gap-2"
                    >
                      <span>📱</span>
                      <span>{lang === 'he' ? 'נעדרים מספרי טלפון לסינכרון' : 'No phones to synchronize'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {phonesSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 font-bold text-xs rounded-2xl animate-in fade-in duration-200">
                ✅ {phonesSuccessMessage}
              </div>
            )}

            {phonesErrorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-150 text-rose-800 font-bold text-xs rounded-2xl animate-in fade-in duration-200">
                ⚠️ {phonesErrorMessage}
              </div>
            )}

            {/* Option C: Dynamic File Uploader to update phones from a PDF export file or a list file */}
            <div className="border-t border-slate-150 pt-6 space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                {lang === 'he' ? '📂 אפשרות ג\': העלאת קובץ עדכון חדש' : '📂 Option C: Upload New Update File'}
              </h3>
              <p className="text-xs font-bold text-slate-450 leading-relaxed">
                {lang === 'he'
                  ? 'העלה קובץ טקסט (.txt, .csv, .json) שהעתקת מה-PDF המעודכן שלך. המערכת תפענח באופן אוטומטי את כל מספרי הטלפון המתאימים לדירות ולבניינים ותסנכרן אותם.'
                  : 'Upload a text report file (.txt, .csv, .json) extracted from your updated PDF. The system automatically extracts all valid building/apartment numbers and correlates their phones.'}
              </p>

              {/* Dynamic Drag & Drop Dropzone */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleFileDrop}
                onClick={() => {
                  const input = document.getElementById('uploaded-phones-file-input') as HTMLInputElement;
                  if (input) input.click();
                }}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 transform ${
                  isDragOver 
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                    : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-slate-50/80'
                }`}
              >
                <input 
                  id="uploaded-phones-file-input"
                  type="file" 
                  accept=".txt,.csv,.json,.log" 
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="text-4xl mb-3">📥</div>
                <div className="font-black text-sm text-indigo-700">
                  {lang === 'he' ? 'גרור והשלך קובץ עדכון כאן או לחץ לבחירה' : 'Drag & drop your updated list file here, or click to browse'}
                </div>
                <p className="text-xs text-slate-400 mt-2 font-bold">
                  {lang === 'he' ? 'תומך בקובצי טקסט (.txt) או אקסל (.csv) שהומרו לטקסט' : 'Supports plain text files (.txt) or comma-separated lists (.csv)'}
                </p>
                {uploadedFileName && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-150 rounded-full text-xs font-black text-emerald-800 shadow-md">
                    <span>📄</span>
                    <span>{uploadedFileName}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearUploadedFile();
                      }}
                      className="text-rose-500 hover:text-rose-700 ml-2 font-black"
                      title={lang === 'he' ? 'נקה קובץ' : 'Clear file'}
                    >
                      ❌
                    </button>
                  </div>
                )}
              </div>

              {/* Preview and Save area for custom file upload */}
              {uploadedFileText.trim() !== '' && (
                <div className="p-5 bg-indigo-50/30 rounded-3xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-indigo-700 bg-indigo-100/80 px-3 py-1.5 rounded-full">
                      {lang === 'he' 
                        ? `נמצאו ${parsedUploadedPhonesList.length} טלפונים בקובץ לעדכון` 
                        : `Detected ${parsedUploadedPhonesList.length} phones in uploaded file`}
                    </span>
                    <button 
                      onClick={handleClearUploadedFile}
                      className="text-xs font-black text-rose-600 hover:underline"
                    >
                      {lang === 'he' ? 'ביטול' : 'Cancel'}
                    </button>
                  </div>

                  {parsedUploadedPhonesList.length > 0 ? (
                    <>
                      {/* Upload Table Previews */}
                      <div className="max-h-48 overflow-y-auto border border-slate-150 rounded-2xl divide-y divide-slate-100 bg-white">
                        {parsedUploadedPhonesList.slice(0, 100).map((row, idx) => (
                          <div key={idx} className="p-3 text-xs flex justify-between gap-4 items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md min-w-[70px] text-center">
                                {lang === 'he' ? `בניין ${row.buildingNum}` : `Bldg ${row.buildingNum}`}
                              </span>
                              <span className="font-bold text-slate-700">
                                {lang === 'he' ? `דירה ${row.aptNum}` : `Apt ${row.aptNum}`}
                              </span>
                            </div>
                            <div className="font-mono text-emerald-700 font-extrabold text-[12px]">
                              {row.phone}
                            </div>
                          </div>
                        ))}
                        {parsedUploadedPhonesList.length > 100 && (
                          <div className="p-3 text-center text-[10px] font-bold text-slate-400 bg-slate-50 italic">
                            ... {lang === 'he' ? `ועוד ${parsedUploadedPhonesList.length - 100} רשומות` : `and ${parsedUploadedPhonesList.length - 100} more rows`}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleSaveUploadedPhones}
                        disabled={isSavingUploadedFile}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 py-4.5 rounded-2xl text-white font-black text-md shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        {isSavingUploadedFile ? (
                          <>
                            <span className="inline-block animate-spin font-sans">🔄</span>
                            <span>{lang === 'he' ? 'מעדכן מספרי טלפון מהקובץ...' : 'Updating file phone records...'}</span>
                          </>
                        ) : (
                          <>
                            <span>💾</span>
                            <span>{lang === 'he' ? `עדכן וסנכרן את ${parsedUploadedPhonesList.length} הטלפונים מהקובץ שהועלה` : `Update & Sync ${parsedUploadedPhonesList.length} phones from uploaded file`}</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-150 text-amber-900 rounded-2xl text-xs space-y-1">
                      <div className="font-black">⚠️ {lang === 'he' ? 'לא זוהו טלפונים תקינים בקובץ' : 'No valid phones found in file'}</div>
                      <p className="font-medium text-slate-650">
                        {lang === 'he' 
                          ? 'ודא שהקובץ שהעלית מכיל שורות עם מזהי בניינים ודירות. למשל: "בניין 2 דירה 61" ומספר טלפון תקין.'
                          : 'Ensure the uploaded file contains strings resembling building and apartment identifiers with valid phones.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {fileSuccessMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 font-bold text-xs rounded-2xl">
                  ✅ {fileSuccessMessage}
                </div>
              )}

              {fileErrorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-150 text-rose-800 font-bold text-xs rounded-2xl">
                  ⚠️ {fileErrorMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          <p className="text-gray-500 font-bold text-sm leading-relaxed">
            {lang === 'he' 
              ? 'העתק את טקסט השורות מקובץ שמות הדיירים והדבק אותם כאן. המערכת תזהה את מספרי הדיירים והבניינים, ותסנכרן את שמות הדיירים למערכת.' 
              : 'Copy rows of text from your tenant names PDF and paste them below. The system automatically detects building/apartments and synchronizes names correctly.'}
          </p>

          {/* Toggle Button Group for Reversing vs Normal Hebrew */}
          <div className="bg-slate-55 p-4 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5 text-right w-full md:w-auto">
              <span className="text-xs font-black text-slate-700">
                {lang === 'he' ? 'כיוון כתיבת השמות בקובץ שהועתק:' : 'Pasted Hebrew Text Direction:'}
              </span>
              <span className="text-[10.5px] font-bold text-slate-450">
                {lang === 'he' ? 'בחר באפשרות זו אם השמות ב-PDF מיוצאים הפוכים משמאל לימין' : 'Select if the names in the PDF are exported backwards from left to right'}
              </span>
            </div>
            
            <div className="inline-flex p-1 bg-slate-200/50 rounded-2xl border border-slate-300 w-full md:w-auto justify-center">
              <button
                type="button"
                onClick={() => setShouldReverseHebrew(true)}
                className={`flex-1 md:flex-initial px-4 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                  shouldReverseHebrew 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-650 hover:text-slate-800 hover:bg-slate-300/30'
                }`}
              >
                <span>🔄</span>
                <span>{lang === 'he' ? 'שמות הפוכים (תקן לעברית)' : 'Reversed Names (Fix RTL)'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShouldReverseHebrew(false)}
                className={`flex-1 md:flex-initial px-4 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                  !shouldReverseHebrew 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-650 hover:text-slate-800 hover:bg-slate-300/30'
                }`}
              >
                <span>➡️</span>
                <span>{lang === 'he' ? 'עברית תקינה (ללא שינוי)' : 'Normal Hebrew (No Change)'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider">{lang === 'he' ? 'טקסט מועתק מהקובץ' : 'Pasted PDF Text'}</label>
            <textarea
              value={pastedNamesText}
              onChange={(e) => setPastedNamesText(e.target.value)}
              placeholder={
                lang === 'he' 
                  ? 'הדבק כאן שורות מהקובץ... למשל:\n800 1 ןיינב 1 הריד 13 31 ןהאק ךלמילא לארשי ןהאק םירמ לחר' 
                  : 'Paste rows here...'
              }
              rows={8}
              className="w-full bg-slate-50 border border-slate-250 p-4 rounded-2xl outline-none focus:border-indigo-500 font-mono text-xs text-slate-800 leading-relaxed"
            />
          </div>

          {pastedNamesText.trim() !== '' && (
            <div className="space-y-3">
              {parsedNamesList.length > 0 ? (
                <>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                      {lang === 'he' ? `זוהו ${parsedNamesList.length} שורות לעדכון` : `Detected ${parsedNamesList.length} rows to update`}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {lang === 'he' 
                        ? (shouldReverseHebrew ? 'שמות הפוכים מתורגמים לעברית תקינה' : 'שמות יסונכרנו ללא היפוך') 
                        : (shouldReverseHebrew ? 'Automatically reversed names preview' : 'Names as inputted preview')}
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-60 overflow-y-auto border border-slate-150 rounded-2xl divide-y divide-slate-100 bg-slate-50/50">
                    {parsedNamesList.map((row, idx) => (
                      <div key={idx} className="p-3 text-xs flex justify-between gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md min-w-[70px] text-center">
                            {lang === 'he' ? `בניין ${row.buildingNum}` : `Bldg ${row.buildingNum}`}
                          </span>
                          <span className="font-bold text-slate-700">
                            {lang === 'he' ? `דירה ${row.aptNum}` : `Apt ${row.aptNum}`}
                          </span>
                        </div>

                        <div className="flex-1 text-left font-black text-emerald-800">
                          <span>{row.name1}</span>
                          {row.name2 && <span className="opacity-60 text-[10px] block font-bold">{row.name2}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveNames}
                    disabled={isSavingNames}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 py-4.5 rounded-2xl text-white font-black text-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20"
                  >
                    {isSavingNames ? (
                      <>
                        <span className="inline-block animate-spin">🔄</span>
                        <span>{lang === 'he' ? 'מעדכן שמות במסד הנתונים...' : 'Updating reversed names...'}</span>
                      </>
                    ) : (
                      <>
                        <span>🔄</span>
                        <span>{lang === 'he' 
                          ? (shouldReverseHebrew ? `הפוך וסנכרן ${parsedNamesList.length} דיירים למערכת` : `סנכרן ${parsedNamesList.length} דיירים למערכת`) 
                          : (shouldReverseHebrew ? `Reverse & Sync ${parsedNamesList.length} tenants` : `Sync ${parsedNamesList.length} tenants`)}</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
                  <div className="font-black">⚠️ {lang === 'he' ? 'לא זוהו שמות לפענוח' : 'No names detected and mapped'}</div>
                  <p className="font-bold text-[11.5px] text-slate-650 opacity-90 leading-relaxed">
                    {lang === 'he'
                      ? 'ודא שהשורות שהעתקת מכילות מזהי בניין, דירה ושמות בעברית (למשל, בניין 1 דירה 13).'
                      : 'Verify the pasted text contains building and apartment identifiers along with names in Hebrew.'}
                  </p>
                  <button
                    disabled
                    className="w-full mt-2 bg-slate-350 py-3.5 rounded-2xl text-white font-black text-xs cursor-default flex items-center justify-center gap-2"
                  >
                    <span>🔄</span>
                    <span>{lang === 'he' ? 'נעדרים שמות לסינכרון' : 'No names to synchronize'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {namesSuccessMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 font-bold text-xs rounded-2xl">
              ✅ {namesSuccessMessage}
            </div>
          )}

          {namesErrorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-150 text-rose-800 font-bold text-xs rounded-2xl">
              ⚠️ {namesErrorMessage}
            </div>
          )}

          {/* Option B: Upload Text/CSV file directly to reverse and update names */}
          <div className="border-t border-slate-150 pt-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              {lang === 'he' ? '📂 אפשרות ב\': העלאת קובץ חדש לעדכון שמות' : '📂 Option B: Upload New File to Update Names'}
            </h3>
            <p className="text-xs font-bold text-slate-450 leading-relaxed">
              {lang === 'he'
                ? 'העלה קובץ טקסט (.txt, .csv) המכיל שמות של דיירים. המערכת תהפוך אותם אוטומטית לעברית תקינה ותסנכרן אותם.'
                : 'Upload a text file (.txt, .csv) containing tenant names. The system will reverse Visual Hebrew backwards names and write them RTL correctly.'}
            </p>

            {/* Dynamic Drag & Drop Dropzone for Names */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleFileDrop}
              onClick={() => {
                const input = document.getElementById('uploaded-names-file-input') as HTMLInputElement;
                if (input) input.click();
              }}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 transform ${
                isDragOver 
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                  : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-slate-50/80'
              }`}
            >
              <input 
                id="uploaded-names-file-input"
                type="file" 
                accept=".txt,.csv,.json,.log" 
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-4xl mb-3">👤</div>
              <div className="font-black text-sm text-indigo-700">
                {lang === 'he' ? 'גרור והשלך קובץ עדכון שמות כאן או לחץ לבחירה' : 'Drag & drop names list file here, or click to browse'}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-bold">
                {lang === 'he' ? 'תומך בקובצי טקסט (.txt) או אקסל (.csv)' : 'Supports plain text files (.txt) or list files (.csv)'}
              </p>
              {uploadedFileName && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-150 rounded-full text-xs font-black text-emerald-800 shadow-md">
                  <span>📄</span>
                  <span>{uploadedFileName}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearUploadedFile();
                    }}
                    className="text-rose-500 hover:text-rose-700 ml-2 font-black"
                    title={lang === 'he' ? 'נקה קובץ' : 'Clear file'}
                  >
                    ❌
                  </button>
                </div>
              )}
            </div>

            {/* Preview and Save area for custom file upload (names) */}
            {uploadedFileText.trim() !== '' && (
              <div className="p-5 bg-indigo-50/30 rounded-3xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-indigo-700 bg-indigo-100/80 px-3 py-1.5 rounded-full">
                    {lang === 'he' 
                      ? `זוהו ${parsedUploadedNamesList.length} שורות לעדכון` 
                      : `Detected ${parsedUploadedNamesList.length} rows in uploaded file`}
                  </span>
                  <button 
                    onClick={handleClearUploadedFile}
                    className="text-xs font-black text-rose-600 hover:underline"
                  >
                    {lang === 'he' ? 'ביטול' : 'Cancel'}
                  </button>
                </div>

                {parsedUploadedNamesList.length > 0 ? (
                  <>
                    {/* Upload Table Previews (names) */}
                    <div className="max-h-48 overflow-y-auto border border-slate-150 rounded-2xl divide-y divide-slate-100 bg-white">
                      {parsedUploadedNamesList.slice(0, 100).map((row, idx) => (
                        <div key={idx} className="p-3 text-xs flex justify-between gap-4 items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md min-w-[70px] text-center">
                              {lang === 'he' ? `בניין ${row.buildingNum}` : `Bldg ${row.buildingNum}`}
                            </span>
                            <span className="font-bold text-slate-700">
                              {lang === 'he' ? `דירה ${row.aptNum}` : `Apt ${row.aptNum}`}
                            </span>
                          </div>
                          <div className="flex-1 text-left font-black text-emerald-800 text-[11px]">
                            <span>{row.name1}</span>
                            {row.name2 && <span className="opacity-60 text-[9px] block font-bold">{row.name2}</span>}
                          </div>
                        </div>
                      ))}
                      {parsedUploadedNamesList.length > 100 && (
                        <div className="p-3 text-center text-[10px] font-bold text-slate-400 bg-slate-50 italic">
                          ... {lang === 'he' ? `ועוד ${parsedUploadedNamesList.length - 100} רשומות` : `and ${parsedUploadedNamesList.length - 100} more rows`}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSaveUploadedNames}
                      disabled={isSavingUploadedFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 py-4.5 rounded-2xl text-white font-black text-md shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {isSavingUploadedFile ? (
                        <>
                          <span className="inline-block animate-spin font-sans">🔄</span>
                          <span>{lang === 'he' ? 'מעדכן שמות מהקובץ...' : 'Updating file tenant names...'}</span>
                        </>
                      ) : (
                        <>
                          <span>🔄</span>
                          <span>{lang === 'he' 
                            ? (shouldReverseHebrew ? `הפוך וסנכרן את ${parsedUploadedNamesList.length} הדיירים מהקובץ` : `סנכרן את ${parsedUploadedNamesList.length} הדיירים מהקובץ`) 
                            : (shouldReverseHebrew ? `Reverse & Sync ${parsedUploadedNamesList.length} names from uploaded file` : `Sync ${parsedUploadedNamesList.length} names from uploaded file`)}</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
                    <div className="font-black">⚠️ {lang === 'he' ? 'לא זוהו שמות תקינים בקובץ' : 'No valid names found in file'}</div>
                    <p className="font-medium text-slate-650">
                      {lang === 'he' 
                        ? 'ודא שהקובץ שהעלית מכיל שורות עם מזהי בניינים ודירות. למשל: "בניין 1 דירה 13" ושמות בעברית.'
                        : 'Ensure the uploaded file contains strings resembling building and apartment identifiers along with Hebrew names.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {fileSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 font-bold text-xs rounded-2xl">
                ✅ {fileSuccessMessage}
              </div>
            )}

            {fileErrorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-150 text-rose-800 font-bold text-xs rounded-2xl">
                ⚠️ {fileErrorMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
