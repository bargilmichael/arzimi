import React, { useState, useRef, useEffect } from 'react';
import { PriceQuote, QuoteWorkflowStep, QuoteDocument, ProjectState } from '../types';
import { Language, translations } from '../translations';
import { auth } from '../firebase';
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Send,
  PackageCheck,
  X,
  Copy,
  Check,
  Mail,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  Download,
  Trash2,
  Edit3,
  PenTool,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export const SUPPLIER_LIST = [
  'רב בריח',
  'דלתות חמדיה',
  'סטודיו קרמיקה',
  'נגב',
  'שיש בראנץ',
  'מטבחי קרמיקה'
];

interface Props {
  quote?: PriceQuote | null;
  state: ProjectState;
  selectedProjectId: string;
  lang: Language;
  userRole: 'admin' | 'contractor' | 'viewer';
  onClose: () => void;
  onSave: (quoteData: Partial<PriceQuote>) => Promise<void>;
  onDelete?: (quoteId: string) => Promise<void>;
}

export const PriceQuoteModal: React.FC<Props> = ({
  quote,
  state,
  selectedProjectId,
  lang,
  userRole,
  onClose,
  onSave,
  onDelete
}) => {
  const t = translations[lang] as any;
  const isEditMode = !!quote;

  // Active step view tab or workflow view
  const [activeStepTab, setActiveStepTab] = useState<QuoteWorkflowStep>(
    quote?.status || QuoteWorkflowStep.REQUEST_SENT
  );

  // Form Fields - Step 1
  const [buildingId, setBuildingId] = useState<string>(
    quote?.buildingId || (state.buildings.length > 0 ? state.buildings[0].id : '')
  );
  const [unitNumber, setUnitNumber] = useState<string>(
    quote?.unitNumber !== undefined ? String(quote.unitNumber) : ''
  );
  const [selectedSupplierPreset, setSelectedSupplierPreset] = useState<string>(() => {
    if (!quote?.supplier) return SUPPLIER_LIST[0];
    return SUPPLIER_LIST.includes(quote.supplier) ? quote.supplier : 'custom';
  });
  const [customSupplier, setCustomSupplier] = useState<string>(() => {
    if (!quote?.supplier) return '';
    return SUPPLIER_LIST.includes(quote.supplier) ? '' : quote.supplier;
  });
  const [requestDate, setRequestDate] = useState<string>(
    quote?.requestDate || new Date().toISOString().split('T')[0]
  );
  const [requestedBy, setRequestedBy] = useState<string>(
    quote?.requestedBy || auth.currentUser?.displayName || auth.currentUser?.email || 'פקידת בדק'
  );
  const [requestEmail, setRequestEmail] = useState<string>(quote?.requestEmail || '');
  const [itemDescription, setItemDescription] = useState<string>(quote?.itemDescription || '');
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'immediate'>(
    quote?.urgency || 'normal'
  );
  const [notes, setNotes] = useState<string>(quote?.notes || '');

  // Form Fields - Step 2: Quote Received
  const [quoteReceivedDate, setQuoteReceivedDate] = useState<string>(
    quote?.quoteReceivedDate || new Date().toISOString().split('T')[0]
  );
  const [quoteNumber, setQuoteNumber] = useState<string>(quote?.quoteNumber || '');
  const [quoteAmount, setQuoteAmount] = useState<string>(
    quote?.quoteAmount !== undefined ? String(quote.quoteAmount) : ''
  );
  const [quoteFile, setQuoteFile] = useState<QuoteDocument | undefined>(quote?.quoteFile);
  const [receivedNotes, setReceivedNotes] = useState<string>(quote?.receivedNotes || '');

  // Form Fields - Step 3: Approval & Signature
  const [approvedDate, setApprovedDate] = useState<string>(
    quote?.approvedDate || new Date().toISOString().split('T')[0]
  );
  const [approvedBy, setApprovedBy] = useState<string>(
    quote?.approvedBy || auth.currentUser?.displayName || auth.currentUser?.email || 'מנהל בדק'
  );
  const [approvedAmount, setApprovedAmount] = useState<string>(
    quote?.approvedAmount !== undefined
      ? String(quote.approvedAmount)
      : quote?.quoteAmount !== undefined
      ? String(quote.quoteAmount)
      : ''
  );
  const [signatureImage, setSignatureImage] = useState<string | undefined>(quote?.signatureImage);
  const [signedQuoteFile, setSignedQuoteFile] = useState<QuoteDocument | undefined>(
    quote?.signedQuoteFile
  );
  const [managerNotes, setManagerNotes] = useState<string>(quote?.managerNotes || '');

  // Form Fields - Step 4: Dispatch & Order
  const [dispatchedDate, setDispatchedDate] = useState<string>(
    quote?.dispatchedDate || new Date().toISOString().split('T')[0]
  );
  const [dispatchedBy, setDispatchedBy] = useState<string>(
    quote?.dispatchedBy || auth.currentUser?.displayName || auth.currentUser?.email || 'פקידת בדק'
  );
  const [orderNumber, setOrderNumber] = useState<string>(quote?.orderNumber || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(
    quote?.expectedDeliveryDate || ''
  );
  const [closingNotes, setClosingNotes] = useState<string>(quote?.closingNotes || '');

  // UI helpers
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);

  // Canvas for signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const getEffectiveSupplier = () => {
    if (selectedSupplierPreset === 'custom') return customSupplier.trim();
    return selectedSupplierPreset;
  };

  const selectedBuilding = state.buildings.find(b => b.id === buildingId);

  // Sync approved amount default from quote amount if empty
  useEffect(() => {
    if (!approvedAmount && quoteAmount) {
      setApprovedAmount(quoteAmount);
    }
  }, [quoteAmount]);

  // Handle signature canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [activeStepTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureImage(canvas.toDataURL('image/png'));
    }
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureImage(undefined);
  };

  // Handle quote file upload (Step 2)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isSignedDoc = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const docData: QuoteDocument = {
        name: file.name,
        url: reader.result as string,
        type: file.type.includes('pdf') ? 'pdf' : 'image',
        size: file.size,
        uploadedAt: Date.now(),
        uploadedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'User'
      };

      if (isSignedDoc) {
        setSignedQuoteFile(docData);
      } else {
        setQuoteFile(docData);
      }
    };
    reader.readAsDataURL(file);
  };

  // Construct Email Body to Supplier
  const getEmailSubject = () => {
    const supplier = getEffectiveSupplier() || 'ספק';
    const bName = selectedBuilding ? selectedBuilding.name : 'בניין';
    const plotText = selectedBuilding?.plotId ? ` (מגרש ${selectedBuilding.plotId})` : '';
    const unitText = unitNumber ? `דירה ${unitNumber}` : 'שטח ציבורי';
    return `בקשת הצעת מחיר עבור בדק ארזי הנגב - ${bName}${plotText}, ${unitText} (${supplier})`;
  };

  const getEmailBody = () => {
    const supplier = getEffectiveSupplier() || 'ספק';
    const bName = selectedBuilding ? selectedBuilding.name : 'בניין';
    const plotText = selectedBuilding?.plotId ? `מגרש ${selectedBuilding.plotId}` : '—';
    const unitText = unitNumber ? `דירה ${unitNumber}` : 'שטח ציבורי';
    return `שלום רב לצוות ${supplier},

אנו מבקשים לקבל הצעת מחיר עבור פרויקט ארזי הנגב:
• בניין: ${bName}
• מספר מגרש: ${plotText}
• דירה / אזור: ${unitText}
• פירוט הפריטים הנדרשים:
${itemDescription || 'פירוט יצורף בנפרד'}

${notes ? `הערות נוספות: ${notes}\n` : ''}
נודה לקבלת הצעת מחיר בהקדם האפשרי.

בברכה,
מחלקת בדק - ארזי הנגב
${requestedBy}`;
  };

  const handleCopyEmail = () => {
    const fullText = `נושא: ${getEmailSubject()}\n\n${getEmailBody()}`;
    navigator.clipboard.writeText(fullText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Submission handler
  const handleSubmit = async (targetStatus?: QuoteWorkflowStep) => {
    const supplier = getEffectiveSupplier();
    if (!supplier) {
      alert(lang === 'he' ? 'נא לבחור או להזין שם ספק' : 'Please choose a supplier');
      return;
    }
    if (!buildingId) {
      alert(lang === 'he' ? 'נא לבחור בניין' : 'Please select a building');
      return;
    }
    if (!itemDescription.trim()) {
      alert(lang === 'he' ? 'נא להזין תיאור פריט מבוקש' : 'Please enter item description');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const currentStep = targetStatus || quote?.status || QuoteWorkflowStep.REQUEST_SENT;

      const payload: Partial<PriceQuote> = {
        projectId: selectedProjectId,
        buildingId,
        buildingName: selectedBuilding?.name || '',
        plotId: selectedBuilding?.plotId || quote?.plotId || '',
        unitNumber: unitNumber ? (isNaN(Number(unitNumber)) ? unitNumber : Number(unitNumber)) : '',
        supplier,
        status: currentStep,
        requestDate,
        requestedBy,
        requestEmail: requestEmail.trim(),
        itemDescription: itemDescription.trim(),
        urgency,
        notes: notes.trim(),
        updatedAt: now
      };

      // Step 2 data
      if (quoteReceivedDate || quoteNumber || quoteAmount || quoteFile || receivedNotes) {
        payload.quoteReceivedDate = quoteReceivedDate;
        payload.quoteNumber = quoteNumber.trim();
        payload.quoteAmount = quoteAmount ? parseFloat(quoteAmount) : undefined;
        payload.quoteCurrency = '₪';
        if (quoteFile) payload.quoteFile = quoteFile;
        payload.receivedNotes = receivedNotes.trim();
      }

      // Step 3 data
      if (approvedDate || approvedBy || approvedAmount || signatureImage || signedQuoteFile || managerNotes) {
        payload.approvedDate = approvedDate;
        payload.approvedBy = approvedBy;
        payload.approvedAmount = approvedAmount ? parseFloat(approvedAmount) : undefined;
        if (signatureImage) payload.signatureImage = signatureImage;
        if (signedQuoteFile) payload.signedQuoteFile = signedQuoteFile;
        payload.managerNotes = managerNotes.trim();
      }

      // Step 4 data
      if (dispatchedDate || dispatchedBy || orderNumber || expectedDeliveryDate || closingNotes) {
        payload.dispatchedDate = dispatchedDate;
        payload.dispatchedBy = dispatchedBy;
        payload.orderNumber = orderNumber.trim();
        payload.expectedDeliveryDate = expectedDeliveryDate;
        payload.closingNotes = closingNotes.trim();
      }

      // Audit History entry
      const existingHistory = quote?.history || [];
      const historyEntry = {
        step: currentStep,
        timestamp: now,
        user: auth.currentUser?.displayName || auth.currentUser?.email || requestedBy,
        action:
          currentStep === QuoteWorkflowStep.REQUEST_SENT
            ? 'נשלחה בקשה לספק'
            : currentStep === QuoteWorkflowStep.PENDING_SIGNATURE
            ? 'התקבלה הצעה מהספק - ממתין לחתימה'
            : currentStep === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH
            ? 'ההצעה אושרה ונחתמה'
            : 'ההצעה נשלחה והוזמנה מהספק',
        details: itemDescription
      };

      payload.history = [...existingHistory, historyEntry];

      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Error saving price quote:', err);
      alert(lang === 'he' ? `שגיאה בשמירה: ${err.message || err}` : 'Error saving quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 md:p-6 flex justify-between items-center relative">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
                <FileText className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">
                  {isEditMode ? 'עריכת מעקב הצעת מחיר' : t.newQuoteRequest}
                </h2>
                <p className="text-xs md:text-sm text-blue-200/80 font-medium">
                  {isEditMode
                    ? `${getEffectiveSupplier()} • ${selectedBuilding?.name || ''}${selectedBuilding?.plotId ? ` (מגרש ${selectedBuilding.plotId})` : ''} • דירה ${unitNumber || 'שטח ציבורי'}`
                    : t.priceQuotesSub}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Step Interactive Pipeline Stepper Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 md:p-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[650px] gap-2">
            {/* Step 1 */}
            <button
              onClick={() => setActiveStepTab(QuoteWorkflowStep.REQUEST_SENT)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all text-right ${
                activeStepTab === QuoteWorkflowStep.REQUEST_SENT
                  ? 'bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                  : quote?.status && [QuoteWorkflowStep.PENDING_SIGNATURE, QuoteWorkflowStep.SIGNED_PENDING_DISPATCH, QuoteWorkflowStep.ORDERED_CLOSED].includes(quote.status)
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  activeStepTab === QuoteWorkflowStep.REQUEST_SENT
                    ? 'bg-blue-600 text-white'
                    : quote?.status && [QuoteWorkflowStep.PENDING_SIGNATURE, QuoteWorkflowStep.SIGNED_PENDING_DISPATCH, QuoteWorkflowStep.ORDERED_CLOSED].includes(quote.status)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {quote?.status && [QuoteWorkflowStep.PENDING_SIGNATURE, QuoteWorkflowStep.SIGNED_PENDING_DISPATCH, QuoteWorkflowStep.ORDERED_CLOSED].includes(quote.status) ? (
                  <Check className="w-5 h-5" />
                ) : (
                  '1'
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-black text-slate-800 truncate">1. פתיחת בקשה לספק</div>
                <div className="text-[11px] text-slate-500 truncate">נשלחה בקשה לספק</div>
              </div>
            </button>

            {/* Stepper Arrow */}
            <div className="text-slate-300 font-black">➔</div>

            {/* Step 2 */}
            <button
              onClick={() => setActiveStepTab(QuoteWorkflowStep.PENDING_SIGNATURE)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all text-right ${
                activeStepTab === QuoteWorkflowStep.PENDING_SIGNATURE
                  ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                  : quote?.status && [QuoteWorkflowStep.SIGNED_PENDING_DISPATCH, QuoteWorkflowStep.ORDERED_CLOSED].includes(quote.status)
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  activeStepTab === QuoteWorkflowStep.PENDING_SIGNATURE
                    ? 'bg-amber-500 text-white'
                    : quote?.status && [QuoteWorkflowStep.SIGNED_PENDING_DISPATCH, QuoteWorkflowStep.ORDERED_CLOSED].includes(quote.status)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {quote?.status && [QuoteWorkflowStep.SIGNED_PENDING_DISPATCH, QuoteWorkflowStep.ORDERED_CLOSED].includes(quote.status) ? (
                  <Check className="w-5 h-5" />
                ) : (
                  '2'
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-black text-slate-800 truncate">2. קבלת הצעה מהספק</div>
                <div className="text-[11px] text-slate-500 truncate">ממתין לחתימת ממונה</div>
              </div>
            </button>

            {/* Stepper Arrow */}
            <div className="text-slate-300 font-black">➔</div>

            {/* Step 3 */}
            <button
              onClick={() => setActiveStepTab(QuoteWorkflowStep.SIGNED_PENDING_DISPATCH)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all text-right ${
                activeStepTab === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH
                  ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                  : quote?.status === QuoteWorkflowStep.ORDERED_CLOSED
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  activeStepTab === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH
                    ? 'bg-indigo-600 text-white'
                    : quote?.status === QuoteWorkflowStep.ORDERED_CLOSED
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {quote?.status === QuoteWorkflowStep.ORDERED_CLOSED ? (
                  <Check className="w-5 h-5" />
                ) : (
                  '3'
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-black text-slate-800 truncate">3. אישור וחתימה</div>
                <div className="text-[11px] text-slate-500 truncate">נחתם - להחזיר לספק</div>
              </div>
            </button>

            {/* Stepper Arrow */}
            <div className="text-slate-300 font-black">➔</div>

            {/* Step 4 */}
            <button
              onClick={() => setActiveStepTab(QuoteWorkflowStep.ORDERED_CLOSED)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all text-right ${
                activeStepTab === QuoteWorkflowStep.ORDERED_CLOSED
                  ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                  : quote?.status === QuoteWorkflowStep.ORDERED_CLOSED
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/70'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  quote?.status === QuoteWorkflowStep.ORDERED_CLOSED || activeStepTab === QuoteWorkflowStep.ORDERED_CLOSED
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {quote?.status === QuoteWorkflowStep.ORDERED_CLOSED ? (
                  <PackageCheck className="w-5 h-5" />
                ) : (
                  '4'
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-black text-slate-800 truncate">4. סגירה והזמנה</div>
                <div className="text-[11px] text-slate-500 truncate">הוזמן / נסגר</div>
              </div>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: REQUEST INITIATED (פקידה יוזמת בקשה) */}
          {activeStepTab === QuoteWorkflowStep.REQUEST_SENT && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/60 flex items-start gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl mt-0.5">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-blue-900">שלב 1: פתיחת בקשה והוצאת מייל לספק</h3>
                  <p className="text-xs text-blue-800/80 leading-relaxed mt-0.5">
                    הפקידה שולחת פנייה לספק לקבלת הצעת מחיר עבור הדירה/בניין. כאן מזינים את כל פרטי הפנייה
                    כדי להבטיח מעקב ולא לאבד את הבקשה.
                  </p>
                </div>
              </div>

              {/* Location Grid: Building, Plot, Apartment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Building */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    בניין <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={buildingId}
                    onChange={e => setBuildingId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    {state.buildings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.plotId ? `(מגרש ${b.plotId})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plot Number (מגרש) */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    מספר מגרש
                  </label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-indigo-950 flex items-center justify-between min-h-[42px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      {selectedBuilding?.plotId ? `מגרש ${selectedBuilding.plotId}` : '—'}
                    </span>
                    {selectedBuilding?.plotId && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                        משויך לבניין
                      </span>
                    )}
                  </div>
                </div>

                {/* Apartment Number */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    מספר דירה (או שטח ציבורי)
                  </label>
                  <input
                    type="text"
                    placeholder="לדוגמה: 12 או לובי / חניון"
                    value={unitNumber}
                    onChange={e => setUnitNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Supplier Selection Pills */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">
                  בחירת ספק <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {SUPPLIER_LIST.map(sup => (
                    <button
                      key={sup}
                      type="button"
                      onClick={() => {
                        setSelectedSupplierPreset(sup);
                        setCustomSupplier('');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${
                        selectedSupplierPreset === sup
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sup}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierPreset('custom')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${
                      selectedSupplierPreset === 'custom'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    + ספק אחר...
                  </button>
                </div>

                {selectedSupplierPreset === 'custom' && (
                  <input
                    type="text"
                    placeholder="הזן שם ספק מותאם אישית..."
                    value={customSupplier}
                    onChange={e => setCustomSupplier(e.target.value)}
                    className="w-full bg-slate-50 border border-blue-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    autoFocus
                  />
                )}
              </div>

              {/* Dates & Coordinator */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    תאריך שליחת הבקשה
                  </label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={e => setRequestDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    שם הפקידה / היוזמת
                  </label>
                  <input
                    type="text"
                    value={requestedBy}
                    onChange={e => setRequestedBy(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    דחיפות
                  </label>
                  <select
                    value={urgency}
                    onChange={e => setUrgency(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="normal">רגיל</option>
                    <option value="urgent">דחוף ⚡</option>
                    <option value="immediate">מיידי / קריטי 🚨</option>
                  </select>
                </div>
              </div>

              {/* Item Description */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  פירוט הפריט / מה נדרש בדירה <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="לדוגמה: החלפת דלת כניסה רב-בריח דגם 101, אספקת 8 אריחי גרניט פורצלן 60/60 מבריק, התקנת שיש קיסר דגם 5141..."
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              {/* General Notes */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  הערות כלליות / מידע נוסף
                </label>
                <input
                  type="text"
                  placeholder="לדוגמה: דייר ביקש לזרז, יש לתאם מדידה לפני הזמנה..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Email Generator Helper Box */}
              <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                    <Mail className="w-4 h-4 text-blue-600" />
                    ניסוח מייל מהיר לספק
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailDraft(!showEmailDraft)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold underline"
                    >
                      {showEmailDraft ? 'הסתר נוסח' : 'הצג נוסח מייל'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3 py-1 rounded-lg text-xs font-black transition-all shadow-sm"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopied ? 'הועתק!' : 'העתק מייל'}
                    </button>
                  </div>
                </div>

                {showEmailDraft && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                    <strong>נושא:</strong> {getEmailSubject()}
                    <br /><br />
                    {getEmailBody()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: QUOTE RECEIVED (קבלת הצעת מחיר מהספק) */}
          {activeStepTab === QuoteWorkflowStep.PENDING_SIGNATURE && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-950">שלב 2: קבלת הצעת מחיר מהספק</h3>
                  <p className="text-xs text-amber-900/80 leading-relaxed mt-0.5">
                    הספק שלח חזרה את הצעת המחיר במייל. מעלים כאן את קובץ ההצעה ומזינים את מספר ההצעה והסכום.
                    הסטטוס יעבור אוטומטית ל-<strong>"ממתין לחתימת ממונה"</strong>.
                  </p>
                </div>
              </div>

              {/* Quote details: Date, Number, Amount */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    תאריך קבלת ההצעה
                  </label>
                  <input
                    type="date"
                    value={quoteReceivedDate}
                    onChange={e => setQuoteReceivedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    מספר הצעת מחיר מהספק
                  </label>
                  <input
                    type="text"
                    placeholder="לדוגמה: QUOTE-9842"
                    value={quoteNumber}
                    onChange={e => setQuoteNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    סכום ההצעה (₪)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={quoteAmount}
                    onChange={e => setQuoteAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Upload Quote Document */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-2">
                  קובץ הצעת מחיר שנתקבלה מהספק (PDF / תמונה)
                </label>

                {quoteFile ? (
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-300 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800">{quoteFile.name}</div>
                        <div className="text-xs text-slate-500">
                          הועלה ע"י {quoteFile.uploadedBy || 'משתמש'} • {new Date(quoteFile.uploadedAt).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {quoteFile.url && (
                        <a
                          href={quoteFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-black transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          צפה בקובץ
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setQuoteFile(undefined)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="הסר קובץ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all">
                    <Upload className="w-8 h-8 text-amber-600 mb-2" />
                    <span className="text-sm font-black text-slate-800">לחץ להעלאת קובץ הצעת מחיר או גרור לכאן</span>
                    <span className="text-xs text-slate-500 mt-1">תומך בקבצי PDF, תמונות JPG / PNG</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={e => handleFileUpload(e, false)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Received Notes */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  הערות לקבלת ההצעה (אופציונלי)
                </label>
                <input
                  type="text"
                  placeholder="לדוגמה: כולל התקנה, אספקה תוך 14 ימי עסקים..."
                  value={receivedNotes}
                  onChange={e => setReceivedNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: APPROVAL & SIGNATURE (אישור וחתימת ממונה) */}
          {activeStepTab === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/80 flex items-start gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl mt-0.5">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-indigo-950">שלב 3: אישור וחתימת ממונה / מנהל</h3>
                  <p className="text-xs text-indigo-900/80 leading-relaxed mt-0.5">
                    הממונה בודק את הצעת המחיר, מאשר את התקציב וחותם דיגיטלית ישירות על המסך (או מעלה קובץ חתום).
                    הסטטוס יעבור ל-<strong>"נחתם - דורש שליחה לספק"</strong>.
                  </p>
                </div>
              </div>

              {/* Manager info & Approved amount */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    תאריך אישור
                  </label>
                  <input
                    type="date"
                    value={approvedDate}
                    onChange={e => setApprovedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    שם הממונה / מנהל מאשר
                  </label>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={e => setApprovedBy(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    סכום שאושר לתשלום (₪)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={approvedAmount}
                    onChange={e => setApprovedAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Digital Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                    חתימה דיגיטלית של הממונה
                  </label>
                  {signatureImage && (
                    <button
                      type="button"
                      onClick={clearSignatureCanvas}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      נקה וחתום מחדש
                    </button>
                  )}
                </div>

                {signatureImage ? (
                  <div className="p-3 bg-white border border-indigo-200 rounded-2xl flex flex-col items-center justify-center">
                    <img src={signatureImage} alt="חתימת ממונה" className="max-h-24 object-contain" />
                    <span className="text-xs text-emerald-700 font-bold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      חתימה נשמרה בהצלחה
                    </span>
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={120}
                      className="w-full h-28 cursor-crosshair touch-none bg-slate-50/50"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="bg-slate-100/70 p-2 text-center text-[11px] font-bold text-slate-500 border-t border-slate-200">
                      חתום באמצעות העכבר או האצבע במכשיר מגע
                    </div>
                  </div>
                )}
              </div>

              {/* Signed PDF File Upload (Alternative / Extra) */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  או העלה מסמך הצעת מחיר חתום (PDF / תמונה)
                </label>
                {signedQuoteFile ? (
                  <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-700" />
                      <span className="text-xs font-black text-indigo-900">{signedQuoteFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignedQuoteFile(undefined)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 p-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">בחר קובץ חתום להעלאה...</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={e => handleFileUpload(e, true)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Manager Approval Notes */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  הערות ממונה / קוד תקציבי
                </label>
                <input
                  type="text"
                  placeholder="לדוגמה: מאושר לביצוע עפ״י סעיף תקציב בדק 402..."
                  value={managerNotes}
                  onChange={e => setManagerNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 4: FINAL DISPATCH & CLOSING (פקידה שולחת חתום ומזמינה) */}
          {activeStepTab === QuoteWorkflowStep.ORDERED_CLOSED && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 flex items-start gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl mt-0.5">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-950">שלב 4: סגירה והזמנה מהספק</h3>
                  <p className="text-xs text-emerald-900/80 leading-relaxed mt-0.5">
                    הפקידה שולחת את ההצעה החתומה בחזרה במייל לספק, מקבלת אישור הזמנה ומסמנת במערכת{' '}
                    <strong>"הוזמן / נסגר"</strong>.
                  </p>
                </div>
              </div>

              {/* Dispatch & Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    תאריך שליחת ההזמנה לספק
                  </label>
                  <input
                    type="date"
                    value={dispatchedDate}
                    onChange={e => setDispatchedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    שם הפקידה המזמינה
                  </label>
                  <input
                    type="text"
                    value={dispatchedBy}
                    onChange={e => setDispatchedBy(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    מספר הזמנה / אישור ספק (PO)
                  </label>
                  <input
                    type="text"
                    placeholder="לדוגמה: ORD-2026-881"
                    value={orderNumber}
                    onChange={e => setOrderNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Delivery Date & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    תאריך אספקה / התקנה משוער
                  </label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={e => setExpectedDeliveryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    הערות סיום / מעקב אספקה
                  </label>
                  <input
                    type="text"
                    placeholder="לדוגמה: אספקה מתוכננת לאתר, יתואם ישירות מול מנהל עבודה..."
                    value={closingNotes}
                    onChange={e => setClosingNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Order summary box */}
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-emerald-950">התהליך הושלם בהצלחה!</div>
                    <div className="text-xs text-emerald-800">
                      ספק: {getEffectiveSupplier()} • סכום שאושר: ₪{approvedAmount || quoteAmount || '0'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audit Trail Timeline (if editing existing quote) */}
          {quote?.history && quote.history.length > 0 && (
            <div className="border-t border-slate-200 pt-4 mt-6">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
                היסטוריית עדכונים ושלבים
              </h4>
              <div className="space-y-2">
                {quote.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="font-black text-slate-800">{h.action}</span>
                      <span className="text-slate-500">({h.user})</span>
                    </div>
                    <div className="text-slate-400 font-mono">
                      {new Date(h.timestamp).toLocaleString('he-IL')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 md:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isEditMode && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(lang === 'he' ? 'האם למחוק מעקב הצעת מחיר זו?' : 'Delete this quote?')) {
                    onDelete(quote.id);
                    onClose();
                  }
                }}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-rose-200"
              >
                <Trash2 className="w-4 h-4" />
                מחק
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-300"
            >
              ביטול
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Step Advance Buttons */}
            {activeStepTab === QuoteWorkflowStep.REQUEST_SENT && (
              <button
                type="button"
                onClick={() => handleSubmit(QuoteWorkflowStep.REQUEST_SENT)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
              >
                {isSubmitting ? 'שומר...' : 'שמור כ- נשלחה בקשה לספק (שלב 1)'}
              </button>
            )}

            {activeStepTab === QuoteWorkflowStep.PENDING_SIGNATURE && (
              <button
                type="button"
                onClick={() => handleSubmit(QuoteWorkflowStep.PENDING_SIGNATURE)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
              >
                {isSubmitting ? 'שומר...' : 'עדכן כ- ממתין לחתימת ממונה (שלב 2)'}
              </button>
            )}

            {activeStepTab === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH && (
              <button
                type="button"
                onClick={() => handleSubmit(QuoteWorkflowStep.SIGNED_PENDING_DISPATCH)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
              >
                {isSubmitting ? 'שומר...' : 'אשר וחתום - להחזיר לספק (שלב 3)'}
              </button>
            )}

            {activeStepTab === QuoteWorkflowStep.ORDERED_CLOSED && (
              <button
                type="button"
                onClick={() => handleSubmit(QuoteWorkflowStep.ORDERED_CLOSED)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-2"
              >
                {isSubmitting ? 'שומר...' : 'סמן כ- הוזמן / נסגר (שלב 4)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
