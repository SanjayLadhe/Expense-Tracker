import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import {
  DEFAULT_CATEGORIES,
  CURRENCY_SYMBOLS,
  getCategoryById,
  getCategoryColor,
} from '../lib/categories.js';
import IconRenderer from './IconRenderer.jsx';

const cardClass =
  'dark:bg-[#222536] bg-white dark:border-[#2D3148] border-gray-200 rounded-2xl border p-5';
const inputClass =
  'dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6]';

const DEFAULT_GOAL_CLEAR = {
  targetAmount: 0,
  currentAmount: 0,
  targetDate: '',
  name: '',
};

function parseYearMonth(ym) {
  const [y, m] = (ym || '').split('-').map(Number);
  if (!y || !m) return null;
  return { y, m };
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/** Month context relative to real "today" for selected YYYY-MM */
function getMonthDayContext(selectedMonth) {
  const parsed = parseYearMonth(selectedMonth);
  if (!parsed) {
    return {
      daysInMonth: 30,
      daysElapsed: 1,
      remainingDays: 30,
      isPast: false,
      isFuture: false,
    };
  }
  const { y, m } = parsed;
  const dim = daysInMonth(y, m);
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const key = y * 100 + m;
  const currentKey = cy * 100 + cm;

  if (key < currentKey) {
    return {
      daysInMonth: dim,
      daysElapsed: dim,
      remainingDays: 0,
      isPast: true,
      isFuture: false,
    };
  }
  if (key > currentKey) {
    return {
      daysInMonth: dim,
      daysElapsed: 0,
      remainingDays: dim,
      isPast: false,
      isFuture: true,
    };
  }
  const day = now.getDate();
  return {
    daysInMonth: dim,
    daysElapsed: Math.max(1, day),
    remainingDays: Math.max(0, dim - day + 1),
    isPast: false,
    isFuture: false,
  };
}

function formatMoney(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] ?? '₹';
  const n = Number(amount) || 0;
  return `${sym}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatMoneyPlain(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function getSpendSeverity(pct) {
  if (pct > 100) return 'over';
  if (pct >= 80) return 'high';
  if (pct >= 60) return 'mid';
  return 'ok';
}

function ringColorForOverall(pct) {
  if (pct < 60) return '#22C55E';
  if (pct <= 80) return '#EAB308';
  return '#EF4444';
}

function barColorForPct(pct) {
  if (pct > 100) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-500';
  if (pct >= 60) return 'bg-yellow-400';
  return 'bg-emerald-500';
}

function resolveCategory(id, allCategories) {
  return allCategories.find((c) => c.id === id) ?? getCategoryById(id);
}

function CircularProgressRing({
  size = 200,
  strokeWidth = 14,
  progress,
  color,
  label,
  sublabel,
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(Math.max(progress, 0), 1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const offset = mounted ? c * (1 - p) : c;

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-gray-200 dark:stroke-[#2D3148]"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="text-2xl font-bold tabular-nums dark:text-[#F1F5F9] text-gray-900">
          {label}
        </span>
        {sublabel ? (
          <span className="text-xs dark:text-gray-400 text-gray-500 mt-0.5">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function AlertBanner({ severity, title, body }) {
  const isRed = severity === 'over';
  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        isRed
          ? 'border-red-500/40 bg-red-500/10 dark:bg-red-950/30'
          : 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/25'
      }`}
    >
      <AlertTriangle
        className={`shrink-0 mt-0.5 ${isRed ? 'text-red-500' : 'text-amber-500'}`}
        size={22}
      />
      <div>
        <p
          className={`font-semibold ${isRed ? 'text-red-600 dark:text-red-400' : 'text-amber-800 dark:text-amber-200'}`}
        >
          {title}
        </p>
        {body ? (
          <p className="text-sm mt-1 dark:text-gray-300 text-gray-700">{body}</p>
        ) : null}
      </div>
    </div>
  );
}

