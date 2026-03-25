import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { DEFAULT_CATEGORIES, PAYMENT_MODES, CURRENCY_SYMBOLS } from '../lib/categories.js';
import IconRenderer from './IconRenderer.jsx';

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

export default function AddExpense() {
  const {
    settings,
    customCategories,
    editingExpense,
    showAddModal,
    activeTab,
    dispatch,
    addToast,
    addExpense,
    updateExpense,
  } = useApp();

  const isMobile = useIsMobile();
  const useOverlay = isMobile && showAddModal && activeTab !== 'add';

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories],
  );

  const currencySymbol = CURRENCY_SYMBOLS[settings.currency] ?? CURRENCY_SYMBOLS.INR ?? '₹';

  const amountRef = useRef(null);
  const firstCategoryRef = useRef(null);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [date, setDate] = useState(todayISO);
  const [paymentMode, setPaymentMode] = useState('upi');
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('monthly');

  const resetForNew = useCallback(
    (opts = {}) => {
      setAmount('');
      setSubCategory('');
      setDate(todayISO());
      setNote('');
      setTagsInput('');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      if (!opts.keepCategoryPayment) {
        setCategoryId('');
        setPaymentMode('upi');
      }
    },
    [],
  );

  useEffect(() => {
    if (editingExpense) {
      setAmount(
        editingExpense.amount != null && editingExpense.amount !== ''
          ? String(editingExpense.amount)
          : '',
      );
      setCategoryId(editingExpense.category || '');
      setSubCategory(editingExpense.subCategory || '');
      setDate(editingExpense.date || todayISO());
      setPaymentMode(editingExpense.paymentMode || 'upi');
      setNote(editingExpense.note || '');
      setTagsInput(Array.isArray(editingExpense.tags) ? editingExpense.tags.join(', ') : '');
      setIsRecurring(Boolean(editingExpense.isRecurring));
      setRecurringFrequency(editingExpense.recurringFrequency || 'monthly');
    } else {
      resetForNew({ keepCategoryPayment: false });
    }
  }, [editingExpense, resetForNew]);

  const selectedCategory = useMemo(
    () => allCategories.find((c) => c.id === categoryId),
    [allCategories, categoryId],
  );

  const tagPills = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const buildExpensePayload = useCallback(() => {
    const num = parseFloat(String(amount).replace(/,/g, ''));
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      id:
        editingExpense?.id ??
        `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      amount: Number.isFinite(num) ? num : 0,
      category: categoryId,
      subCategory: subCategory || '',
      date,
      paymentMode,
      note: note.trim(),
      tags,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : null,
      createdAt: editingExpense?.createdAt ?? new Date().toISOString(),
    };
  }, [
    amount,
    categoryId,
    subCategory,
    date,
    paymentMode,
    note,
    tagsInput,
    isRecurring,
    recurringFrequency,
    editingExpense,
  ]);

  const validate = useCallback(() => {
    const payload = buildExpensePayload();
    if (!payload.category) {
      addToast('Please select a category', 'error');
      return null;
    }
    if (!(payload.amount > 0)) {
      addToast('Enter an amount greater than 0', 'error');
      return null;
    }
    return payload;
  }, [buildExpensePayload, addToast]);

  const handleSave = useCallback(() => {
    const payload = validate();
    if (!payload) return;
    if (editingExpense) {
      updateExpense(payload);
      addToast('Expense updated!');
    } else {
      addExpense(payload);
      addToast('Expense saved!');
    }
  }, [validate, editingExpense, addExpense, updateExpense, addToast]);

  const handleSaveAndAnother = useCallback(() => {
    if (editingExpense) return;
    const payload = validate();
    if (!payload) return;
    addExpense(payload);
    addToast('Expense saved!');
    resetForNew({ keepCategoryPayment: true });
    requestAnimationFrame(() => amountRef.current?.focus());
  }, [editingExpense, validate, addExpense, addToast, resetForNew]);

  const handleCancelEdit = useCallback(() => {
    dispatch({ type: 'SET_EDITING_EXPENSE', payload: null });
  }, [dispatch]);

  const closeModal = useCallback(() => {
    dispatch({ type: 'SET_SHOW_ADD_MODAL', payload: false });
  }, [dispatch]);

  const onAmountKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      firstCategoryRef.current?.focus();
    }
  };

  const formBody = (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col items-center gap-1">
        <label className="dark:text-[#9CA3AF] text-gray-500 text-sm font-medium">Amount</label>
        <div className="flex items-center justify-center gap-1 w-full max-w-md">
          <span className="dark:text-[#F1F5F9] text-gray-900 text-4xl font-semibold tabular-nums shrink-0">
            {currencySymbol}
          </span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="0"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onAmountKeyDown}
            className="dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-2 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all text-4xl font-semibold text-center flex-1 min-w-0 max-w-[12ch]"
          />
        </div>
      </div>

      <div>
        <p className="dark:text-[#9CA3AF] text-gray-500 text-sm font-medium mb-3">Category</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
          {allCategories.map((cat, index) => {
            const selected = categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                ref={index === 0 ? firstCategoryRef : undefined}
                onClick={() => {
                  setCategoryId(cat.id);
                  setSubCategory('');
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
                  selected
                    ? 'ring-2 ring-[#3B82F6] border-[#3B82F6] dark:bg-[#1A1D28] bg-gray-50'
                    : 'dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-200 hover:border-[#3B82F6]/50'
                }`}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full shrink-0"
                  style={{ backgroundColor: `${cat.color}22` }}
                >
                  <IconRenderer
                    name={cat.icon}
                    size={22}
                    className="shrink-0"
                    style={{ color: cat.color }}
                  />
                </span>
                <span className="dark:text-[#F1F5F9] text-gray-900 text-xs font-medium text-center leading-tight line-clamp-2">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedCategory && (
        <div>
          <label
            htmlFor="add-expense-sub"
            className="dark:text-[#9CA3AF] text-gray-500 text-sm font-medium mb-2 block"
          >
            Sub-category
          </label>
          <select
            id="add-expense-sub"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            className="w-full dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            }}
          >
            <option value="">Select sub-category</option>
            {(selectedCategory.subCategories || []).map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="dark:text-[#9CA3AF] text-gray-500 text-sm font-medium mb-2 block">
          Date
        </label>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setDate(todayISO())}
            className="rounded-xl px-3 py-1.5 text-sm font-medium border dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800 dark:hover:bg-[#2A2E42] hover:bg-gray-100 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDate(yesterdayISO())}
            className="rounded-xl px-3 py-1.5 text-sm font-medium border dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800 dark:hover:bg-[#2A2E42] hover:bg-gray-100 transition-colors"
          >
            Yesterday
          </button>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all [color-scheme:dark]"
        />
      </div>

      <div>
        <p className="dark:text-[#9CA3AF] text-gray-500 text-sm font-medium mb-2">Payment</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          {PAYMENT_MODES.map((mode) => {
            const selected = paymentMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setPaymentMode(mode.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
                  selected
                    ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                    : 'dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800'
                }`}
              >
                <IconRenderer name={mode.icon} size={18} className={selected ? 'text-white' : 'opacity-80'} />
                {mode.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="add-expense-note" className="sr-only">
          Note
        </label>
        <input
          id="add-expense-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          className="w-full dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all"
        />
      </div>

      <div>
        <label htmlFor="add-expense-tags" className="sr-only">
          Tags
        </label>
        <input
          id="add-expense-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Add tags (comma separated)"
          className="w-full dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all"
        />
        {tagPills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {tagPills.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-[#3B82F6]/15 text-[#3B82F6] dark:text-[#93C5FD] px-3 py-1 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span className="dark:text-[#F1F5F9] text-gray-900 text-sm font-medium">Recurring expense</span>
          <button
            type="button"
            role="switch"
            aria-checked={isRecurring}
            onClick={() => setIsRecurring((v) => !v)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              isRecurring ? 'bg-[#3B82F6]' : 'dark:bg-[#2D3148] bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                isRecurring ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {isRecurring && (
          <div className="flex flex-wrap gap-2">
            {['daily', 'weekly', 'monthly'].map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setRecurringFrequency(freq)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize border transition-all ${
                  recurringFrequency === freq
                    ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                    : 'dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800'
                }`}
              >
                {freq}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold py-3.5 transition-colors"
        >
          {editingExpense ? 'Update Expense' : 'Save Expense'}
        </button>
        {!editingExpense && (
          <button
            type="button"
            onClick={handleSaveAndAnother}
            className="w-full rounded-xl border-2 border-[#3B82F6] text-[#3B82F6] dark:text-[#93C5FD] font-semibold py-3.5 hover:bg-[#3B82F6]/10 transition-colors"
          >
            Save &amp; Add Another
          </button>
        )}
        {editingExpense && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="w-full rounded-xl border dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-800 font-semibold py-3.5 hover:opacity-90 transition-opacity"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  const cardClass =
    'dark:bg-[#222536] bg-white dark:border-[#2D3148] border-gray-200 rounded-2xl border overflow-hidden';

  if (useOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 z-0 bg-black/50"
          onClick={closeModal}
        />
        <div
          className={`relative z-10 max-h-[min(92vh,100%)] flex flex-col rounded-t-3xl shadow-2xl ${cardClass} animate-slideUp`}
        >
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b dark:border-[#2D3148] border-gray-200 shrink-0">
            <h2 className="dark:text-[#F1F5F9] text-gray-900 text-lg font-semibold">
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </h2>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-10 w-10 items-center justify-center rounded-xl dark:hover:bg-[#2A2E42] hover:bg-gray-100 dark:text-[#F1F5F9] text-gray-800 transition-colors"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </header>
          <div className="overflow-y-auto flex-1 overscroll-contain">{formBody}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      {activeTab === 'add' && (
        <header className="px-4 md:px-6 pt-4 md:pt-6 pb-0">
          <h2 className="dark:text-[#F1F5F9] text-gray-900 text-xl font-semibold">
            {editingExpense ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <p className="dark:text-[#9CA3AF] text-gray-500 text-sm mt-1">
            {editingExpense ? 'Update the details below.' : 'Log a new expense.'}
          </p>
        </header>
      )}
      {formBody}
    </div>
  );
}
