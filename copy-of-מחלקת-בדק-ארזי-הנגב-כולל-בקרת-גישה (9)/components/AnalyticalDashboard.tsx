import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  AreaChart, 
  Area 
} from 'recharts';
import { ProjectState, TaskStatus, Discipline, Unit, TaskLog } from '../types';
import { STATUS_CONFIG, CONTRACTORS } from '../constants';
import { Language, translations } from '../translations';
import { AlertTriangle, CheckCircle, Clock, CheckSquare, Layers, TrendingUp, Wrench } from 'lucide-react';

interface AnalyticalDashboardProps {
  state: ProjectState;
  lang: Language;
  selectedPlotId: string | null;
  discipline: Discipline;
  statusFilter: TaskStatus | 'OVERDUE' | null;
  onStatusClick: (status: TaskStatus | 'OVERDUE' | null) => void;
  contractorFilter: string | null;
  onContractorClick: (cId: string | null) => void;
}

export const AnalyticalDashboard: React.FC<AnalyticalDashboardProps> = ({
  state,
  lang,
  selectedPlotId,
  discipline,
  statusFilter,
  onStatusClick,
  contractorFilter,
  onContractorClick
}) => {
  const t = translations[lang];
  const isRtl = lang === 'he' || lang === 'ar';

  // 1. Interactive state for Trend Chart Tab
  const [trendTab, setTrendTab] = useState<'total' | 'opened' | 'closed'>('total');

  // 2. Extract and Process Data based on Active Filters (Plot, Building, Discipline)
  const dashboardData = useMemo(() => {
    // Filter buildings by plot
    const targetBuildings = selectedPlotId 
      ? state.buildings.filter(b => b.plotId === selectedPlotId)
      : state.buildings;
    
    const buildingIds = new Set(targetBuildings.map(b => b.id));

    // Get units in target buildings
    const targetUnits = (Object.values(state.units) as Unit[]).filter(unit => 
      buildingIds.has(unit.buildingId)
    );

    // List of all active task states for each unit
    const activeTasks: { 
      unitId: string;
      buildingId: string;
      discipline: string;
      status: TaskStatus;
      timestamp: number;
      log: TaskLog;
    }[] = [];

    targetUnits.forEach(unit => {
      if (!unit.history || unit.history.length === 0) return;

      const latestLogs = new Map<string, TaskLog>();
      const logs = (discipline === 'general' || discipline === 'all')
        ? unit.history
        : unit.history.filter(h => h.discipline === discipline);

      logs.forEach(log => {
        const key = log.contractorId || log.discipline || 'unknown';
        if (!latestLogs.has(key)) {
          latestLogs.set(key, log);
        }
      });

      latestLogs.forEach((log) => {
        activeTasks.push({
          unitId: unit.id,
          buildingId: unit.buildingId,
          discipline: log.discipline,
          status: log.status,
          timestamp: log.timestamp,
          log
        });
      });
    });

    // Stats calculations
    const stats = {
      total: activeTasks.length,
      notStarted: activeTasks.filter(t => t.status === TaskStatus.NOT_STARTED).length,
      inProgress: activeTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      done: activeTasks.filter(t => t.status === TaskStatus.DONE).length,
      needsFollowup: activeTasks.filter(t => t.status === TaskStatus.NEEDS_FOLLOWUP).length,
      blocked: activeTasks.filter(t => t.status === TaskStatus.BLOCKED).length,
      coordinationRequired: activeTasks.filter(t => t.status === TaskStatus.COORDINATION_REQUIRED).length,
    };

    // "Defect" / "Issue" is defined as any reported task that is not in "NOT_STARTED" status
    const defects = activeTasks.filter(t => t.status !== TaskStatus.NOT_STARTED);
    const totalDefects = defects.length;
    const openDefects = defects.filter(t => t.status !== TaskStatus.DONE);
    const closedDefects = defects.filter(t => t.status === TaskStatus.DONE);

    // Critical defects: Labeled as high priority (BLOCKED is red/blocked, which represents critical issues)
    const criticalDefectsCount = defects.filter(t => t.status === TaskStatus.BLOCKED).length;

    // Overdue calculation (not completed and creation/log timestamp is more than 7 days ago)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const overdueDefectsCount = openDefects.filter(t => t.timestamp < sevenDaysAgo).length;

    // Closure rate calculation (closed this week / total closed)
    // For visual depth, let's calculate actual closed within the last 7 days vs previous period
    const closedThisWeekCount = closedDefects.filter(t => t.timestamp >= sevenDaysAgo).length;

    // Project Status Rating
    // If we have critical or overdue issues, it's "דורש תשומת לב" (requires attention), otherwise "תקין" (good)
    const requiresAttention = criticalDefectsCount > 0 || overdueDefectsCount > 0 || openDefects.length > 10;
    
    // Overall completion rate of reported issues
    const completionRate = totalDefects > 0 ? Math.round((closedDefects.length / totalDefects) * 100) : 0;

    // 3. Aging Data (For Horizontal Bar Chart)
    const now = Date.now();
    const agingBuckets = {
      '0-7 ימים': 0,
      '8-14 ימים': 0,
      '15-30 ימים': 0,
      '+30 ימים': 0
    };

    openDefects.forEach(d => {
      const diffDays = Math.floor((now - d.timestamp) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) agingBuckets['0-7 ימים']++;
      else if (diffDays <= 14) agingBuckets['8-14 ימים']++;
      else if (diffDays <= 30) agingBuckets['15-30 ימים']++;
      else agingBuckets['+30 ימים']++;
    });

    const agingChartData = [
      { name: lang === 'he' ? '0-7 ימים' : '0-7 Days', value: agingBuckets['0-7 ימים'], percentage: totalDefects > 0 ? Math.round((agingBuckets['0-7 ימים'] / totalDefects) * 100) : 0 },
      { name: lang === 'he' ? '8-14 ימים' : '8-14 Days', value: agingBuckets['8-14 ימים'], percentage: totalDefects > 0 ? Math.round((agingBuckets['8-14 ימים'] / totalDefects) * 100) : 0 },
      { name: lang === 'he' ? '15-30 ימים' : '15-30 Days', value: agingBuckets['15-30 ימים'], percentage: totalDefects > 0 ? Math.round((agingBuckets['15-30 ימים'] / totalDefects) * 100) : 0 },
      { name: lang === 'he' ? '+30 ימים' : '30+ Days', value: agingBuckets['+30 ימים'], percentage: totalDefects > 0 ? Math.round((agingBuckets['+30 ימים'] / totalDefects) * 100) : 0 }
    ];

    // 4. Status Distribution Data (For Donut Chart)
    const statusChartData = [
      { name: lang === 'he' ? '⚪ טרם החל' : lang === 'ru' ? '⚪ Еще не начато' : '⚪ Not Started', value: stats.notStarted, color: '#94a3b8' },
      { name: lang === 'he' ? '🔵 בביצוע' : lang === 'ru' ? '🔵 Выполняется' : '🔵 In Progress', value: stats.inProgress, color: '#3b82f6' },
      { name: lang === 'he' ? '🟢 הושלם' : lang === 'ru' ? '🟢 Завершено' : '🟢 Completed', value: stats.done, color: '#22c55e' },
      { name: lang === 'he' ? '🟡 משימת המשך' : lang === 'ru' ? '🟡 Последующая задача' : '🟡 Followup Task', value: stats.needsFollowup, color: '#eab308' },
      { name: lang === 'he' ? '🔴 מעוכב/תקוע' : lang === 'ru' ? '🔴 Заблокировано' : '🔴 Blocked', value: stats.blocked, color: '#ef4444' },
      { name: lang === 'he' ? '🟣 צריך תיאום' : lang === 'ru' ? '🟣 Нужна координация' : '🟣 Coordination', value: stats.coordinationRequired, color: '#a855f7' }
    ].filter(item => item.value > 0 || item.name.includes('טרם החל') || item.name.includes('בביצוע') || item.name.includes('הושלם'));

    // Calculate percentages for donut
    const donutTotal = statusChartData.reduce((acc, item) => acc + item.value, 0);

    // 5. Trend Over 30 Days (Cumulative and Daily)
    const trendChartData: { date: string; value: number }[] = [];
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Group logs by day
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * oneDayMs);
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      const dayEndTimestamp = d.setHours(23, 59, 59, 999);

      if (trendTab === 'total') {
        // Cumulative count of defects reported up to this day
        const count = defects.filter(t => t.timestamp <= dayEndTimestamp).length;
        trendChartData.push({ date: dateStr, value: count });
      } else if (trendTab === 'opened') {
        // Daily newly opened defects (created on this day)
        const dayStartTimestamp = d.setHours(0, 0, 0, 0);
        const count = defects.filter(t => t.timestamp >= dayStartTimestamp && t.timestamp <= dayEndTimestamp).length;
        trendChartData.push({ date: dateStr, value: count });
      } else {
        // Cumulative closed defects up to this day
        // Since we don't have detailed completion dates, we can assume a done status completed around its timestamp
        const count = closedDefects.filter(t => t.timestamp <= dayEndTimestamp).length;
        trendChartData.push({ date: dateStr, value: count });
      }
    }

    // 6. Defects by Systems/Disciplines (פילוח לפי מערכות)
    const disciplineCounts: Record<string, number> = {};
    openDefects.forEach(d => {
      disciplineCounts[d.discipline] = (disciplineCounts[d.discipline] || 0) + 1;
    });

    const getDisciplineHebrewName = (disc: string): string => {
      const clean = disc.toLowerCase().trim();
      const directMap: Record<string, string> = {
        'plumbing': 'אינסטלציה',
        'plumber': 'אינסטלציה',
        'general': 'כללי / גמרים',
        'itumit': 'איטום',
        'rappelling': 'סנפלינג',
        'telefire': 'טלפייר (כיבוי אש)',
        'emperion': 'משאבות (אמפריון)',
        'electrician': 'חשמל',
        'gas': 'גז',
        'gas_contractor': 'קבלן גז',
        'workers': 'פועלים',
        'manager': 'מנהל עבודה',
        'aluminum': 'אלומיניום',
      };

      if (directMap[clean]) {
        return directMap[clean];
      }

      const translationKey = `discipline_${clean}`;
      if ((translations.he as any)[translationKey]) {
        return (translations.he as any)[translationKey];
      }

      const contractorKey = `contractor_${clean}`;
      if ((translations.he as any)[contractorKey]) {
        return (translations.he as any)[contractorKey];
      }

      return disc;
    };

    const systemChartData = Object.entries(disciplineCounts).map(([disc, val]) => {
      return {
        name: getDisciplineHebrewName(disc),
        value: val
      };
    }).sort((a, b) => b.value - a.value).slice(0, 5);

    // 7. Defects by Contractors (פילוח לפי בעלי מקצוע)
    const contractorCounts: Record<string, number> = {};
    openDefects.forEach(d => {
      const cId = d.log.contractorId || d.log.contractor || 'workers';
      contractorCounts[cId] = (contractorCounts[cId] || 0) + 1;
    });

    const getContractorHebrewName = (cId: string): string => {
      const clean = cId.toLowerCase().trim();
      const directMap: Record<string, string> = {
        'manager': '👔 מנהל עבודה',
        'workers': '👷 פועלים',
        'plumber': '🚰 אינסטלטור',
        'plumbing': '🚰 אינסטלטור',
        'rappelling': '🧗 איש סנפלינג',
        'telefire': '🔥 טלפייר (כיבוי אש)',
        'emperion': '⚙️ אמפריון (משאבות)',
        'itumit': '💧 איטומית (איטום)',
        'electrician': '⚡ חשמלאי',
        'gas_contractor': '⛽ קבלן גז',
        'gas': '⛽ קבלן גז',
        'aluminum': '🪟 איש אלומיניום',
      };

      if (directMap[clean]) {
        return directMap[clean];
      }

      const contractorObj = CONTRACTORS.find(c => c.id.toLowerCase() === clean);
      if (contractorObj) {
        const label = (translations.he as any)[contractorObj.labelKey];
        if (label) {
          return `${contractorObj.icon} ${label}`;
        }
      }

      const contractorKey = `contractor_${clean}`;
      if ((translations.he as any)[contractorKey]) {
        return (translations.he as any)[contractorKey];
      }

      const disciplineKey = `discipline_${clean}`;
      if ((translations.he as any)[disciplineKey]) {
        return (translations.he as any)[disciplineKey];
      }

      return cId;
    };

    const contractorChartData = Object.entries(contractorCounts).map(([cId, val]) => {
      return {
        name: getContractorHebrewName(cId),
        value: val,
        id: cId
      };
    }).sort((a, b) => b.value - a.value).slice(0, 5);

    return {
      stats,
      totalDefects,
      openDefectsCount: openDefects.length,
      closedDefectsCount: closedDefects.length,
      criticalDefectsCount,
      overdueDefectsCount,
      closedThisWeekCount,
      requiresAttention,
      completionRate,
      agingChartData,
      statusChartData,
      donutTotal,
      trendChartData,
      systemChartData,
      contractorChartData
    };
  }, [state, selectedPlotId, discipline, trendTab, lang]);

  const {
    stats,
    totalDefects,
    openDefectsCount,
    closedDefectsCount,
    criticalDefectsCount,
    overdueDefectsCount,
    closedThisWeekCount,
    requiresAttention,
    completionRate,
    agingChartData,
    statusChartData,
    donutTotal,
    trendChartData,
    systemChartData,
    contractorChartData
  } = dashboardData;

  // Pie chart data for Project Completion rate (Half-Donut)
  const halfDonutData = [
    { value: completionRate, color: '#facc15' }, // Completion rate (yellow)
    { value: 100 - completionRate, color: '#1e293b' } // Remaining (dark gray/slate)
  ];

  return (
    <div className="bg-slate-950 p-4 md:p-6 rounded-3xl border border-slate-800 text-slate-100 shadow-2xl flex flex-col gap-6" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* ROW 1: Project Progress Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
        
        {/* Radial Progress Gauge (Left in Hebrew, Right in LTR) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-l border-slate-800 pb-4 lg:pb-0 lg:pl-6">
          <div className="relative w-44 h-24 flex items-center justify-center overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={halfDonutData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={0}
                  dataKey="value"
                  isAnimationActive={true}
                >
                  {halfDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 text-center">
              <span className="text-3xl font-black tracking-tight text-white">{completionRate}%</span>
            </div>
          </div>
        </div>

        {/* Project Status Information */}
        <div className="lg:col-span-8 flex flex-col justify-between pt-2 lg:pt-0 lg:pr-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold text-sm">
                {lang === 'he' ? 'מצב הפרויקט' : 'Project Status'}
              </span>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black shadow-md transition-all ${
                requiresAttention 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {requiresAttention 
                  ? (lang === 'he' ? 'דורש תשומת לב' : 'Requires Attention') 
                  : (lang === 'he' ? 'תקין' : 'Healthy')}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-2 font-medium">
              {requiresAttention 
                ? (lang === 'he' ? 'הצטברו ליקויים פתוחים שמחכים לטיפול.' : 'Open defects have accumulated waiting for resolution.')
                : (lang === 'he' ? 'כל המערכות תקינות וקצב ההתקדמות מעולה.' : 'All systems are performing well and progress is excellent.')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 font-bold">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">▼</span>
              <span>
                {lang === 'he' 
                  ? `קצב הסגירה השבוע: ${closedThisWeekCount} ליקויים שנפתרו` 
                  : `Closure speed this week: ${closedThisWeekCount} resolved`}
              </span>
            </div>
            <div className="hidden sm:block text-slate-700">|</div>
            <div>
              {lang === 'he' 
                ? `${openDefectsCount} ליקויים פתוחים במערכת` 
                : `${openDefectsCount} open defects in the system`}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        
        {/* KPI 1: סה"כ ליקויים (Total) - Labeled with Indigo */}
        <div 
          onClick={() => onStatusClick(null)}
          className={`col-span-2 md:col-span-1 p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer shadow-lg active:scale-95 ${
            statusFilter === null 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {lang === 'he' ? 'סה"כ ליקויים' : 'Total Defects'}
            </span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white">{totalDefects}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            {lang === 'he' ? 'בכל רמות העדיפות' : 'Across all priorities'}
          </div>
        </div>

        {/* KPI 2: מעוכב/תקוע (Blocked) */}
        <div 
          onClick={() => onStatusClick(TaskStatus.BLOCKED)}
          className={`p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer shadow-lg active:scale-95 ${
            statusFilter === TaskStatus.BLOCKED 
              ? 'border-red-500 ring-2 ring-red-500/20' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {lang === 'he' ? '🔴 מעוכב/תקוע' : lang === 'ru' ? '🔴 Заблокировано' : '🔴 Blocked'}
            </span>
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-red-500">{criticalDefectsCount}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            {lang === 'he' ? 'עדיפות גבוהה - פתוחים' : 'High priority - open'}
          </div>
        </div>

        {/* KPI 3: בביצוע (In Progress) */}
        <div 
          onClick={() => onStatusClick(TaskStatus.IN_PROGRESS)}
          className={`p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer shadow-lg active:scale-95 ${
            statusFilter === TaskStatus.IN_PROGRESS 
              ? 'border-blue-500 ring-2 ring-blue-500/20' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {lang === 'he' ? '🔵 בביצוע' : lang === 'ru' ? '🔵 Выполняется' : '🔵 In Progress'}
            </span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-blue-500">{stats.inProgress}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            {lang === 'he' ? 'בעבודה כעת' : 'Currently working'}
          </div>
        </div>

        {/* KPI 4: הושלם (Done) */}
        <div 
          onClick={() => onStatusClick(TaskStatus.DONE)}
          className={`p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer shadow-lg active:scale-95 ${
            statusFilter === TaskStatus.DONE 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {lang === 'he' ? '🟢 הושלם' : lang === 'ru' ? '🟢 Завершено' : '🟢 Completed'}
            </span>
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-500">{closedDefectsCount}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            {lang === 'he' ? 'הושלמו השבוע' : 'Completed recently'}
          </div>
        </div>

        {/* KPI 5: באיחור (Overdue) */}
        <div 
          onClick={() => onStatusClick('OVERDUE' as any)}
          className={`p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer shadow-lg active:scale-95 ${
            statusFilter === 'OVERDUE' 
              ? 'border-orange-500 ring-2 ring-orange-500/20' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {lang === 'he' ? 'באיחור' : 'Overdue'}
            </span>
            <AlertTriangle className="w-4 h-4 text-orange-400 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-orange-500">{overdueDefectsCount}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            {lang === 'he' ? 'עברו את תאריך היעד' : 'Overdue target SLA'}
          </div>
        </div>

      </div>

      {/* ROW 3: Two Column Charts - Aging & Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Aging horizontal bar chart */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-200">
              {lang === 'he' ? 'פילוח לפי זמן פתיחה (פתוחים)' : 'Aging Analysis (Open)'}
            </h3>
          </div>

          <div className="space-y-4 pt-2">
            {agingChartData.map((item, index) => {
              // Calculate percent of maximum to render bars accurately and elegantly
              const maxVal = Math.max(...agingChartData.map(d => d.value), 1);
              const barWidth = `${(item.value / maxVal) * 100}%`;

              return (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>{item.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-yellow-400">{item.percentage}%</span>
                      <span className="text-slate-500">({item.value})</span>
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden relative border border-slate-900">
                    <div 
                      className="h-full bg-yellow-500 rounded-full transition-all duration-500" 
                      style={{ width: item.value > 0 ? barWidth : '0%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-slate-500 font-bold mt-4 pt-3 border-t border-slate-800/60">
            {lang === 'he' ? 'ליקויים מעל 30 יום דורשים תיעדוף מיוחד.' : 'Defects open over 30 days require special escalation.'}
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-sm font-black text-slate-200 mb-4">
              {lang === 'he' ? 'התפלגות סטטוסים' : 'Status Distribution'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Donut rendering */}
            <div className="md:col-span-5 flex justify-center relative">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center flex flex-col">
                  <span className="text-2xl font-black text-white">{donutTotal}</span>
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">
                    {lang === 'he' ? 'סה"כ' : 'Total'}
                  </span>
                </div>
              </div>
            </div>

            {/* Custon Legend */}
            <div className="md:col-span-7 flex flex-col gap-2.5">
              {statusChartData.map((item, index) => {
                const pct = donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0;
                return (
                  <div key={index} className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>{pct}%</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-white w-6 text-left">{item.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ROW 4: Bottom Row Charts - System Breakdown & Contractor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Breakdown by Systems (פילוח לפי מערכות) */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl min-h-[260px]">
          <h3 className="text-sm font-black text-slate-200 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            {lang === 'he' ? 'פילוח לפי מערכות' : 'System Breakdown'}
          </h3>

          {systemChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
              <CheckCircle className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">
                {lang === 'he' ? 'אין נתונים' : 'No Data Available'}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center space-y-3.5">
              {systemChartData.map((item, index) => {
                const maxSystemVal = Math.max(...systemChartData.map(d => d.value), 1);
                const barWidth = `${(item.value / maxSystemVal) * 100}%`;

                return (
                  <div key={index} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>{item.name}</span>
                      <span className="text-white font-black">{item.value}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative border border-slate-900">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Breakdown by Contractors (פילוח לפי בעלי מקצוע) */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl min-h-[260px]">
          <h3 className="text-sm font-black text-slate-200 mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-400" />
            {lang === 'he' ? 'פילוח לפי בעלי מקצוע' : 'Contractor Breakdown'}
          </h3>

          {contractorChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
              <CheckCircle className="w-8 h-8 text-slate-700 mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">
                {lang === 'he' ? 'אין נתונים' : 'No Data Available'}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center space-y-3">
              {contractorChartData.map((item, index) => {
                const maxContractorVal = Math.max(...contractorChartData.map(d => d.value), 1);
                const barWidth = `${(item.value / maxContractorVal) * 100}%`;
                const isSelected = contractorFilter === item.id;

                return (
                  <button
                    key={index}
                    onClick={() => onContractorClick(isSelected ? null : item.id)}
                    className={`w-full text-right flex flex-col gap-1 p-2 rounded-xl transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-950/40 ring-1 ring-emerald-500/40' 
                        : 'hover:bg-slate-800/40'
                    }`}
                    style={{ background: 'none', border: 'none', font: 'inherit', color: 'inherit', padding: '6px 8px', width: '100%' }}
                  >
                    <div className="flex justify-between text-xs font-bold text-slate-400 w-full">
                      <span>{item.name}</span>
                      <span className="text-white font-black">{item.value}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative border border-slate-900">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-emerald-400' : 'bg-emerald-500'}`} 
                        style={{ width: barWidth }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ROW 5: Bottom Row Trend Chart */}
      <div className="grid grid-cols-1 gap-4">

        {/* Historical Trend over Last 30 Days */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl min-h-[260px]">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              {lang === 'he' ? 'מגמה ב-30 הימים האחרונים' : '30-Day Activity Trend'}
            </h3>

            {/* Interactive Trend Tab selectors */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-[10px] font-black uppercase tracking-wider">
              <button 
                onClick={() => setTrendTab('total')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  trendTab === 'total' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {lang === 'he' ? 'סה"ך' : 'Total'}
              </button>
              <button 
                onClick={() => setTrendTab('opened')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  trendTab === 'opened' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {lang === 'he' ? 'נפתחו' : 'Opened'}
              </button>
              <button 
                onClick={() => setTrendTab('closed')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  trendTab === 'closed' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {lang === 'he' ? 'נסגרו' : 'Closed'}
              </button>
            </div>
          </div>

          {/* Area Chart with Gradient */}
          <div className="flex-1 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dx={-5}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f1f5f9', fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'black', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#a855f7" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorTrend)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </div>

      </div>

    </div>
  );
};