function CategoryBudgetsPanel({
  initialCategoryBudgets,
  allCategories,
  selectedMonth,
  currency,
  dispatch,
  addToast,
  getCategoryTotal,
}) {
  const sym = CURRENCY_SYMBOLS[currency] ?? '₹';
  const [localCategoryBudgets, setLocalCategoryBudgets] = useState(() => ({
    ...initialCategoryBudgets,
  }));
  const [categoryDirty, setCategoryDirty] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const trackedCategoryIds = useMemo(() => Object.keys(localCategoryBudgets), [localCategoryBudgets]);

  const unbudgetedCategories = useMemo(() => {
    return allCategories.filter((c) => !trackedCategoryIds.includes(c.id));
  }, [allCategories, trackedCategoryIds]);

  const handleSaveCategoryBudgets = () => {
    const next = {};
    for (const [k, v] of Object.entries(localCategoryBudgets)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) next[k] = n;
    }
    dispatch({ type: 'SET_SETTINGS', payload: { categoryBudgets: next } });
    setCategoryDirty(false);
    addToast('Category budgets saved');
  };

  const updateLocalCatBudget = (id, raw) => {
    setLocalCategoryBudgets((prev) => ({ ...prev, [id]: raw }));
    setCategoryDirty(true);
  };

  const removeCategoryBudget = (id) => {
    setLocalCategoryBudgets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCategoryDirty(true);
  };

  const addCategoryToBudget = (id) => {
    setLocalCategoryBudgets((prev) => ({ ...prev, [id]: '' }));
    setCategoryDirty(true);
    setAddPickerOpen(false);
  };

  return (
    <div className={cardClass}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900">
          Category budgets
        </h2>
        <div className="flex flex-wrap gap-2">
          {unbudgetedCategories.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddPickerOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-xl border dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
              >
                <Plus size={18} />
                Add Category Budget
              </button>
              {addPickerOpen && (
                <div className="absolute right-0 top-full mt-2 z-20 w-64 max-h-56 overflow-auto rounded-xl border dark:border-[#2D3148] border-gray-200 dark:bg-[#1A1D28] bg-white shadow-lg py-1">
                  {unbudgetedCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addCategoryToBudget(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm dark:text-gray-200 text-gray-800 hover:bg-gray-100 dark:hover:bg-[#222536]"
                    >
                      <IconRenderer name={c.icon} size={18} style={{ color: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={!categoryDirty}
            onClick={handleSaveCategoryBudgets}
            className="rounded-xl bg-[#3B82F6] text-white font-medium px-4 py-2.5 text-sm disabled:opacity-40 disabled:pointer-events-none hover:bg-blue-600"
          >
            Save changes
          </button>
        </div>
      </div>

      {trackedCategoryIds.length === 0 ? (
        <p className="dark:text-gray-400 text-gray-600 text-sm">
          No category budgets yet. Use &quot;Add Category Budget&quot; to track spending per
          category.
        </p>
      ) : (
        <ul className="space-y-4">
          {trackedCategoryIds.map((id) => {
            const cat = resolveCategory(id, allCategories);
            const cap = Number(localCategoryBudgets[id]) || 0;
            const catSpent = getCategoryTotal(id, selectedMonth);
            const pct = cap > 0 ? (catSpent / cap) * 100 : 0;
            const barPct = Math.min(100, pct);
            const color = getCategoryColor(id);
            return (
              <li
                key={id}
                className="rounded-xl border dark:border-[#2D3148] border-gray-200 dark:bg-[#1A1D28]/50 bg-gray-50/80 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl dark:bg-[#222536] bg-white border dark:border-[#2D3148] border-gray-200"
                      style={{ color }}
                    >
                      <IconRenderer name={cat?.icon} size={20} />
                    </div>
                    <span className="font-medium dark:text-[#F1F5F9] text-gray-900 truncate">
                      {cat?.name ?? id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:w-40">
                    <span className="text-sm dark:text-gray-400 text-gray-600 shrink-0">
                      {sym}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={localCategoryBudgets[id]}
                      onChange={(e) => updateLocalCatBudget(id, e.target.value)}
                      className={`${inputClass} py-2 text-sm w-full`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCategoryBudget(id)}
                    className="p-2 rounded-lg self-start sm:self-center text-red-500 hover:bg-red-500/10"
                    aria-label={`Remove budget for ${cat?.name ?? id}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-[#2D3148] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColorForPct(pct)}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="text-xs dark:text-gray-400 text-gray-600 tabular-nums">
                    Spent {formatMoney(catSpent, currency)} / {formatMoney(cap, currency)} (
                    {Math.round(pct)}%)
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Budgets() {
  const {
    settings,
    savingsGoal,
    selectedMonth,
    dispatch,
    addToast,
    getTotalForMonth,
    getCategoryTotal,
    customCategories,
  } = useApp();

  const currency = settings.currency ?? 'INR';
  const sym = CURRENCY_SYMBOLS[currency] ?? '₹';
  const monthlyBudget = Number(settings.monthlyBudget) || 0;

  const allCategories = useMemo(() => {
    const byId = new Map();
    for (const c of DEFAULT_CATEGORIES) byId.set(c.id, c);
    for (const c of customCategories || []) byId.set(c.id, c);
    return [...byId.values()];
  }, [customCategories]);

  const spent = getTotalForMonth(selectedMonth);
  const monthCtx = useMemo(() => getMonthDayContext(selectedMonth), [selectedMonth]);

  const overallPct = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;
  const overallSeverity = getSpendSeverity(overallPct);
  const ringColor = ringColorForOverall(overallPct);

  const projected =
    monthCtx.daysElapsed > 0
      ? (spent / monthCtx.daysElapsed) * monthCtx.daysInMonth
      : null;
  const projectedOver =
    projected != null && monthlyBudget > 0 && projected > monthlyBudget;

  const dailyAllowance =
    monthCtx.remainingDays > 0 && monthlyBudget > 0
      ? (monthlyBudget - spent) / monthCtx.remainingDays
      : null;

  const [budgetDraft, setBudgetDraft] = useState('');
  const [editingOverall, setEditingOverall] = useState(false);
  const [overallEditValue, setOverallEditValue] = useState('');

  const categoryBudgetsKey = useMemo(
    () => JSON.stringify(settings.categoryBudgets ?? {}),
    [settings.categoryBudgets]
  );

  const categoryAlerts = useMemo(() => {
    const list = [];
    const budgets = settings.categoryBudgets ?? {};
    for (const id of Object.keys(budgets)) {
      const cap = Number(budgets[id]) || 0;
      if (cap <= 0) continue;
      const catSpent = getCategoryTotal(id, selectedMonth);
      const pct = (catSpent / cap) * 100;
      if (pct >= 80) {
        const cat = resolveCategory(id, allCategories);
        list.push({
          id,
          name: cat?.name ?? id,
          pct,
          severity: pct > 100 ? 'over' : 'high',
          spent: catSpent,
          cap,
        });
      }
    }
    return list;
  }, [settings.categoryBudgets, getCategoryTotal, selectedMonth, allCategories]);

  const setMonthlyBudget = useCallback(
    (n) => {
      const v = Math.max(0, Math.floor(Number(n) || 0));
      dispatch({ type: 'SET_SETTINGS', payload: { monthlyBudget: v } });
      addToast(v ? 'Monthly budget updated' : 'Monthly budget cleared');
    },
    [dispatch, addToast]
  );

  const handleSetBudget = () => {
    const v = Number(String(budgetDraft).replace(/,/g, ''));
    if (!Number.isFinite(v) || v <= 0) {
      addToast('Enter a valid budget amount', 'error');
      return;
    }
    setMonthlyBudget(v);
    setBudgetDraft('');
  };

  const goalActive = savingsGoal && Number(savingsGoal.targetAmount) > 0;

  const [goalForm, setGoalForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
  });
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressAdd, setProgressAdd] = useState('');
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [editGoalForm, setEditGoalForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    currentAmount: '',
  });

  const openEditGoal = () => {
    setEditGoalForm({
      name: savingsGoal.name || '',
      targetAmount: String(savingsGoal.targetAmount ?? ''),
      targetDate: savingsGoal.targetDate || '',
      currentAmount: String(savingsGoal.currentAmount ?? ''),
    });
    setEditGoalOpen(true);
  };

  const handleCreateGoal = () => {
    const name = goalForm.name.trim();
    const targetAmount = Math.floor(Number(String(goalForm.targetAmount).replace(/,/g, '')));
    if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      addToast('Fill goal name and a valid target amount', 'error');
      return;
    }
    dispatch({
      type: 'SET_SAVINGS_GOAL',
      payload: {
        name,
        targetAmount,
        targetDate: goalForm.targetDate || '',
        currentAmount: 0,
      },
    });
    setGoalForm({ name: '', targetAmount: '', targetDate: '' });
    addToast('Savings goal created');
  };

  const handleUpdateProgress = () => {
    const add = Number(String(progressAdd).replace(/,/g, ''));
    if (!Number.isFinite(add) || add === 0) {
      addToast('Enter an amount to add', 'error');
      return;
    }
    const next = Math.max(0, Number(savingsGoal.currentAmount || 0) + add);
    dispatch({
      type: 'SET_SAVINGS_GOAL',
      payload: { currentAmount: next },
    });
    setProgressAdd('');
    setProgressModalOpen(false);
    addToast('Progress updated');
  };

  const handleSaveEditGoal = () => {
    const name = editGoalForm.name.trim();
    const targetAmount = Math.floor(
      Number(String(editGoalForm.targetAmount).replace(/,/g, ''))
    );
    const currentAmount = Math.max(
      0,
      Math.floor(Number(String(editGoalForm.currentAmount).replace(/,/g, '')))
    );
    if (!name || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      addToast('Invalid goal details', 'error');
      return;
    }
    dispatch({
      type: 'SET_SAVINGS_GOAL',
      payload: {
        name,
        targetAmount,
        targetDate: editGoalForm.targetDate || '',
        currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
      },
    });
    setEditGoalOpen(false);
    addToast('Goal updated');
  };

  const handleDeleteGoal = () => {
    dispatch({ type: 'SET_SAVINGS_GOAL', payload: { ...DEFAULT_GOAL_CLEAR } });
    addToast('Savings goal removed');
  };

  const goalCurrent = Number(savingsGoal?.currentAmount) || 0;
  const goalTarget = Number(savingsGoal?.targetAmount) || 1;
  const goalPct = Math.min(1, goalCurrent / goalTarget);

  let goalDaysLeft = null;
  if (savingsGoal?.targetDate) {
    const end = new Date(savingsGoal.targetDate);
    if (!Number.isNaN(end.getTime())) {
      const diff = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
      goalDaysLeft = diff;
    }
  }

  const showOverallAlert = monthlyBudget > 0 && overallPct >= 80;

  return (
    <div className="space-y-6">
      {(showOverallAlert || categoryAlerts.length > 0) && (
        <div className="space-y-3">
          {showOverallAlert && (
            <AlertBanner
              severity={overallSeverity === 'over' ? 'over' : 'high'}
              title={
                overallPct > 100
                  ? 'Over monthly budget'
                  : 'Monthly budget warning'
              }
              body={
                overallPct > 100
                  ? `You've spent ${formatMoney(spent, currency)} of ${formatMoney(monthlyBudget, currency)} (${Math.round(overallPct)}%).`
                  : `You've used about ${Math.round(overallPct)}% of your monthly budget (${formatMoney(spent, currency)} of ${formatMoney(monthlyBudget, currency)}).`
              }
            />
          )}
          {categoryAlerts.map((a) => (
            <AlertBanner
              key={a.id}
              severity={a.severity}
              title={
                a.pct > 100
                  ? `${a.name} is over budget`
                  : `${a.name} nearing budget limit`
              }
              body={`Spent ${formatMoney(a.spent, currency)} of ${formatMoney(a.cap, currency)} (${Math.round(a.pct)}%).`}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall monthly budget */}
        <div className={cardClass}>
          <h2 className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900 mb-4">
            Monthly budget
          </h2>

          {monthlyBudget <= 0 ? (
            <div className="space-y-4">
              <p className="dark:text-gray-400 text-gray-600">
                Set Your Monthly Budget
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-medium dark:text-gray-300 text-gray-700">
                  {sym}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  className={`${inputClass} flex-1 text-2xl font-semibold`}
                />
              </div>
              <button
                type="button"
                onClick={handleSetBudget}
                className="w-full rounded-xl bg-[#3B82F6] text-white font-medium py-3 hover:bg-blue-600 transition-colors"
              >
                Set Budget
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                <div className="mx-auto sm:mx-0">
                  <CircularProgressRing
                    size={180}
                    strokeWidth={12}
                    progress={overallPct / 100}
                    color={ringColor}
                    label={`${Math.min(999, Math.round(overallPct))}%`}
                    sublabel="of budget used"
                  />
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  {editingOverall ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{sym}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={overallEditValue}
                        onChange={(e) => setOverallEditValue(e.target.value)}
                        className={`${inputClass} max-w-[200px]`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = Math.floor(
                            Number(String(overallEditValue).replace(/,/g, ''))
                          );
                          if (Number.isFinite(v) && v > 0) {
                            setMonthlyBudget(v);
                            setEditingOverall(false);
                          } else {
                            addToast('Enter a valid amount', 'error');
                          }
                        }}
                        className="rounded-lg bg-[#3B82F6] text-white px-4 py-2 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOverall(false)}
                        className="rounded-lg border dark:border-[#2D3148] border-gray-300 px-4 py-2 text-sm dark:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm dark:text-gray-400 text-gray-600">
                          Spent / Budget
                        </p>
                        <p className="text-xl font-semibold dark:text-white text-gray-900 tabular-nums">
                          {formatMoney(spent, currency)} /{' '}
                          {formatMoney(monthlyBudget, currency)}
                        </p>
                        <p className="mt-2 text-sm dark:text-gray-300 text-gray-700">
                          Remaining:{' '}
                          <span className="font-medium tabular-nums">
                            {formatMoney(monthlyBudget - spent, currency)}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOverallEditValue(String(monthlyBudget));
                          setEditingOverall(true);
                        }}
                        className="p-2 rounded-lg border dark:border-[#2D3148] border-gray-200 dark:text-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
                        aria-label="Edit monthly budget"
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl dark:bg-[#1A1D28] bg-gray-50 p-4 border dark:border-[#2D3148] border-gray-200">
                    <p className="text-xs font-medium uppercase tracking-wide dark:text-gray-500 text-gray-500">
                      Projected month-end spend
                    </p>
                    {projected != null ? (
                      <>
                        <p className="text-lg font-semibold tabular-nums dark:text-[#F1F5F9] text-gray-900 mt-1">
                          {formatMoney(projected, currency)}
                        </p>
                        {projectedOver && (
                          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={14} />
                            Projected to exceed your budget
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm dark:text-gray-400 text-gray-600 mt-1">
                        Not enough data for this month yet
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl dark:bg-[#1A1D28] bg-gray-50 p-4 border dark:border-[#2D3148] border-gray-200">
                    <p className="text-xs font-medium uppercase tracking-wide dark:text-gray-500 text-gray-500">
                      Daily allowance
                    </p>
                    {dailyAllowance != null && !monthCtx.isPast ? (
                      <p className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900 mt-1">
                        You can spend{' '}
                        <span className="text-[#3B82F6] tabular-nums">
                          {sym}
                          {formatMoneyPlain(Math.max(0, dailyAllowance))}
                        </span>{' '}
                        per day
                      </p>
                    ) : (
                      <p className="text-sm dark:text-gray-400 text-gray-600 mt-1">
                        {monthCtx.isPast
                          ? 'This month has ended.'
                          : 'No remaining days to spread spend.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Savings goal */}
        <div className={cardClass}>
          <h2 className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900 mb-4">
            Savings goal
          </h2>

          {!goalActive ? (
            <div className="space-y-4">
              <p className="dark:text-gray-400 text-gray-600">Set a Savings Goal</p>
              <input
                type="text"
                placeholder="Goal name"
                value={goalForm.name}
                onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
                className={`${inputClass} w-full`}
              />
              <div className="flex items-center gap-2">
                <span className="text-lg">{sym}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Target amount"
                  value={goalForm.targetAmount}
                  onChange={(e) =>
                    setGoalForm((f) => ({ ...f, targetAmount: e.target.value }))
                  }
                  className={`${inputClass} flex-1`}
                />
              </div>
              <input
                type="date"
                value={goalForm.targetDate}
                onChange={(e) =>
                  setGoalForm((f) => ({ ...f, targetDate: e.target.value }))
                }
                className={`${inputClass} w-full`}
              />
              <button
                type="button"
                onClick={handleCreateGoal}
                className="w-full rounded-xl bg-[#3B82F6] text-white font-medium py-3 hover:bg-blue-600 transition-colors"
              >
                Create Goal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                <div className="mx-auto sm:mx-0">
                  <CircularProgressRing
                    size={180}
                    strokeWidth={12}
                    progress={goalPct}
                    color="#3B82F6"
                    label={`${Math.round(goalPct * 100)}%`}
                    sublabel="saved"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="text-xl font-semibold dark:text-[#F1F5F9] text-gray-900">
                    {savingsGoal.name?.trim() || 'Savings goal'}
                  </h3>
                  <p className="text-lg tabular-nums dark:text-gray-200 text-gray-800">
                    {formatMoney(goalCurrent, currency)} saved of{' '}
                    {formatMoney(goalTarget, currency)}
                  </p>
                  {savingsGoal.targetDate && (
                    <p className="text-sm dark:text-gray-400 text-gray-600">
                      Target: {savingsGoal.targetDate}
                      {goalDaysLeft != null && (
                        <span className="ml-2">
                          (
                          {goalDaysLeft > 0
                            ? `${goalDaysLeft} days left`
                            : goalDaysLeft === 0
                              ? 'Due today'
                              : `${Math.abs(goalDaysLeft)} days overdue`}
                          )
                        </span>
                      )}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setProgressModalOpen(true)}
                      className="rounded-xl bg-[#3B82F6] text-white font-medium px-4 py-2.5 text-sm hover:bg-blue-600"
                    >
                      Update Progress
                    </button>
                    <button
                      type="button"
                      onClick={openEditGoal}
                      className="rounded-xl border dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800 font-medium px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
                    >
                      Edit Goal
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteGoal}
                      className="rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 font-medium px-4 py-2.5 text-sm inline-flex items-center gap-1 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                      Delete Goal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <CategoryBudgetsPanel
        key={categoryBudgetsKey}
        initialCategoryBudgets={settings.categoryBudgets ?? {}}
        allCategories={allCategories}
        selectedMonth={selectedMonth}
        currency={currency}
        dispatch={dispatch}
        addToast={addToast}
        getCategoryTotal={getCategoryTotal}
      />

      {progressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className={`${cardClass} max-w-md w-full relative`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-modal-title"
          >
            <button
              type="button"
              onClick={() => setProgressModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg dark:text-gray-400 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1A1D28]"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h3
              id="progress-modal-title"
              className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900 mb-4"
            >
              Add to savings
            </h3>
            <p className="text-sm dark:text-gray-400 text-gray-600 mb-3">
              Amount to add to your current progress ({formatMoney(goalCurrent, currency)})
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span>{sym}</span>
              <input
                type="text"
                inputMode="decimal"
                value={progressAdd}
                onChange={(e) => setProgressAdd(e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="0"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setProgressModalOpen(false)}
                className="rounded-xl border dark:border-[#2D3148] border-gray-300 px-4 py-2 text-sm dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateProgress}
                className="rounded-xl bg-[#3B82F6] text-white px-4 py-2 text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {editGoalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            className={`${cardClass} max-w-md w-full relative`}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setEditGoalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg dark:text-gray-400 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1A1D28]"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900 mb-4">
              Edit goal
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editGoalForm.name}
                onChange={(e) =>
                  setEditGoalForm((f) => ({ ...f, name: e.target.value }))
                }
                className={`${inputClass} w-full`}
                placeholder="Goal name"
              />
              <div className="flex items-center gap-2">
                <span>{sym}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editGoalForm.targetAmount}
                  onChange={(e) =>
                    setEditGoalForm((f) => ({ ...f, targetAmount: e.target.value }))
                  }
                  className={`${inputClass} flex-1`}
                  placeholder="Target"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm w-24 dark:text-gray-400">Saved</span>
                <span>{sym}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editGoalForm.currentAmount}
                  onChange={(e) =>
                    setEditGoalForm((f) => ({ ...f, currentAmount: e.target.value }))
                  }
                  className={`${inputClass} flex-1`}
                />
              </div>
              <input
                type="date"
                value={editGoalForm.targetDate}
                onChange={(e) =>
                  setEditGoalForm((f) => ({ ...f, targetDate: e.target.value }))
                }
                className={`${inputClass} w-full`}
              />
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => setEditGoalOpen(false)}
                className="rounded-xl border dark:border-[#2D3148] border-gray-300 px-4 py-2 text-sm dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditGoal}
                className="rounded-xl bg-[#3B82F6] text-white px-4 py-2 text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
