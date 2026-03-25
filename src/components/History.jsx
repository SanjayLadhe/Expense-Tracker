import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, Trash2, ChevronDown, Receipt } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import {
  DEFAULT_CATEGORIES,
  PAYMENT_MODES,
  CURRENCY_SYMBOLS,
  getCategoryById,
} from '../lib/categories.js';
import IconRenderer from './IconRenderer.jsx';

const CARD =
  'dark:bg-[#222536] bg-white dark:border-[#2D3148] border-gray-200 rounded-2xl border';
const INPUT =
  'dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6]';
const TEXT_PRIMARY = 'dark:text-[#F1F5F9] text-gray-900';
const TEXT_SECONDARY = 'dark:text-[#9CA3AF] text-gray-500';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'amount-desc', label: 'Highest Amount' },
  { value: 'amount-asc', label: 'Lowest Amount' },
];

const PAGE_SIZE = 50;

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function expenseDateKey(e) {
  const raw = e?.date;
  if (!raw) return '';
  return typeof raw === 'string' ? raw.slice(0, 10) : toLocalISODate(new Date(raw));
}

function resolveCategory(id, customCategories) {
  const c = customCategories?.find((x) => x.id === id);
  if (c) return c;
  return getCategoryById(id);
}

function tagsString(tags) {
  if (tags == null) return '';
  if (Array.isArray(tags)) return tags.join(' ');
  return String(tags);
}

function matchesSearch(expense, q, categoryName) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const parts = [
    expense.note,
    categoryName,
    expense.subcategory,
    expense.subCategory,
    tagsString(expense.tags),
    String(expense.amount ?? ''),
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  return parts.some((p) => p.includes(s));
}

function activeFilterCount(filters) {
  let n = 0;
  if (filters.category) n += 1;
  if (filters.paymentMode) n += 1;
  const dr = filters.dateRange;
  if (dr && (dr.start || dr.end)) n += 1;
  if (filters.amountMin != null && filters.amountMin !== '') n += 1;
  if (filters.amountMax != null && filters.amountMax !== '') n += 1;
  return n;
}

