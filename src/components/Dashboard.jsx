import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useApp } from '../lib/AppContext.jsx';
import {
  PAYMENT_MODES,
  CURRENCY_SYMBOLS,
  getCategoryById,
  getCategoryColor,
} from '../lib/categories.js';
import IconRenderer from './IconRenderer.jsx';

const cardClass =
  'dark:bg-[#222536] bg-white dark:border-[#2D3148] border-gray-200 rounded-2xl border p-5';
const textPrimary = 'dark:text-[#F1F5F9] text-gray-900';
const textSecondary = 'dark:text-[#9CA3AF] text-gray-500';
const textMuted = 'dark:text-[#6B7280] text-gray-400';

function parseYmd(str) {
  if (!str || typeof str !== 'string') return null;
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function shiftYearMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function formatAmount(n, currency) {
  const isInr = currency === 'INR';
  return Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: isInr ? 0 : 2,
    minimumFractionDigits: isInr ? 0 : 2,
  });
}

function paymentModeLabel(id) {
  return PAYMENT_MODES.find((p) => p.id === id)?.name ?? id ?? '—';
}

function resolveCategory(categoryId, customCategories) {
  const custom = customCategories?.find((c) => c.id === categoryId);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name ?? 'Category',
      icon: custom.icon ?? 'Sparkles',
      color: custom.color ?? getCategoryColor(categoryId),
    };
  }
  const def = getCategoryById(categoryId);
  if (def) return def;
  return {
    id: categoryId,
    name: 'Other',
    icon: 'Sparkles',
    color: getCategoryColor(categoryId),
  };
}

function prevDayYmd(ymd) {
  const d = parseYmd(ymd);
  if (!d) return null;
  return formatYmd(addDays(d, -1));
}

function computeStreak(expenses, todayYmd) {
  const byDay = new Set(
    expenses.filter((e) => e.date).map((e) => e.date.slice(0, 10)),
  );
  let streak = 0;
  let cursor = todayYmd;
  const start = parseYmd(cursor);
  if (!start) return 0;
  while (byDay.has(cursor)) {
    streak += 1;
    cursor = prevDayYmd(cursor);
    if (!cursor) break;
  }
  return streak;
}

