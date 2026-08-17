import React, { useState, useMemo } from 'react';
import { PriceQuote, QuoteWorkflowStep, ProjectState } from '../types';
import { Language, translations } from '../translations';
import { PriceQuoteModal, SUPPLIER_LIST } from './PriceQuoteModal';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  Send,
  PenTool,
  PackageCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  AlertTriangle,
  Download,
  Trash2,
  Edit3,
  FileCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface Props {
  quotes: PriceQuote[];
  state: ProjectState;
  selectedProjectId: string;
  lang: Language;
  userRole: 'admin' | 'contractor' | 'viewer';
  onSaveQuote: (quoteData: Partial<PriceQuote>, quoteId?: string) => Promise<void>;
  onDeleteQuote: (quoteId: string) => Promise<void>;
}

export const PriceQuotesView: React.FC<Props> = ({
  quotes,
  state,
  selectedProjectId,
  lang,
  userRole,
  onSaveQuote,
  onDeleteQuote
}) => {
  const t = translations[lang] as any;

  // Filters & State
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<QuoteWorkflowStep | 'all'>('all');
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<PriceQuote | null>(null);

  // Quick action modal trigger (e.g. advance step directly)
  const handleOpenNewQuote = () => {
    setEditingQuote(null);
    setIsModalOpen(true);
  };

  const handleEditQuote = (quote: PriceQuote) => {
    setEditingQuote(quote);
    setIsModalOpen(true);
  };

  // Extract all distinct suppliers including any custom ones
  const allSuppliers = useMemo(() => {
    const set = new Set<string>(SUPPLIER_LIST);
    quotes.forEach(q => {
      if (q.supplier) set.add(q.supplier);
    });
    return Array.from(set);
  }, [quotes]);

  // Filtered Quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      // Project filter
      if (q.projectId && q.projectId !== selectedProjectId) return false;

      // Supplier filter
      if (selectedSupplierFilter !== 'all' && q.supplier !== selectedSupplierFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all' && q.status !== selectedStatusFilter) {
        return false;
      }

      // Building filter
      if (selectedBuildingFilter !== 'all' && q.buildingId !== selectedBuildingFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const b = state.buildings.find(b => b.id === q.buildingId);
        const bName = b ? b.name.toLowerCase() : '';
        const plotStr = (b ? b.plotId : q.plotId || '').toLowerCase();
        const supplierMatch = (q.supplier || '').toLowerCase().includes(query);
        const descMatch = (q.itemDescription || '').toLowerCase().includes(query);
        const unitMatch = String(q.unitNumber || '').toLowerCase().includes(query);
        const quoteNumMatch = (q.quoteNumber || '').toLowerCase().includes(query);
        const orderNumMatch = (q.orderNumber || '').toLowerCase().includes(query);
        const requestedByMatch = (q.requestedBy || '').toLowerCase().includes(query);

        if (
          !supplierMatch &&
          !descMatch &&
          !unitMatch &&
          !bName.includes(query) &&
          !plotStr.includes(query) &&
          !quoteNumMatch &&
          !orderNumMatch &&
          !requestedByMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [quotes, selectedProjectId, selectedSupplierFilter, selectedStatusFilter, selectedBuildingFilter, searchQuery, state.buildings]);

  // Status Counts
  const counts = useMemo(() => {
    const total = quotes.filter(q => !q.projectId || q.projectId === selectedProjectId).length;
    const step1 = quotes.filter(q => (!q.projectId || q.projectId === selectedProjectId) && q.status === QuoteWorkflowStep.REQUEST_SENT).length;
    const step2 = quotes.filter(q => (!q.projectId || q.projectId === selectedProjectId) && q.status === QuoteWorkflowStep.PENDING_SIGNATURE).length;
    const step3 = quotes.filter(q => (!q.projectId || q.projectId === selectedProjectId) && q.status === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH).length;
    const step4 = quotes.filter(q => (!q.projectId || q.projectId === selectedProjectId) && q.status === QuoteWorkflowStep.ORDERED_CLOSED).length;

    // Sum of completed approved amount
    const totalOrderedAmount = quotes
      .filter(q => (!q.projectId || q.projectId === selectedProjectId) && q.status === QuoteWorkflowStep.ORDERED_CLOSED)
      .reduce((sum, q) => sum + (q.approvedAmount || q.quoteAmount || 0), 0);

    return { total, step1, step2, step3, step4, totalOrderedAmount };
  }, [quotes, selectedProjectId]);

  // Workflow Step Configurations
  const STEPS_CONFIG = [
    {
      step: QuoteWorkflowStep.REQUEST_SENT,
      title: '1. נשלחה בקשה לספק',
      subtitle: 'פתיחת בקשה ומעקב',
      color: 'blue',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      headerBg: 'bg-blue-600',
      borderClass: 'border-blue-300',
      icon: Send,
      count: counts.step1
    },
    {
      step: QuoteWorkflowStep.PENDING_SIGNATURE,
      title: '2. קבלת הצעה מספק',
      subtitle: 'ממתין לחתימת ממונה',
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      headerBg: 'bg-amber-500',
      borderClass: 'border-amber-300',
      icon: FileText,
      count: counts.step2
    },
    {
      step: QuoteWorkflowStep.SIGNED_PENDING_DISPATCH,
      title: '3. אישור וחתימה',
      subtitle: 'נחתם - להחזיר לספק',
      color: 'indigo',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      headerBg: 'bg-indigo-600',
      borderClass: 'border-indigo-300',
      icon: PenTool,
      count: counts.step3
    },
    {
      step: QuoteWorkflowStep.ORDERED_CLOSED,
      title: '4. סגירה והזמנה',
      subtitle: 'הוזמן / נסגר מספק',
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      headerBg: 'bg-emerald-600',
      borderClass: 'border-emerald-300',
      icon: PackageCheck,
      count: counts.step4
    }
  ];

  // Quick 1-click status advance
  const handleQuickAdvance = async (e: React.MouseEvent, quote: PriceQuote) => {
    e.stopPropagation();
    let nextStep = QuoteWorkflowStep.REQUEST_SENT;
    if (quote.status === QuoteWorkflowStep.REQUEST_SENT) {
      nextStep = QuoteWorkflowStep.PENDING_SIGNATURE;
    } else if (quote.status === QuoteWorkflowStep.PENDING_SIGNATURE) {
      nextStep = QuoteWorkflowStep.SIGNED_PENDING_DISPATCH;
    } else if (quote.status === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH) {
      nextStep = QuoteWorkflowStep.ORDERED_CLOSED;
    } else {
      return;
    }

    // Open modal to ensure required details are filled or directly update
    setEditingQuote(quote);
    setIsModalOpen(true);
  };

  // Export to CSV summary
  const handleExportCSV = () => {
    if (filteredQuotes.length === 0) return;

    const headers = [
      'מספר מזהה',
      'בניין',
      'מספר מגרש',
      'דירה',
      'ספק',
      'סטטוס',
      'תיאור פריט',
      'תאריך בקשה',
      'יוזמת',
      'מספר הצעה',
      'סכום הצעה (₪)',
      'אושר ע"י',
      'סכום שאושר (₪)',
      'מספר הזמנה',
      'תאריך הזמנה'
    ];

    const rows = filteredQuotes.map(q => {
      const b = state.buildings.find(b => b.id === q.buildingId);
      const statusText =
        q.status === QuoteWorkflowStep.REQUEST_SENT
          ? 'נשלחה בקשה לספק'
          : q.status === QuoteWorkflowStep.PENDING_SIGNATURE
          ? 'ממתין לחתימת ממונה'
          : q.status === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH
          ? 'נחתם - דורש שליחה לספק'
          : 'הוזמן / נסגר';

      return [
        q.id,
        b ? b.name : q.buildingName || q.buildingId,
        b ? b.plotId : q.plotId || '',
        q.unitNumber || 'שטח ציבורי',
        q.supplier,
        statusText,
        `"${(q.itemDescription || '').replace(/"/g, '""')}"`,
        q.requestDate || '',
        q.requestedBy || '',
        q.quoteNumber || '',
        q.quoteAmount || '',
        q.approvedBy || '',
        q.approvedAmount || '',
        q.orderNumber || '',
        q.dispatchedDate || ''
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `הצעות_מחיר_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-gradient-to-l from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
              <FileText className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{t.priceQuotesTitle}</h1>
          </div>
          <p className="text-xs md:text-sm text-blue-200/80 font-medium max-w-2xl">
            {t.priceQuotesSub}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 backdrop-blur-md transition-all"
          >
            <Download className="w-4 h-4" />
            ייצוא לאקסל (CSV)
          </button>

          <button
            onClick={handleOpenNewQuote}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-4 h-4" />
            {t.newQuoteRequest}
          </button>
        </div>
      </div>

      {/* 5 Top Pipeline Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Total Quotes Card */}
        <button
          onClick={() => setSelectedStatusFilter('all')}
          className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between ${
            selectedStatusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-800'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black opacity-80">סה"כ הצעות מחיר</span>
            <FileCheck className="w-4 h-4 opacity-70" />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black">{counts.total}</div>
            <div className="text-[11px] opacity-70 mt-0.5">כל הסטטוסים בפרויקט</div>
          </div>
        </button>

        {/* Step 1 Card: Request Sent */}
        <button
          onClick={() => setSelectedStatusFilter(QuoteWorkflowStep.REQUEST_SENT)}
          className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between ${
            selectedStatusFilter === QuoteWorkflowStep.REQUEST_SENT
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500'
              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-blue-600">1. נשלחה בקשה</span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-blue-700">{counts.step1}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">ממתין להצעת ספק</div>
          </div>
        </button>

        {/* Step 2 Card: Quote Received (Pending Manager) */}
        <button
          onClick={() => setSelectedStatusFilter(QuoteWorkflowStep.PENDING_SIGNATURE)}
          className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between relative overflow-hidden ${
            selectedStatusFilter === QuoteWorkflowStep.PENDING_SIGNATURE
              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400'
              : 'bg-white text-slate-800 border-slate-200 hover:border-amber-200 hover:shadow-sm'
          }`}
        >
          {counts.step2 > 0 && selectedStatusFilter !== QuoteWorkflowStep.PENDING_SIGNATURE && (
            <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-700">2. ממתין לחתימה</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-amber-600">{counts.step2}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">דורש אישור ממונה</div>
          </div>
        </button>

        {/* Step 3 Card: Signed (Pending Dispatch) */}
        <button
          onClick={() => setSelectedStatusFilter(QuoteWorkflowStep.SIGNED_PENDING_DISPATCH)}
          className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between relative overflow-hidden ${
            selectedStatusFilter === QuoteWorkflowStep.SIGNED_PENDING_DISPATCH
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500'
              : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-200 hover:shadow-sm'
          }`}
        >
          {counts.step3 > 0 && selectedStatusFilter !== QuoteWorkflowStep.SIGNED_PENDING_DISPATCH && (
            <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-700">3. נחתם - לשלוח</span>
            <PenTool className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-indigo-600">{counts.step3}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">דורש שליחה לספק</div>
          </div>
        </button>

        {/* Step 4 Card: Completed / Ordered */}
        <button
          onClick={() => setSelectedStatusFilter(QuoteWorkflowStep.ORDERED_CLOSED)}
          className={`p-4 rounded-2xl border transition-all text-right flex flex-col justify-between col-span-2 sm:col-span-1 ${
            selectedStatusFilter === QuoteWorkflowStep.ORDERED_CLOSED
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500'
              : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-700">4. הוזמן / נסגר</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-black text-emerald-600">{counts.step4}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {counts.totalOrderedAmount > 0 ? `סה"כ ₪${counts.totalOrderedAmount.toLocaleString()}` : 'הושלמו בהצלחה'}
            </div>
          </div>
        </button>
      </div>

      {/* Supplier Filter Horizontal Pills */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-black text-slate-500 shrink-0 px-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            ספק:
          </span>

          {/* All Suppliers Pill */}
          <button
            onClick={() => setSelectedSupplierFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
              selectedSupplierFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            הכל ({counts.total})
          </button>

          {/* Preset & Custom Suppliers */}
          {allSuppliers.map(sup => {
            const count = quotes.filter(
              q => (!q.projectId || q.projectId === selectedProjectId) && q.supplier === sup
            ).length;

            return (
              <button
                key={sup}
                onClick={() => setSelectedSupplierFilter(sup)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedSupplierFilter === sup
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{sup}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    selectedSupplierFilter === sup ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary Search & View Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Search & Building Filter */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.filterQuotesPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Building Selector */}
          <select
            value={selectedBuildingFilter}
            onChange={e => setSelectedBuildingFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">כל הבניינים</option>
            {state.buildings.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} {b.plotId ? `(מגרש ${b.plotId})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* View Switcher: Kanban vs Table */}
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-300/30 self-end md:self-auto">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {t.pipelineView}
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            {t.listView}
          </button>
        </div>
      </div>

      {/* KANBAN PIPELINE VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {STEPS_CONFIG.map(col => {
            const colQuotes = filteredQuotes.filter(q => q.status === col.step);
            const Icon = col.icon;

            return (
              <div
                key={col.step}
                className="bg-slate-100/70 rounded-3xl p-3.5 border border-slate-200/80 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${col.badgeClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900">{col.title}</h3>
                      <p className="text-[10px] text-slate-500 font-medium">{col.subtitle}</p>
                    </div>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-white shadow-sm border border-slate-200 text-xs font-black flex items-center justify-center text-slate-700">
                    {colQuotes.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                  {colQuotes.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs font-bold text-slate-400 my-auto">
                      אין פריטים בשלב זה
                    </div>
                  ) : (
                    colQuotes.map(quote => {
                      const building = state.buildings.find(b => b.id === quote.buildingId);
                      const bDisplay = building 
                        ? `${building.name}${building.plotId ? ` (מגרש ${building.plotId})` : ''}`
                        : (quote.buildingName ? `${quote.buildingName}${quote.plotId ? ` (מגרש ${quote.plotId})` : ''}` : 'בניין');

                      return (
                        <div
                          key={quote.id}
                          onClick={() => handleEditQuote(quote)}
                          className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-slate-200 hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between gap-3 relative"
                        >
                          {/* Top Badges: Supplier + Building / Apartment */}
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-black truncate max-w-[130px]">
                                {quote.supplier}
                              </span>
                              <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 truncate max-w-[180px]" title={`${bDisplay} ${quote.unitNumber ? `דירה ${quote.unitNumber}` : 'ציבורי'}`}>
                                {bDisplay}{' '}
                                {quote.unitNumber ? `דירה ${quote.unitNumber}` : 'ציבורי'}
                              </span>
                            </div>

                            {/* Item Description */}
                            <h4 className="text-xs font-black text-slate-800 line-clamp-2 leading-snug">
                              {quote.itemDescription}
                            </h4>

                            {/* Urgency Tag if Urgent */}
                            {quote.urgency && quote.urgency !== 'normal' && (
                              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                {quote.urgency === 'urgent' ? 'דחוף ⚡' : 'מיידי 🚨'}
                              </div>
                            )}
                          </div>

                          {/* Middle Details: Quote Number, Amount, Attached File */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                            {quote.quoteAmount !== undefined && (
                              <div className="flex items-center justify-between font-black text-slate-900 bg-slate-50 p-1.5 rounded-lg">
                                <span>סכום הצעה:</span>
                                <span className="text-emerald-700">₪{quote.quoteAmount.toLocaleString()}</span>
                              </div>
                            )}

                            {quote.quoteNumber && (
                              <div className="flex items-center justify-between text-slate-500">
                                <span>מס' הצעה:</span>
                                <span className="font-mono font-bold text-slate-700">{quote.quoteNumber}</span>
                              </div>
                            )}

                            {quote.quoteFile && (
                              <div className="flex items-center gap-1 text-blue-600 font-bold">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[150px]">מצורף קובץ הצעה</span>
                              </div>
                            )}

                            {quote.signatureImage && (
                              <div className="flex items-center gap-1 text-indigo-600 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>נחתם דיגיטלית ע"י {quote.approvedBy || 'ממונה'}</span>
                              </div>
                            )}

                            {quote.orderNumber && (
                              <div className="flex items-center justify-between text-emerald-700 font-bold">
                                <span>מס' הזמנה:</span>
                                <span className="font-mono">{quote.orderNumber}</span>
                              </div>
                            )}
                          </div>

                          {/* Footer: Date & Quick Action */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {quote.requestDate || new Date(quote.createdAt).toLocaleDateString('he-IL')}
                            </span>

                            {/* Quick Next Step Trigger */}
                            {col.step !== QuoteWorkflowStep.ORDERED_CLOSED && (
                              <button
                                onClick={e => handleQuickAdvance(e, quote)}
                                className="text-[11px] font-black text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <span>
                                  {col.step === QuoteWorkflowStep.REQUEST_SENT
                                    ? 'העלה הצעה 📄'
                                    : col.step === QuoteWorkflowStep.PENDING_SIGNATURE
                                    ? 'חתום ✍️'
                                    : 'הזמן 🚀'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RICH TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-black border-b border-slate-200">
                <tr>
                  <th className="p-4">סטטוס תהליך</th>
                  <th className="p-4">ספק</th>
                  <th className="p-4">בניין / מגרש / דירה</th>
                  <th className="p-4">תיאור הפריט</th>
                  <th className="p-4">תאריך פנייה</th>
                  <th className="p-4">סכום הצעה (₪)</th>
                  <th className="p-4">קבצים וחתימה</th>
                  <th className="p-4 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-bold text-sm">
                      {t.noQuotesFound}
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map(quote => {
                    const building = state.buildings.find(b => b.id === quote.buildingId);
                    const bDisplay = building 
                      ? `${building.name}${building.plotId ? ` (מגרש ${building.plotId})` : ''}`
                      : (quote.buildingName ? `${quote.buildingName}${quote.plotId ? ` (מגרש ${quote.plotId})` : ''}` : 'בניין');

                    const stepConfig = STEPS_CONFIG.find(s => s.step === quote.status);

                    return (
                      <tr
                        key={quote.id}
                        onClick={() => handleEditQuote(quote)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* Status Badge */}
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs border ${
                              stepConfig?.badgeClass || 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-current"></span>
                            {stepConfig?.title || quote.status}
                          </span>
                        </td>

                        {/* Supplier */}
                        <td className="p-4">
                          <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {quote.supplier}
                          </span>
                        </td>

                        {/* Building, Plot & Apartment */}
                        <td className="p-4 font-black text-slate-900">
                          {bDisplay} •{' '}
                          <span className="text-blue-700 font-black">
                            {quote.unitNumber ? `דירה ${quote.unitNumber}` : 'שטח ציבורי'}
                          </span>
                        </td>

                        {/* Item Description */}
                        <td className="p-4 max-w-xs truncate font-bold text-slate-800">
                          {quote.itemDescription}
                        </td>

                        {/* Request Date */}
                        <td className="p-4 text-slate-500 font-mono">
                          {quote.requestDate || new Date(quote.createdAt).toLocaleDateString('he-IL')}
                        </td>

                        {/* Amount */}
                        <td className="p-4 font-black text-slate-900">
                          {quote.approvedAmount !== undefined
                            ? `₪${quote.approvedAmount.toLocaleString()}`
                            : quote.quoteAmount !== undefined
                            ? `₪${quote.quoteAmount.toLocaleString()}`
                            : '—'}
                        </td>

                        {/* Attachments & Signature */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {quote.quoteFile && (
                              <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg" title="קובץ הצעה">
                                <FileText className="w-4 h-4" />
                              </span>
                            )}
                            {quote.signatureImage && (
                              <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg" title="חתימה דיגיטלית">
                                <PenTool className="w-4 h-4" />
                              </span>
                            )}
                            {quote.orderNumber && (
                              <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg" title={`מס' הזמנה: ${quote.orderNumber}`}>
                                <PackageCheck className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleEditQuote(quote);
                            }}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors font-bold"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quote Create/Edit Modal */}
      {isModalOpen && (
        <PriceQuoteModal
          quote={editingQuote}
          state={state}
          selectedProjectId={selectedProjectId}
          lang={lang}
          userRole={userRole}
          onClose={() => {
            setIsModalOpen(false);
            setEditingQuote(null);
          }}
          onSave={async quoteData => {
            await onSaveQuote(quoteData, editingQuote?.id);
          }}
          onDelete={
            editingQuote
              ? async quoteId => {
                  await onDeleteQuote(quoteId);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