function getGroupForExpense(dateStr, now = new Date()) {
  const exp = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
    return { sectionOrder: 99, groupId: 'unknown', label: 'Unknown date' };
  }

  const todayStr = toLocalISODate(now);
  const yday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayStr = toLocalISODate(yday);
  const monday = startOfWeekMonday(now);
  const weekStartStr = toLocalISODate(monday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekEndStr = toLocalISODate(sunday);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (exp === todayStr) {
    return { sectionOrder: 0, groupId: 'today', label: 'Today' };
  }
  if (exp === yesterdayStr) {
    return { sectionOrder: 1, groupId: 'yesterday', label: 'Yesterday' };
  }
  if (exp >= weekStartStr && exp <= weekEndStr) {
    return { sectionOrder: 2, groupId: 'this-week', label: 'This Week' };
  }
  if (exp.startsWith(monthPrefix)) {
    return { sectionOrder: 3, groupId: 'earlier-month', label: 'Earlier this Month' };
  }

  const ym = exp.slice(0, 7);
  const [ey, em] = ym.split('-').map(Number);
  const label = new Date(ey, em - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  return { sectionOrder: 4, groupId: `month-${ym}`, label, monthKey: ym };
}

function compareMonthKeysDesc(a, b) {
  return b.localeCompare(a);
}

function compareExpenses(a, b, sortBy) {
  const da = expenseDateKey(a);
  const db = expenseDateKey(b);
  const aa = Number(a.amount) || 0;
  const ba = Number(b.amount) || 0;
  switch (sortBy) {
    case 'date-asc':
      return da.localeCompare(db);
    case 'date-desc':
      return db.localeCompare(da);
    case 'amount-asc':
      return aa - ba;
    case 'amount-desc':
      return ba - aa;
    default:
      return db.localeCompare(da);
  }
}

export default function History() {
  const {
    expenses,
    customCategories,
    settings,
    searchQuery,
    filters,
    sortBy,
    selectedMonth,
    dispatch,
    deleteExpense,
    bulkDeleteExpenses,
    addToast,
    getCurrentMonthExpenses,
  } = useApp();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmingId, setConfirmingId] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: localSearch });
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, dispatch]);

  const sym = CURRENCY_SYMBOLS[settings.currency] || '₹';

  const formatMoney = useCallback(
    (amount) => `${sym}${Number(amount || 0).toLocaleString('en-IN')}`,
    [sym]
  );

  const filteredSorted = useMemo(() => {
    const base =
      selectedMonth === 'all' ? expenses : getCurrentMonthExpenses();

    const q = (searchQuery || '').trim().toLowerCase();

    let list = base.filter((e) => {
      const cat = resolveCategory(e.category, customCategories);
      const categoryName = cat?.name ?? '';

      if (q && !matchesSearch(e, q, categoryName)) return false;

      if (filters.category && e.category !== filters.category) return false;

      const pay = e.paymentMode ?? e.payment;
      if (filters.paymentMode && pay !== filters.paymentMode) return false;

      const dKey = expenseDateKey(e);
      const dr = filters.dateRange;
      if (dr && (dr.start || dr.end)) {
        if (!dKey) return false;
        if (dr.start && dKey < dr.start) return false;
        if (dr.end && dKey > dr.end) return false;
      }

      const amt = Number(e.amount) || 0;
      if (filters.amountMin !== null && filters.amountMin !== '') {
        const min = Number(filters.amountMin);
        if (!Number.isNaN(min) && amt < min) return false;
      }
      if (filters.amountMax !== null && filters.amountMax !== '') {
        const max = Number(filters.amountMax);
        if (!Number.isNaN(max) && amt > max) return false;
      }

      return true;
    });

    list.sort((a, b) => compareExpenses(a, b, sortBy));

    return list;
  }, [
    expenses,
    customCategories,
    getCurrentMonthExpenses,
    selectedMonth,
    searchQuery,
    filters,
    sortBy,
  ]);

  const totalFilteredAmount = useMemo(
    () => filteredSorted.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredSorted]
  );

  const groupedSections = useMemo(() => {
    const now = new Date();
    const buckets = new Map();

    for (const e of filteredSorted) {
      const dKey = expenseDateKey(e);
      const meta = getGroupForExpense(dKey, now);
      const key = meta.groupId;
      if (!buckets.has(key)) {
        buckets.set(key, {
          ...meta,
          items: [],
        });
      }
      buckets.get(key).items.push(e);
    }

    for (const b of buckets.values()) {
      b.items.sort((a, c) => compareExpenses(a, c, sortBy));
    }

    const fixed = ['today', 'yesterday', 'this-week', 'earlier-month'];
    const sections = [];

    for (const id of fixed) {
      const b = buckets.get(id);
      if (b?.items.length) sections.push(b);
    }

    const monthKeys = [...buckets.keys()].filter(
      (k) => k.startsWith('month-') && !fixed.includes(k)
    );
    monthKeys.sort((a, b) => compareMonthKeysDesc(a.replace('month-', ''), b.replace('month-', '')));

    for (const k of monthKeys) {
      const b = buckets.get(k);
      if (b?.items.length) sections.push(b);
    }

    if (buckets.has('unknown')) {
      const b = buckets.get('unknown');
      if (b?.items.length) sections.push(b);
    }

    return sections;
  }, [filteredSorted, sortBy]);

  const flatVisible = useMemo(() => {
    const out = [];
    for (const sec of groupedSections) {
      for (const e of sec.items) out.push({ expense: e, section: sec });
    }
    return out;
  }, [groupedSections]);

  const visibleSlice = useMemo(
    () => flatVisible.slice(0, displayCount),
    [flatVisible, displayCount]
  );

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filteredSorted.length, searchQuery, filters, sortBy, selectedMonth]);

  const allFilteredIds = useMemo(
    () => filteredSorted.map((e) => e.id),
    [filteredSorted]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(allFilteredIds));
  };

  const cancelSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkConfirm(false);
  };

  const runBulkDelete = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    bulkDeleteExpenses(ids);
    addToast(`Deleted ${ids.length} expense(s)`, 'success');
    cancelSelection();
  };

  const openEdit = (expense) => {
    dispatch({ type: 'SET_EDITING_EXPENSE', payload: expense });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'add' });
  };

  const runDeleteOne = (id) => {
    deleteExpense(id);
    addToast('Expense deleted', 'success');
    setConfirmingId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const paymentName = (id) =>
    PAYMENT_MODES.find((p) => p.id === id)?.name ?? (id ? String(id) : '—');

  const filterBadge = activeFilterCount(filters);
  const hasActiveFilters = filterBadge > 0 || (searchQuery && searchQuery.trim());

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 md:pb-8 max-w-3xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className={`text-2xl font-semibold ${TEXT_PRIMARY}`}>Transactions</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectMode((m) => !m);
                setSelectedIds(new Set());
              }}
              className={`text-sm font-medium rounded-xl px-3 py-2 border dark:border-[#2D3148] border-gray-200 ${TEXT_SECONDARY} hover:opacity-90`}
            >
              {selectMode ? 'Done' : 'Select'}
            </button>
          </div>
        </div>
        <p className={`text-sm ${TEXT_SECONDARY}`}>
          {filteredSorted.length} expense{filteredSorted.length !== 1 ? 's' : ''} ·{' '}
          <span className="font-medium text-red-500 dark:text-red-400">
            {formatMoney(totalFilteredAmount)}
          </span>{' '}
          total
        </p>
      </header>

      <div className={`${CARD} p-4 flex items-center gap-3`}>
        <Search className={`shrink-0 w-5 h-5 ${TEXT_SECONDARY}`} aria-hidden />
        <input
          type="search"
          className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-base ${TEXT_PRIMARY} placeholder:text-gray-500 dark:placeholder:text-[#6B7280]`}
          placeholder="Search expenses..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          aria-label="Search expenses"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={`lg:hidden flex items-center justify-between gap-2 ${CARD} px-4 py-3`}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <span className={`flex items-center gap-2 font-medium ${TEXT_PRIMARY}`}>
            <Filter className="w-5 h-5" aria-hidden />
            Filters
            {filterBadge > 0 && (
              <span className="text-xs font-semibold rounded-full bg-[#3B82F6] text-white px-2 py-0.5 min-w-[1.25rem] text-center">
                {filterBadge}
              </span>
            )}
          </span>
          <ChevronDown
            className={`w-5 h-5 ${TEXT_SECONDARY} transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        <div
          className={`${filtersOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row lg:flex-wrap gap-3 lg:items-end ${CARD} p-4`}
        >
          <div className={`hidden lg:flex items-center gap-2 w-full pb-1`}>
            <Filter className={`w-5 h-5 ${TEXT_SECONDARY}`} aria-hidden />
            <span className={`font-semibold ${TEXT_PRIMARY}`}>Filters</span>
            {filterBadge > 0 && (
              <span className="text-xs font-semibold rounded-full bg-[#3B82F6] text-white px-2 py-0.5 min-w-[1.25rem] text-center">
                {filterBadge}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Category</label>
            <select
              className={`${INPUT} py-2 text-sm`}
              value={filters.category ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTERS',
                  payload: { category: e.target.value || null },
                })
              }
            >
              <option value="">All categories</option>
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {(customCategories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Payment</label>
            <select
              className={`${INPUT} py-2 text-sm`}
              value={filters.paymentMode ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTERS',
                  payload: { paymentMode: e.target.value || null },
                })
              }
            >
              <option value="">All modes</option>
              {PAYMENT_MODES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>From</label>
            <input
              type="date"
              className={`${INPUT} py-2 text-sm`}
              value={filters.dateRange?.start ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTERS',
                  payload: {
                    dateRange: {
                      start: e.target.value,
                      end: (filters.dateRange ?? {}).end ?? '',
                    },
                  },
                })
              }
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>To</label>
            <input
              type="date"
              className={`${INPUT} py-2 text-sm`}
              value={filters.dateRange?.end ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTERS',
                  payload: {
                    dateRange: {
                      start: (filters.dateRange ?? {}).start ?? '',
                      end: e.target.value,
                    },
                  },
                })
              }
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[100px] flex-1">
            <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Min amount</label>
            <input
              type="number"
              className={`${INPUT} py-2 text-sm`}
              placeholder="0"
              value={filters.amountMin ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTERS',
                  payload: {
                    amountMin: e.target.value === '' ? null : e.target.value,
                  },
                })
              }
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[100px] flex-1">
            <label className={`text-xs font-medium ${TEXT_SECONDARY}`}>Max amount</label>
            <input
              type="number"
              className={`${INPUT} py-2 text-sm`}
              placeholder="Any"
              value={filters.amountMax ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTERS',
                  payload: {
                    amountMax: e.target.value === '' ? null : e.target.value,
                  },
                })
              }
            />
          </div>

          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium border border-red-500/50 text-red-500 hover:bg-red-500/10 self-start lg:self-end"
            onClick={() => {
              dispatch({ type: 'RESET_FILTERS' });
              setLocalSearch('');
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-2 ${CARD} p-4`}>
        <span className={`text-sm font-medium ${TEXT_SECONDARY}`}>Sort</span>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => dispatch({ type: 'SET_SORT_BY', payload: opt.value })}
              className={`rounded-xl px-3 py-2 text-sm font-medium border transition-colors ${
                sortBy === opt.value
                  ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                  : `dark:border-[#2D3148] border-gray-200 ${TEXT_PRIMARY} hover:border-[#3B82F6]/50`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div
          className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-[#3B82F6]/40`}
        >
          <span className={`text-sm font-medium ${TEXT_PRIMARY}`}>
            {selectedIds.size} selected
          </span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-gray-400 w-4 h-4 accent-[#3B82F6]"
              checked={allSelected}
              onChange={toggleSelectAll}
            />
            <span className={`text-sm ${TEXT_SECONDARY}`}>Select all</span>
          </label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {bulkConfirm ? (
              <>
                <span className={`text-sm self-center ${TEXT_SECONDARY}`}>Delete selected?</span>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                  onClick={runBulkDelete}
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-3 py-2 text-sm font-medium border dark:border-[#2D3148] border-gray-200 ${TEXT_PRIMARY}`}
                  onClick={() => setBulkConfirm(false)}
                >
                  No
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                onClick={() => setBulkConfirm(true)}
              >
                Delete selected
              </button>
            )}
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-sm font-medium border dark:border-[#2D3148] border-gray-200 ${TEXT_PRIMARY}`}
              onClick={cancelSelection}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {filteredSorted.length === 0 ? (
        <div className={`${CARD} p-10 flex flex-col items-center text-center gap-4`}>
          <div
            className="w-24 h-24 rounded-full dark:bg-[#1A1D28] bg-gray-100 flex items-center justify-center"
            aria-hidden
          >
            <Receipt className={`w-12 h-12 ${TEXT_SECONDARY}`} strokeWidth={1.25} />
          </div>
          <div>
            <p className={`text-lg font-semibold ${TEXT_PRIMARY}`}>No expenses found</p>
            <p className={`text-sm mt-1 ${TEXT_SECONDARY}`}>
              {hasActiveFilters
                ? 'Try clearing filters or adjusting your search.'
                : 'Add an expense from the Add tab to see it here.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-medium bg-[#3B82F6] text-white hover:bg-blue-600"
              onClick={() => {
                dispatch({ type: 'RESET_FILTERS' });
                setLocalSearch('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {groupedSections.map((section) => {
            const sectionTotal = section.items.reduce(
              (s, e) => s + (Number(e.amount) || 0),
              0
            );
            const visibleInSection = visibleSlice.filter((x) => x.section.groupId === section.groupId);
            if (!visibleInSection.length) return null;

            return (
              <section key={section.groupId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1 gap-2">
                  <h2 className={`text-sm font-semibold uppercase tracking-wide ${TEXT_SECONDARY}`}>
                    {section.label}
                  </h2>
                  <span className={`text-sm font-medium text-red-500 dark:text-red-400`}>
                    {formatMoney(sectionTotal)}
                  </span>
                </div>
                <ul className={`${CARD} divide-y dark:divide-[#2D3148] divide-gray-200 overflow-hidden`}>
                  {visibleInSection.map(({ expense: e }) => {
                    const cat = resolveCategory(e.category, customCategories);
                    const iconName = cat?.icon ?? 'Circle';
                    const color = cat?.color ?? '#9CA3AF';
                    const sub =
                      e.note ||
                      e.subcategory ||
                      e.subCategory ||
                      (tagsString(e.tags) ? `# ${tagsString(e.tags)}` : '') ||
                      '—';
                    const checked = selectedIds.has(e.id);

                    return (
                      <li key={e.id} className="group relative">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (selectMode) {
                              toggleSelect(e.id);
                              return;
                            }
                            openEdit(e);
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              if (selectMode) toggleSelect(e.id);
                              else openEdit(e);
                            }
                          }}
                          className="flex items-stretch gap-3 p-4 cursor-pointer hover:dark:bg-[#1A1D28]/80 hover:bg-gray-50/80"
                        >
                          {selectMode && (
                            <input
                              type="checkbox"
                              className="self-center shrink-0 w-4 h-4 rounded border-gray-400 accent-[#3B82F6] cursor-pointer"
                              checked={checked}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={() => toggleSelect(e.id)}
                              aria-label={checked ? 'Deselect expense' : 'Select expense'}
                            />
                          )}

                          <div
                            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${color}33` }}
                          >
                            <IconRenderer name={iconName} className="w-5 h-5" style={{ color }} />
                          </div>

                          <div className="flex-1 min-w-0 text-left">
                            <p className={`font-semibold truncate ${TEXT_PRIMARY}`}>
                              {cat?.name ?? e.category ?? 'Uncategorized'}
                            </p>
                            <p className={`text-sm truncate ${TEXT_SECONDARY}`}>{sub}</p>
                          </div>

                          <div className="shrink-0 text-right flex flex-col items-end gap-1">
                            <span className="font-bold text-red-500 dark:text-red-400">
                              {formatMoney(e.amount)}
                            </span>
                            <span
                              className={`text-xs rounded-lg px-2 py-0.5 dark:bg-[#1A1D28] bg-gray-100 ${TEXT_SECONDARY}`}
                            >
                              {paymentName(e.paymentMode ?? e.payment)}
                            </span>
                          </div>

                          {!selectMode && confirmingId === e.id ? (
                            <div
                              className="absolute inset-0 flex items-center justify-end gap-2 pr-4 dark:bg-[#222536]/95 bg-white/95 backdrop-blur-sm"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <span className={`text-sm ${TEXT_SECONDARY}`}>Sure?</span>
                              <button
                                type="button"
                                className="text-sm font-medium text-red-600"
                                onClick={() => runDeleteOne(e.id)}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className={`text-sm font-medium ${TEXT_PRIMARY}`}
                                onClick={() => setConfirmingId(null)}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            !selectMode && (
                              <button
                                type="button"
                                className="self-center shrink-0 p-2 rounded-xl opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500/10 text-red-500"
                                aria-label="Delete expense"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setConfirmingId(e.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <div className={`flex flex-col items-center gap-3 py-2 ${TEXT_SECONDARY} text-sm`}>
            <p>
              Showing {Math.min(displayCount, flatVisible.length)} of {filteredSorted.length}{' '}
              expense{filteredSorted.length !== 1 ? 's' : ''}
            </p>
            {displayCount < flatVisible.length && (
              <button
                type="button"
                className={`rounded-xl px-5 py-2.5 font-medium border dark:border-[#2D3148] border-gray-200 ${TEXT_PRIMARY} hover:border-[#3B82F6]/50`}
                onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
              >
                Load more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
