import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from 'recharts';
import { useApp } from '../lib/AppContext.jsx';
import {
  DEFAULT_CATEGORIES,
  PAYMENT_MODES,
  CURRENCY_SYMBOLS,
  getCategoryById,
  getCategoryColor,
} from '../lib/categories.js';
import IconRenderer from './IconRenderer.jsx';

const ACCENT_BLUE = '#3B82F6';
const ACCENT_GREEN = '#22C55E';
const LAST_WEEK_GRAY = '#6B7280';

const PAYMENT_MODE_COLORS = {
  cash: '#10B981',
  upi: '#3B82F6',
  'credit-card': '#8B5CF6',
  'debit-card': '#F59E0B',
  'net-banking': '#06B6D4',
  wallet: '#EC4899',
};

const CARD_CLASS =
  'dark:bg-[#222536] bg-white dark:border-[#2D3148] border-gray-200 rounded-2xl border p-5';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function addMonthsYm(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonthYm(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function parseYmd(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const [y, mo, day] = dateStr.split('-').map(Number);
  if (!y || !mo || !day) return null;
  const d = new Date(y, mo - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mon=0 … Sun=6 */
function mondayIndexFromDate(d) {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function getIsDarkTheme(settings) {
  if (settings.theme === 'dark') return true;
  if (settings.theme === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveCategory(id, customCategories) {
  const def = getCategoryById(id);
  if (def) return def;
  const c = customCategories?.find((x) => x.id === id);
  if (c) {
    return {
      id: c.id,
      name: c.name ?? c.id,
      icon: c.icon ?? 'CircleDot',
      color: c.color ?? '#9CA3AF',
      subCategories: c.subCategories ?? [],
    };
  }
  return {
    id: id ?? 'unknown',
    name: 'Unknown',
    icon: 'CircleDot',
    color: '#9CA3AF',
    subCategories: [],
  };
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const v = payload[0]?.value;
  if (v == null) return null;
  const displayLabel = row?.name != null ? row.name : label;
  return (
    <div className="dark:bg-[#1A1D28] bg-white dark:border-[#2D3148] border-gray-200 border rounded-lg px-3 py-2 shadow-lg">
      <p className="dark:text-[#9CA3AF] text-gray-500 text-xs">{displayLabel}</p>
      <p className="dark:text-[#F1F5F9] text-gray-900 font-bold">
        {currency}
        {Number(v).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

function MultiValueTooltip({ active, payload, label, currency, valueLabels }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dark:bg-[#1A1D28] bg-white dark:border-[#2D3148] border-gray-200 border rounded-lg px-3 py-2 shadow-lg">
      <p className="dark:text-[#9CA3AF] text-gray-500 text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="dark:text-[#F1F5F9] text-gray-900 text-sm font-semibold">
          <span className="dark:text-[#9CA3AF] text-gray-500 font-normal text-xs">
            {valueLabels?.[p.dataKey] ?? p.name}:{' '}
          </span>
          {currency}
          {Number(p.value ?? 0).toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
}

function DailyLineTooltip({ active, payload, label, currency, monthLabel }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  const day = payload[0]?.payload?.day;
  const displayLabel = monthLabel && day != null ? `${monthLabel} ${day}` : label;
  return (
    <div className="dark:bg-[#1A1D28] bg-white dark:border-[#2D3148] border-gray-200 border rounded-lg px-3 py-2 shadow-lg">
      <p className="dark:text-[#9CA3AF] text-gray-500 text-xs">{displayLabel}</p>
      <p className="dark:text-[#F1F5F9] text-gray-900 font-bold">
        {currency}
        {Number(v).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

function ChartShell({ children, empty, emptyMessage = 'No data for this period' }) {
  if (empty) {
    return (
      <div
        className={`${CARD_CLASS} flex items-center justify-center min-h-[200px] sm:min-h-[300px] text-center dark:text-[#9CA3AF] text-gray-500 text-sm`}
      >
        {emptyMessage}
      </div>
    );
  }
  return <div className={CARD_CLASS}>{children}</div>;
}

function chartHeightClass() {
  return 'h-[200px] w-full sm:h-[300px]';
}

export default function Analytics() {
  const {
    expenses,
    settings,
    selectedMonth,
    customCategories,
    getMonthExpenses,
    getTotalForMonth,
    getCategoryTotal,
  } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => DEFAULT_CATEGORIES[0]?.id ?? '');

  const currency = CURRENCY_SYMBOLS[settings.currency] ?? '₹';
  const isDark = getIsDarkTheme(settings);
  const gridStroke = isDark ? '#2D3148' : '#E2E8F0';
  const axisTick = isDark ? '#9CA3AF' : '#6B7280';

  const monthExpenses = useMemo(
    () => getMonthExpenses(selectedMonth),
    [getMonthExpenses, selectedMonth]
  );

  const allCategoryOptions = useMemo(() => {
    const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
    for (const c of customCategories ?? []) {
      if (c?.id && !byId.has(c.id)) {
        byId.set(c.id, resolveCategory(c.id, customCategories));
      }
    }
    for (const e of expenses) {
      if (e?.category && !byId.has(e.category)) {
        byId.set(e.category, resolveCategory(e.category, customCategories));
      }
    }
    return Array.from(byId.values());
  }, [customCategories, expenses]);

  const monthLabelForDaily = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }, [selectedMonth]);

  const monthlyTrend6 = useMemo(() => {
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const ym = addMonthsYm(selectedMonth, -i);
      const total = getTotalForMonth(ym);
      const [y, m] = ym.split('-').map(Number);
      rows.push({
        key: ym,
        name: MONTH_NAMES[m - 1],
        total,
      });
    }
    return rows;
  }, [selectedMonth, getTotalForMonth]);

  const dailyLineData = useMemo(() => {
    const dim = daysInMonthYm(selectedMonth);
    const byDay = new Map();
    for (const e of monthExpenses) {
      const d = e.date?.slice(8, 10);
      if (!d) continue;
      const day = parseInt(d, 10);
      if (day < 1 || day > dim) continue;
      byDay.set(day, (byDay.get(day) ?? 0) + (e.amount || 0));
    }
    const rows = [];
    for (let day = 1; day <= dim; day++) {
      rows.push({ day, amount: byDay.get(day) ?? 0 });
    }
    return rows;
  }, [monthExpenses, selectedMonth]);

  const weekOverWeekData = useMemo(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const mondayThis = new Date(now);
    const idx = mondayIndexFromDate(now);
    mondayThis.setDate(now.getDate() - idx);
    mondayThis.setHours(0, 0, 0, 0);

    const mondayLast = new Date(mondayThis);
    mondayLast.setDate(mondayLast.getDate() - 7);

    const thisWeekEnd = new Date(mondayThis);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
    thisWeekEnd.setHours(23, 59, 59, 999);

    const lastWeekEnd = new Date(mondayLast);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const thisTotals = [0, 0, 0, 0, 0, 0, 0];
    const lastTotals = [0, 0, 0, 0, 0, 0, 0];

    for (const e of expenses) {
      const d = parseYmd(e.date);
      if (!d) continue;
      const amt = e.amount || 0;
      if (d >= mondayThis && d <= thisWeekEnd) {
        thisTotals[mondayIndexFromDate(d)] += amt;
      } else if (d >= mondayLast && d <= lastWeekEnd) {
        lastTotals[mondayIndexFromDate(d)] += amt;
      }
    }

    return WEEKDAY_SHORT.map((name, i) => ({
      name,
      thisWeek: thisTotals[i],
      lastWeek: lastTotals[i],
    }));
  }, [expenses]);

  const overviewSummary = useMemo(() => {
    const dim = daysInMonthYm(selectedMonth);
    const byDay = new Map();
    const categoryCount = new Map();
    for (const e of monthExpenses) {
      const dayStr = e.date?.slice(8, 10);
      const day = dayStr ? parseInt(dayStr, 10) : NaN;
      if (day >= 1 && day <= dim) {
        byDay.set(day, (byDay.get(day) ?? 0) + (e.amount || 0));
      }
      const cid = e.category ?? 'unknown';
      categoryCount.set(cid, (categoryCount.get(cid) ?? 0) + 1);
    }
    const total = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const avgDaily = dim > 0 ? total / dim : 0;
    let maxDay = null;
    let maxAmt = 0;
    for (const [day, amt] of byDay) {
      if (amt > maxAmt) {
        maxAmt = amt;
        maxDay = day;
      }
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    let highestDateStr = null;
    if (maxDay != null) {
      highestDateStr = `${y}-${String(m).padStart(2, '0')}-${String(maxDay).padStart(2, '0')}`;
    }
    let mostActiveCat = null;
    let mostActiveCount = 0;
    for (const [cid, c] of categoryCount) {
      if (c > mostActiveCount) {
        mostActiveCount = c;
        mostActiveCat = cid;
      }
    }
    const mostActiveName = mostActiveCat
      ? resolveCategory(mostActiveCat, customCategories).name
      : '—';

    return {
      avgDaily,
      highestAmount: maxAmt,
      highestDateStr,
      transactionCount: monthExpenses.length,
      mostActiveName,
    };
  }, [monthExpenses, selectedMonth, customCategories]);

  const categoryPieData = useMemo(() => {
    const totals = new Map();
    for (const e of monthExpenses) {
      const id = e.category ?? 'unknown';
      totals.set(id, (totals.get(id) ?? 0) + (e.amount || 0));
    }
    const grand = [...totals.values()].reduce((a, b) => a + b, 0);
    const rows = [];
    for (const [id, value] of totals) {
      if (value <= 0) continue;
      const cat = resolveCategory(id, customCategories);
      rows.push({
        id,
        name: cat.name,
        value,
        color: cat.color ?? getCategoryColor(id),
        pct: grand > 0 ? (value / grand) * 100 : 0,
      });
    }
    rows.sort((a, b) => b.value - a.value);
    return { rows, grand };
  }, [monthExpenses, customCategories]);

  const selectedCategoryMeta = useMemo(
    () => resolveCategory(selectedCategoryId, customCategories),
    [selectedCategoryId, customCategories]
  );

  const categoryDetail = useMemo(() => {
    const catTotal = getCategoryTotal(selectedCategoryId, selectedMonth);
    const monthTotal = getTotalForMonth(selectedMonth);
    const pct = monthTotal > 0 ? (catTotal / monthTotal) * 100 : 0;

    const subMap = new Map();
    for (const e of monthExpenses) {
      if (e.category !== selectedCategoryId) continue;
      const sub = e.subCategory?.trim() || 'Uncategorized';
      subMap.set(sub, (subMap.get(sub) ?? 0) + (e.amount || 0));
    }
    const subBars = [...subMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const ym = addMonthsYm(selectedMonth, -i);
      const t = getCategoryTotal(selectedCategoryId, ym);
      const [, mo] = ym.split('-').map(Number);
      trend.push({ name: MONTH_NAMES[mo - 1], total: t });
    }

    return { catTotal, pct, subBars, trend };
  }, [
    selectedCategoryId,
    selectedMonth,
    monthExpenses,
    getCategoryTotal,
    getTotalForMonth,
  ]);

  const paymentAnalysis = useMemo(() => {
    const totals = new Map();
    const counts = new Map();
    for (const e of monthExpenses) {
      const mode = e.paymentMode ?? 'unknown';
      totals.set(mode, (totals.get(mode) ?? 0) + (e.amount || 0));
      counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }
    const pieRows = [];
    for (const [id, value] of totals) {
      if (value <= 0) continue;
      const meta = PAYMENT_MODES.find((p) => p.id === id);
      pieRows.push({
        id,
        name: meta?.name ?? id,
        value,
        color: PAYMENT_MODE_COLORS[id] ?? '#9CA3AF',
        count: counts.get(id) ?? 0,
      });
    }
    pieRows.sort((a, b) => b.value - a.value);
    const cards = pieRows.map((r) => ({ ...r }));
    return { pieRows, cards };
  }, [monthExpenses]);

  const topExpenses = useMemo(() => {
    return [...monthExpenses]
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 10);
  }, [monthExpenses]);

  const topSpendingDays = useMemo(() => {
    const byDate = new Map();
    for (const e of monthExpenses) {
      const ds = e.date;
      if (!ds) continue;
      if (!byDate.has(ds)) byDate.set(ds, { total: 0, count: 0 });
      const row = byDate.get(ds);
      row.total += e.amount || 0;
      row.count += 1;
    }
    return [...byDate.entries()]
      .map(([date, { total, count }]) => ({ date, total, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [monthExpenses]);

  const wowHasData = useMemo(
    () => weekOverWeekData.some((d) => d.thisWeek > 0 || d.lastWeek > 0),
    [weekOverWeekData]
  );

  const tabBtn = (id, label) => (
    <button
      type="button"
      key={id}
      onClick={() => setActiveTab(id)}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === id
          ? 'bg-[#3B82F6] text-white shadow-md'
          : 'dark:bg-[#1A1D28] bg-gray-100 dark:text-[#9CA3AF] text-gray-600 hover:opacity-90'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabBtn('overview', 'Overview')}
        {tabBtn('categories', 'Categories')}
        {tabBtn('payment', 'Payment Modes')}
        {tabBtn('top', 'Top Expenses')}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartShell empty={!monthlyTrend6.some((r) => r.total > 0)}>
              <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">
                Monthly trend (last 6 months)
              </h3>
              <div className={chartHeightClass()}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend6} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: axisTick, fontSize: 12 }} axisLine={{ stroke: gridStroke }} />
                    <YAxis
                      tick={{ fill: axisTick, fontSize: 11 }}
                      axisLine={{ stroke: gridStroke }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip content={(props) => <CustomTooltip {...props} currency={currency} />} />
                    <Bar dataKey="total" name="Spend" fill={ACCENT_BLUE} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartShell>

            <ChartShell empty={!dailyLineData.some((r) => r.amount > 0)}>
              <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">
                Daily spending ({monthLabelForDaily})
              </h3>
              <div className={chartHeightClass()}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyLineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsAreaGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT_GREEN} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: axisTick, fontSize: 11 }}
                      axisLine={{ stroke: gridStroke }}
                    />
                    <YAxis
                      tick={{ fill: axisTick, fontSize: 11 }}
                      axisLine={{ stroke: gridStroke }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip
                      content={(props) => (
                        <DailyLineTooltip
                          {...props}
                          currency={currency}
                          monthLabel={monthLabelForDaily.split(' ')[0]}
                        />
                      )}
                    />
                    <Area type="monotone" dataKey="amount" stroke="none" fill="url(#analyticsAreaGreen)" />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke={ACCENT_GREEN}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartShell>
          </div>

          <ChartShell empty={!wowHasData}>
            <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">
              Week-over-week (Mon–Sun)
            </h3>
            <div className={chartHeightClass()}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekOverWeekData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisTick, fontSize: 12 }} axisLine={{ stroke: gridStroke }} />
                  <YAxis
                    tick={{ fill: axisTick, fontSize: 11 }}
                    axisLine={{ stroke: gridStroke }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Legend wrapperStyle={{ color: axisTick }} />
                  <Tooltip
                    content={(props) => (
                      <MultiValueTooltip
                        {...props}
                        currency={currency}
                        valueLabels={{ thisWeek: 'This week', lastWeek: 'Last week' }}
                      />
                    )}
                  />
                  <Bar dataKey="thisWeek" name="This week" fill={ACCENT_BLUE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lastWeek" name="Last week" fill={LAST_WEEK_GRAY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartShell>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={CARD_CLASS}>
              <p className="dark:text-[#9CA3AF] text-gray-500 text-xs uppercase tracking-wide">Avg daily</p>
              <p className="dark:text-[#F1F5F9] text-gray-900 text-xl font-bold mt-1">
                {currency}
                {Math.round(overviewSummary.avgDaily).toLocaleString('en-IN')}
              </p>
            </div>
            <div className={CARD_CLASS}>
              <p className="dark:text-[#9CA3AF] text-gray-500 text-xs uppercase tracking-wide">Highest day</p>
              <p className="dark:text-[#F1F5F9] text-gray-900 text-xl font-bold mt-1">
                {overviewSummary.highestDateStr
                  ? `${overviewSummary.highestDateStr} · ${currency}${overviewSummary.highestAmount.toLocaleString('en-IN')}`
                  : '—'}
              </p>
            </div>
            <div className={CARD_CLASS}>
              <p className="dark:text-[#9CA3AF] text-gray-500 text-xs uppercase tracking-wide">Transactions</p>
              <p className="dark:text-[#F1F5F9] text-gray-900 text-xl font-bold mt-1">
                {overviewSummary.transactionCount}
              </p>
            </div>
            <div className={CARD_CLASS}>
              <p className="dark:text-[#9CA3AF] text-gray-500 text-xs uppercase tracking-wide">Most active category</p>
              <p className="dark:text-[#F1F5F9] text-gray-900 text-lg font-bold mt-1 truncate">
                {overviewSummary.mostActiveName}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6">
          <ChartShell empty={categoryPieData.rows.length === 0}>
            <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">
              Spending by category ({monthLabelForDaily})
            </h3>
            <div className="relative h-[240px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData.rows}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="78%"
                    paddingAngle={2}
                  >
                    {categoryPieData.rows.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="dark:bg-[#1A1D28] bg-white dark:border-[#2D3148] border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
                          <p className="dark:text-[#F1F5F9] text-gray-900 font-semibold">{p.name}</p>
                          <p className="dark:text-[#9CA3AF] text-gray-500 text-xs">
                            {currency}
                            {Number(p.value).toLocaleString('en-IN')} ({p.pct.toFixed(1)}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-2">
                <div className="text-center">
                  <p className="dark:text-[#9CA3AF] text-gray-500 text-xs">Total</p>
                  <p className="dark:text-[#F1F5F9] text-gray-900 text-lg font-bold">
                    {currency}
                    {categoryPieData.grand.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 border-t dark:border-[#2D3148] border-gray-200 pt-4">
              {categoryPieData.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="dark:text-[#F1F5F9] text-gray-900 truncate">{r.name}</span>
                  </span>
                  <span className="dark:text-[#9CA3AF] text-gray-600 shrink-0 text-right">
                    {currency}
                    {r.value.toLocaleString('en-IN')}{' '}
                    <span className="text-xs">({r.pct.toFixed(1)}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </ChartShell>

          <div className={CARD_CLASS}>
            <label className="block dark:text-[#9CA3AF] text-gray-500 text-xs font-medium mb-2">
              Category detail
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-xl border dark:border-[#2D3148] border-gray-200 dark:bg-[#1A1D28] bg-white dark:text-[#F1F5F9] text-gray-900 px-3 py-2 text-sm"
            >
              {allCategoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="mt-6 flex flex-col items-center justify-center py-4">
              <p className="dark:text-[#9CA3AF] text-gray-500 text-xs uppercase tracking-wide">
                Share of monthly spend
              </p>
              <p className="dark:text-[#F1F5F9] text-gray-900 text-4xl font-extrabold mt-1">
                {categoryDetail.pct.toFixed(1)}%
              </p>
            </div>

            <div className="mt-6 pt-6 border-t dark:border-[#2D3148] border-gray-200">
              <h4 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">
                Sub-categories — {selectedCategoryMeta.name}
              </h4>
              {categoryDetail.subBars.length === 0 ? (
                <p className="text-center dark:text-[#9CA3AF] text-gray-500 text-sm py-8">No sub-category data</p>
              ) : (
                <div className="h-[200px] w-full sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={categoryDetail.subBars}
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" tick={{ fill: axisTick, fontSize: 11 }} axisLine={{ stroke: gridStroke }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fill: axisTick, fontSize: 11 }}
                        axisLine={{ stroke: gridStroke }}
                      />
                      <Tooltip content={(props) => <CustomTooltip {...props} currency={currency} />} />
                      <Bar
                        dataKey="value"
                        fill={selectedCategoryMeta.color ?? ACCENT_BLUE}
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t dark:border-[#2D3148] border-gray-200">
              <h4 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">
                6-month trend — {selectedCategoryMeta.name}
              </h4>
              {!categoryDetail.trend.some((t) => t.total > 0) ? (
                <p className="text-center dark:text-[#9CA3AF] text-gray-500 text-sm py-8">No trend data</p>
              ) : (
                <div className={chartHeightClass()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={categoryDetail.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis dataKey="name" tick={{ fill: axisTick, fontSize: 12 }} axisLine={{ stroke: gridStroke }} />
                      <YAxis
                        tick={{ fill: axisTick, fontSize: 11 }}
                        axisLine={{ stroke: gridStroke }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      />
                      <Tooltip content={(props) => <CustomTooltip {...props} currency={currency} />} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke={selectedCategoryMeta.color ?? ACCENT_BLUE}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-6">
          <ChartShell empty={paymentAnalysis.pieRows.length === 0}>
            <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-3 text-sm">Payment modes</h3>
            <div className="h-[220px] w-full sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentAnalysis.pieRows}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="52%"
                    outerRadius="72%"
                    paddingAngle={2}
                  >
                    {paymentAnalysis.pieRows.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="dark:bg-[#1A1D28] bg-white dark:border-[#2D3148] border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
                          <p className="dark:text-[#F1F5F9] text-gray-900 font-semibold">{p.name}</p>
                          <p className="dark:text-[#9CA3AF] text-gray-500 text-xs">
                            {currency}
                            {Number(p.value).toLocaleString('en-IN')}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ color: axisTick }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartShell>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paymentAnalysis.cards.length === 0 ? (
              <div
                className={`${CARD_CLASS} sm:col-span-2 xl:col-span-3 text-center dark:text-[#9CA3AF] text-gray-500 text-sm`}
              >
                No data for this period
              </div>
            ) : (
              paymentAnalysis.cards.map((c) => (
                <div key={c.id} className={CARD_CLASS} style={{ borderLeftWidth: 4, borderLeftColor: c.color }}>
                  <p className="dark:text-[#F1F5F9] text-gray-900 font-semibold">{c.name}</p>
                  <p className="dark:text-[#9CA3AF] text-gray-500 text-xs mt-1">{c.count} transactions</p>
                  <p className="dark:text-[#F1F5F9] text-gray-900 text-xl font-bold mt-2">
                    {currency}
                    {c.value.toLocaleString('en-IN')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'top' && (
        <div className="space-y-6">
          <div className={CARD_CLASS}>
            <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-4 text-sm">Top 10 expenses</h3>
            {topExpenses.length === 0 ? (
              <p className="dark:text-[#9CA3AF] text-gray-500 text-sm text-center py-8">No data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="dark:text-[#9CA3AF] text-gray-500 text-left border-b dark:border-[#2D3148] border-gray-200">
                      <th className="pb-2 pr-2 w-10">#</th>
                      <th className="pb-2 pr-2 w-10" />
                      <th className="pb-2 pr-2">Note</th>
                      <th className="pb-2 pr-2 text-right">Amount</th>
                      <th className="pb-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topExpenses.map((e, i) => {
                      const cat = resolveCategory(e.category, customCategories);
                      return (
                        <tr
                          key={e.id ?? `${e.date}-${i}`}
                          className={`border-b dark:border-[#2D3148] border-gray-100 ${
                            i % 2 === 0
                              ? 'dark:bg-[#1A1D28]/40 bg-gray-50/80'
                              : 'dark:bg-transparent bg-transparent'
                          }`}
                        >
                          <td className="py-2.5 pr-2 dark:text-[#9CA3AF] text-gray-500">{i + 1}</td>
                          <td className="py-2.5 pr-2">
                            <IconRenderer name={cat.icon} size={18} className="dark:text-[#F1F5F9] text-gray-800" />
                          </td>
                          <td className="py-2.5 pr-2 dark:text-[#F1F5F9] text-gray-900 max-w-[140px] truncate">
                            {e.note?.trim() || '—'}
                          </td>
                          <td className="py-2.5 pr-2 text-right font-semibold dark:text-[#F1F5F9] text-gray-900">
                            {currency}
                            {(e.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 text-right dark:text-[#9CA3AF] text-gray-600 whitespace-nowrap">
                            {e.date ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={CARD_CLASS}>
            <h3 className="dark:text-[#F1F5F9] text-gray-900 font-semibold mb-4 text-sm">Top spending days</h3>
            {topSpendingDays.length === 0 ? (
              <p className="dark:text-[#9CA3AF] text-gray-500 text-sm text-center py-8">No data for this period</p>
            ) : (
              <ul className="space-y-2">
                {topSpendingDays.map((d, i) => (
                  <li
                    key={d.date}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${
                      i % 2 === 0 ? 'dark:bg-[#1A1D28]/50 bg-gray-50' : ''
                    }`}
                  >
                    <span className="dark:text-[#F1F5F9] text-gray-900 font-medium">{d.date}</span>
                    <span className="dark:text-[#9CA3AF] text-gray-600">
                      {d.count} txn{d.count !== 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold dark:text-[#F1F5F9] text-gray-900">
                      {currency}
                      {d.total.toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