export default function Dashboard() {
  const {
    expenses,
    settings,
    selectedMonth,
    dispatch,
    customCategories,
    getMonthExpenses,
    getTotalForMonth,
  } = useApp();

  const currency = settings.currency ?? 'INR';
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = prevDayYmd(today);

  const dashboardStats = useMemo(() => {
    const monthList = getMonthExpenses(selectedMonth);
    const monthTotal = getTotalForMonth(selectedMonth);

    const todayTotal = expenses
      .filter((e) => e.date?.slice(0, 10) === today)
      .reduce((s, e) => s + (e.amount || 0), 0);
    const yesterdayTotal = yesterday
      ? expenses
          .filter((e) => e.date?.slice(0, 10) === yesterday)
          .reduce((s, e) => s + (e.amount || 0), 0)
      : 0;
    const vsYesterday = todayTotal - yesterdayTotal;

    const todayD = parseYmd(today);
    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    if (todayD) {
      const mon = startOfWeekMonday(todayD);
      const sun = addDays(mon, 6);
      const prevMon = addDays(mon, -7);
      const prevSun = addDays(mon, -1);
      const wStart = formatYmd(mon);
      const wEnd = formatYmd(sun);
      const lwStart = formatYmd(prevMon);
      const lwEnd = formatYmd(prevSun);
      for (const e of expenses) {
        const d = e.date?.slice(0, 10);
        if (!d) continue;
        const a = e.amount || 0;
        if (d >= wStart && d <= wEnd) thisWeekTotal += a;
        if (d >= lwStart && d <= lwEnd) lastWeekTotal += a;
      }
    }

    let weekPctVsLast = 0;
    if (lastWeekTotal === 0) {
      weekPctVsLast = thisWeekTotal > 0 ? 100 : 0;
    } else {
      weekPctVsLast =
        ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
    }

    const dim = daysInMonth(selectedMonth);
    const dailyAvg = dim > 0 ? monthTotal / dim : 0;

    let highest = null;
    for (const e of monthList) {
      const a = e.amount || 0;
      if (!highest || a > highest.amount) highest = { ...e, amount: a };
    }

    const streak = computeStreak(expenses, today);

    const byCat = new Map();
    for (const e of monthList) {
      const id = e.category ?? 'miscellaneous';
      byCat.set(id, (byCat.get(id) || 0) + (e.amount || 0));
    }
    const topCategories = [...byCat.entries()]
      .map(([categoryId, value]) => ({
        categoryId,
        value,
        name: resolveCategory(categoryId, customCategories).name,
        color: getCategoryColor(categoryId),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const sortedMonth = [...monthList]
      .filter((e) => e.date)
      .sort((a, b) => {
        const da = a.date.slice(0, 10);
        const db = b.date.slice(0, 10);
        if (da !== db) return db.localeCompare(da);
        return String(b.id ?? '').localeCompare(String(a.id ?? ''));
      });
    const recentFive = sortedMonth.slice(0, 5);

    const budget = settings.monthlyBudget || 0;
    const budgetSpent = monthTotal;
    const budgetPct = budget > 0 ? (budgetSpent / budget) * 100 : 0;

    return {
      monthTotal,
      todayTotal,
      yesterdayTotal,
      vsYesterday,
      thisWeekTotal,
      lastWeekTotal,
      weekPctVsLast,
      dailyAvg,
      highest,
      streak,
      topCategories,
      recentFive,
      budget,
      budgetSpent,
      budgetPct,
    };
  }, [
    expenses,
    selectedMonth,
    getMonthExpenses,
    getTotalForMonth,
    customCategories,
    settings.monthlyBudget,
    today,
    yesterday,
  ]);

  const goMonth = (delta) => {
    dispatch({ type: 'SET_SELECTED_MONTH', payload: shiftYearMonth(selectedMonth, delta) });
  };

  const openExpense = (expense) => {
    dispatch({ type: 'SET_EDITING_EXPENSE', payload: expense });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'add' });
  };

  const budgetBarColor =
    dashboardStats.budgetPct < 60
      ? 'bg-emerald-500'
      : dashboardStats.budgetPct <= 80
        ? 'bg-amber-500'
        : 'bg-red-500';

  const budgetRemaining = dashboardStats.budget - dashboardStats.budgetSpent;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={`text-2xl font-semibold tracking-tight ${textPrimary}`}>
          Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="rounded-xl border border-gray-200 bg-white p-2 dark:border-[#2D3148] dark:bg-[#222536] dark:text-[#F1F5F9]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span
            className={`min-w-[10rem] text-center text-sm font-medium ${textPrimary}`}
          >
            {monthLabel(selectedMonth)}
          </span>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="rounded-xl border border-gray-200 bg-white p-2 dark:border-[#2D3148] dark:bg-[#222536] dark:text-[#F1F5F9]"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className={cardClass}>
        <p className={`text-sm font-medium ${textSecondary}`}>Today&apos;s Spending</p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${textPrimary} animate-countUp`}
        >
          {sym}
          {formatAmount(dashboardStats.todayTotal, currency)}
        </p>
        <p
          className={`mt-2 text-sm ${
            dashboardStats.vsYesterday > 0
              ? 'text-red-500'
              : dashboardStats.vsYesterday < 0
                ? 'text-emerald-500'
                : textMuted
          }`}
        >
          {dashboardStats.vsYesterday === 0
            ? 'Same as yesterday'
            : `${dashboardStats.vsYesterday > 0 ? '+' : ''}${sym}${formatAmount(Math.abs(dashboardStats.vsYesterday), currency)} vs yesterday`}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cardClass}>
          <p className={`text-sm ${textSecondary}`}>This week</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${textPrimary}`}>
            {sym}
            {formatAmount(dashboardStats.thisWeekTotal, currency)}
          </p>
          <p className={`mt-1 text-xs ${textMuted}`}>
            {dashboardStats.lastWeekTotal === 0 && dashboardStats.thisWeekTotal === 0
              ? 'No spend this week'
              : `${dashboardStats.weekPctVsLast >= 0 ? '+' : ''}${dashboardStats.weekPctVsLast.toFixed(0)}% vs last week`}
          </p>
        </div>
        <div className={cardClass}>
          <p className={`text-sm ${textSecondary}`}>This month</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${textPrimary}`}>
            {sym}
            {formatAmount(dashboardStats.monthTotal, currency)}
          </p>
          <p className={`mt-1 text-xs ${textMuted}`}>
            {sym}
            {formatAmount(dashboardStats.dailyAvg, currency)} / day avg
          </p>
        </div>
        <div className={cardClass}>
          <p className={`text-sm ${textSecondary}`}>Highest expense</p>
          {dashboardStats.highest ? (
            <>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${textPrimary}`}>
                {sym}
                {formatAmount(dashboardStats.highest.amount, currency)}
              </p>
              <p className={`mt-1 text-xs ${textMuted}`}>
                {resolveCategory(dashboardStats.highest.category, customCategories).name}
              </p>
            </>
          ) : (
            <p className={`mt-2 text-sm ${textMuted}`}>No expenses this month</p>
          )}
        </div>
        <div className={cardClass}>
          <p className={`text-sm ${textSecondary}`}>Tracking streak</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${textPrimary}`}>
            {dashboardStats.streak}{' '}
            <span className="text-base font-normal text-gray-500 dark:text-[#9CA3AF]">
              day{dashboardStats.streak === 1 ? '' : 's'}
            </span>
          </p>
          <p className={`mt-1 text-xs ${textMuted}`}>
            Consecutive days with an expense
          </p>
        </div>
      </div>

      {dashboardStats.budget > 0 && (
        <section className={cardClass}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={`text-sm font-medium ${textSecondary}`}>Budget progress</p>
            <p className={`text-sm tabular-nums ${textPrimary}`}>
              {sym}
              {formatAmount(dashboardStats.budgetSpent, currency)} of {sym}
              {formatAmount(dashboardStats.budget, currency)} spent
            </p>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#2D3148]">
            <div
              className={`h-full rounded-full transition-all ${budgetBarColor}`}
              style={{
                width: `${Math.min(100, dashboardStats.budgetPct)}%`,
              }}
            />
          </div>
          <p className={`mt-2 text-sm ${textMuted}`}>
            {budgetRemaining >= 0 ? (
              <>
                {sym}
                {formatAmount(budgetRemaining, currency)} remaining
              </>
            ) : (
              <>
                Over budget by {sym}
                {formatAmount(Math.abs(budgetRemaining), currency)}
              </>
            )}
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className={`mb-4 text-sm font-semibold ${textPrimary}`}>
            Top categories
          </h2>
          {dashboardStats.topCategories.length === 0 ? (
            <p className={`text-sm ${textMuted}`}>
              No category data for this month.
            </p>
          ) : (
            <>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardStats.topCategories}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {dashboardStats.topCategories.map((entry, i) => (
                        <Cell key={entry.categoryId + i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2">
                {dashboardStats.topCategories.map((row) => (
                  <li
                    key={row.categoryId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className={textPrimary}>{row.name}</span>
                    </span>
                    <span className={`tabular-nums ${textSecondary}`}>
                      {sym}
                      {formatAmount(row.value, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={cardClass}>
          <h2 className={`mb-4 text-sm font-semibold ${textPrimary}`}>
            Recent transactions
          </h2>
          {dashboardStats.recentFive.length === 0 ? (
            <p className={`text-sm ${textMuted}`}>
              No expenses yet. Tap + to add your first!
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-[#2D3148]">
              {dashboardStats.recentFive.map((e) => {
                const cat = resolveCategory(e.category, customCategories);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => openExpense(e)}
                      className="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-90"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${cat.color}33` }}
                      >
                        <IconRenderer
                          name={cat.icon}
                          size={20}
                          className="text-white"
                          style={{ color: cat.color }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-medium ${textPrimary}`}>
                          {e.note?.trim() ||
                            e.subcategory ||
                            cat.name}
                        </p>
                        <p className={`truncate text-xs ${textMuted}`}>
                          {cat.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`font-semibold tabular-nums ${textPrimary}`}>
                          {sym}
                          {formatAmount(e.amount, currency)}
                        </span>
                        <span
                          className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:bg-[#2D3148] dark:text-[#9CA3AF]"
                        >
                          {paymentModeLabel(e.paymentMode)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
