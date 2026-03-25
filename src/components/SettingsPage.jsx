import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Moon,
  Sun,
  Monitor,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  Database,
  Palette,
  Coins,
  FolderTree,
  Info,
} from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { DEFAULT_CATEGORIES, CURRENCY_SYMBOLS, PAYMENT_MODES } from '../lib/categories.js';
import { storage } from '../lib/storage.js';
import IconRenderer from './IconRenderer.jsx';

const CARD =
  'dark:bg-[#222536] bg-white dark:border-[#2D3148] border-gray-200 rounded-2xl border p-5';
const INPUT =
  'dark:bg-[#1A1D28] bg-gray-50 dark:border-[#2D3148] border-gray-300 dark:text-[#F1F5F9] text-gray-900 rounded-xl px-4 py-3 border outline-none focus:ring-2 focus:ring-[#3B82F6] w-full';

const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));

const CURRENCIES = [
  { code: 'INR', label: '₹ INR' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' },
  { code: 'GBP', label: '£ GBP' },
];

const ICON_PICKER_NAMES = [
  'Utensils',
  'Car',
  'Home',
  'ShoppingBag',
  'Heart',
  'Music',
  'Book',
  'Gift',
  'Briefcase',
  'Phone',
  'Plane',
  'Coffee',
  'Dumbbell',
  'Palette',
  'Camera',
  'Gamepad2',
  'Stethoscope',
  'Baby',
  'Dog',
  'Leaf',
];

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#06B6D4',
];

const AMOUNT_RANGES = {
  'food-dining': [50, 500],
  transport: [30, 800],
  housing: [500, 8000],
  shopping: [100, 8000],
  health: [100, 5000],
  entertainment: [50, 3000],
  education: [200, 15000],
  'family-gifts': [200, 10000],
  'work-business': [100, 5000],
  'recharges-bills': [50, 5000],
  investments: [500, 25000],
  miscellaneous: [20, 2000],
};

const SAMPLE_NOTES = [
  'Weekly groceries',
  'Commute',
  'Subscription renewal',
  'Family dinner',
  'Unexpected expense',
  'Sale purchase',
  'Monthly bill',
];

const SAMPLE_TAGS_POOL = ['personal', 'work', 'family', 'urgent', 'recurring', 'tax', 'weekend'];

function downloadFile(content, filename, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuote = false;
      } else cur += c;
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function autoMapHeaders(headerRow) {
  const aliases = {
    date: ['date', 'transactiondate', 'day', 'expensedate'],
    category: ['category', 'cat', 'categoryname'],
    subcategory: ['subcategory', 'subcategoryname', 'subcat', 'sub'],
    amount: ['amount', 'value', 'total', 'sum', 'price'],
    paymentmode: ['paymentmode', 'payment', 'mode', 'paymode'],
    note: ['note', 'notes', 'description', 'memo', 'details'],
    tags: ['tags', 'tag', 'labels'],
  };
  const normalized = headerRow.map((cell) => normalizeHeader(cell));
  const mapping = {
    date: '',
    category: '',
    subCategory: '',
    amount: '',
    paymentMode: '',
    note: '',
    tags: '',
  };
  for (let i = 0; i < normalized.length; i++) {
    const key = normalized[i];
    for (const [field, names] of Object.entries(aliases)) {
      if (names.includes(key)) {
        const mapKey =
          field === 'subcategory' ? 'subCategory' : field === 'paymentmode' ? 'paymentMode' : field;
        if (mapping[mapKey] === '') mapping[mapKey] = i;
      }
    }
  }
  return mapping;
}

function normalizeDate(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    y = y.length === 2 ? `20${y}` : y;
    const day = parseInt(a, 10) > 12 ? a : b;
    const month = parseInt(a, 10) > 12 ? b : a;
    const d = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const t = Date.parse(d);
    if (!Number.isNaN(t)) return d;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function resolveCategoryId(value, categories) {
  const t = String(value ?? '').trim();
  if (!t) return null;
  const byId = categories.find((c) => c.id === t);
  if (byId) return byId.id;
  const byName = categories.find((c) => c.name.toLowerCase() === t.toLowerCase());
  if (byName) return byName.id;
  return null;
}

function resolvePaymentMode(value) {
  const t = String(value ?? '').toLowerCase().trim();
  if (!t) return 'cash';
  const byId = PAYMENT_MODES.find((p) => p.id === t);
  if (byId) return byId.id;
  const byName = PAYMENT_MODES.find((p) => p.name.toLowerCase() === t);
  if (byName) return byName.id;
  return 'cash';
}

function parseTags(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  return s
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function newExpenseId(prefix = 'exp') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function rowToExpense(row, mapping, categories) {
  const cell = (field) => {
    const idx = mapping[field];
    if (idx === '' || idx == null) return '';
    return row[idx] != null ? String(row[idx]).trim() : '';
  };
  const dateStr = normalizeDate(cell('date'));
  const categoryId = resolveCategoryId(cell('category'), categories);
  const amount = parseFloat(String(cell('amount')).replace(/,/g, ''));
  if (!dateStr || !categoryId || Number.isNaN(amount)) return null;
  return {
    id: newExpenseId('imp'),
    date: dateStr,
    category: categoryId,
    subCategory: cell('subCategory') || '',
    amount,
    paymentMode: resolvePaymentMode(cell('paymentMode')),
    note: cell('note') || '',
    tags: parseTags(cell('tags')),
  };
}

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'category'
  );
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSampleExpenses() {
  const out = [];
  const today = new Date();
  for (let d = 0; d < 30; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const ymd = day.toISOString().slice(0, 10);
    const n = randomInt(3, 8);
    for (let i = 0; i < n; i++) {
      const cat = randomItem(DEFAULT_CATEGORIES);
      const sub = randomItem(cat.subCategories);
      let min;
      let max;
      if (cat.id === 'housing' && sub === 'Rent') {
        min = 10000;
        max = 25000;
      } else {
        [min, max] = AMOUNT_RANGES[cat.id] ?? [20, 2000];
      }
      const amount = randomInt(min, max);
      const mode = randomItem(PAYMENT_MODES).id;
      const note = Math.random() > 0.35 ? randomItem(SAMPLE_NOTES) : '';
      const tagCount = randomInt(0, 2);
      const tags = [];
      const pool = [...SAMPLE_TAGS_POOL];
      for (let t = 0; t < tagCount && pool.length; t++) {
        const idx = randomInt(0, pool.length - 1);
        tags.push(pool.splice(idx, 1)[0]);
      }
      out.push({
        id: newExpenseId('sample'),
        date: ymd,
        category: cat.id,
        subCategory: sub,
        amount,
        paymentMode: mode,
        note,
        tags,
      });
    }
  }
  return out;
}

function SettingsSection({ title, subtitle, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={CARD}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#3B82F6]/15 text-[#3B82F6]">
              <Icon className="size-5" strokeWidth={2} aria-hidden />
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold dark:text-[#F1F5F9] text-gray-900">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm dark:text-[#9CA3AF] text-gray-600">{subtitle}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`mt-1 size-5 shrink-0 transition-transform dark:text-[#9CA3AF] text-gray-500 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open && <div className="mt-5 space-y-4 border-t border-gray-200 pt-5 dark:border-[#2D3148]">{children}</div>}
    </section>
  );
}

function SegmentedOption({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/25'
          : 'dark:bg-[#1A1D28] bg-gray-100 dark:text-[#F1F5F9] text-gray-700 hover:opacity-90'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const { settings, customCategories, expenses, dispatch, addToast } = useApp();

  const csvInputRef = useRef(null);
  const jsonBackupInputRef = useRef(null);

  const [csvExportStart, setCsvExportStart] = useState('');
  const [csvExportEnd, setCsvExportEnd] = useState('');

  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvMapping, setCsvMapping] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');

  const [jsonBackupData, setJsonBackupData] = useState(null);
  const [jsonFileName, setJsonFileName] = useState('');

  const [clearStep, setClearStep] = useState(0);

  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Utensils');
  const [catColor, setCatColor] = useState(PRESET_COLORS[5]);
  const [catSubs, setCatSubs] = useState([]);
  const [catSubInput, setCatSubInput] = useState('');

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories],
  );

  const todayStamp = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const resetCategoryForm = useCallback(() => {
    setCatName('');
    setCatIcon('Utensils');
    setCatColor(PRESET_COLORS[5]);
    setCatSubs([]);
    setCatSubInput('');
    setEditingCategoryId(null);
  }, []);

  const openAddCategory = () => {
    resetCategoryForm();
    setCategoryFormOpen(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatIcon(cat.icon || 'Utensils');
    setCatColor(cat.color || PRESET_COLORS[5]);
    setCatSubs([...(cat.subCategories || [])]);
    setCatSubInput('');
    setCategoryFormOpen(true);
  };

  const addSubPill = () => {
    const t = catSubInput.trim();
    if (!t) return;
    setCatSubs((s) => [...s, t]);
    setCatSubInput('');
  };

  const removeSub = (idx) => {
    setCatSubs((s) => s.filter((_, i) => i !== idx));
  };

  const saveCategory = () => {
    const name = catName.trim();
    if (!name) {
      addToast('Please enter a category name', 'error');
      return;
    }
    if (editingCategoryId) {
      const next = customCategories.map((c) =>
        c.id === editingCategoryId
          ? { ...c, name, icon: catIcon, color: catColor, subCategories: catSubs }
          : c,
      );
      dispatch({ type: 'SET_CUSTOM_CATEGORIES', payload: next });
      addToast('Category updated');
    } else {
      const id = `custom-${slugify(name)}-${Date.now().toString(36)}`;
      dispatch({
        type: 'SET_CUSTOM_CATEGORIES',
        payload: [...customCategories, { id, name, icon: catIcon, color: catColor, subCategories: catSubs }],
      });
      addToast('Category added');
    }
    resetCategoryForm();
    setCategoryFormOpen(false);
  };

  const deleteCustomCategory = (id) => {
    dispatch({
      type: 'SET_CUSTOM_CATEGORIES',
      payload: customCategories.filter((c) => c.id !== id),
    });
    addToast('Category removed');
    if (editingCategoryId === id) {
      resetCategoryForm();
      setCategoryFormOpen(false);
    }
  };

  const exportCsv = () => {
    let list = expenses;
    if (csvExportStart) {
      list = list.filter((e) => e.date >= csvExportStart);
    }
    if (csvExportEnd) {
      list = list.filter((e) => e.date <= csvExportEnd);
    }
    const headers = ['Date', 'Category', 'SubCategory', 'Amount', 'PaymentMode', 'Note', 'Tags'];
    const lines = [headers.join(',')];
    for (const e of list) {
      const tags = Array.isArray(e.tags) ? e.tags.join('; ') : String(e.tags ?? '');
      lines.push(
        [
          escapeCsvCell(e.date),
          escapeCsvCell(e.category),
          escapeCsvCell(e.subCategory ?? ''),
          escapeCsvCell(e.amount),
          escapeCsvCell(e.paymentMode ?? ''),
          escapeCsvCell(e.note ?? ''),
          escapeCsvCell(tags),
        ].join(','),
      );
    }
    downloadFile(lines.join('\n'), `expenses_${todayStamp}.csv`, 'text/csv;charset=utf-8');
    addToast('CSV exported');
  };

  const exportJsonBackup = async () => {
    const data = await storage.exportAllData();
    downloadFile(
      JSON.stringify(data, null, 2),
      `expense_tracker_backup_${todayStamp}.json`,
      'application/json',
    );
    addToast('Backup downloaded');
  };

  const onCsvFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = parseCsv(text);
      if (!rows.length) {
        addToast('Empty CSV', 'error');
        return;
      }
      const headers = rows[0];
      const body = rows.slice(1);
      setCsvHeaders(headers);
      setCsvRows(body);
      setCsvMapping(autoMapHeaders(headers));
    };
    reader.readAsText(file);
  };

  const mappingFields = [
    { key: 'date', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'subCategory', label: 'SubCategory' },
    { key: 'amount', label: 'Amount' },
    { key: 'paymentMode', label: 'PaymentMode' },
    { key: 'note', label: 'Note' },
    { key: 'tags', label: 'Tags' },
  ];

  const parsedImportCount = useMemo(() => {
    if (!csvRows.length || !csvMapping) return 0;
    let n = 0;
    for (const row of csvRows) {
      if (rowToExpense(row, csvMapping, allCategories)) n++;
    }
    return n;
  }, [csvRows, csvMapping, allCategories]);

  const importCsvExpenses = async () => {
    if (!csvMapping || !csvRows.length) return;
    const parsed = [];
    for (const row of csvRows) {
      const ex = rowToExpense(row, csvMapping, allCategories);
      if (ex) parsed.push(ex);
    }
    if (!parsed.length) {
      addToast('No valid rows to import', 'error');
      return;
    }
    const current = await storage.getExpenses();
    const next = [...current, ...parsed];
    await storage.setExpenses(next);
    dispatch({ type: 'SET_EXPENSES', payload: next });
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvMapping(null);
    setCsvFileName('');
    addToast(`Imported ${parsed.length} expenses`);
  };

  const onJsonBackupFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result ?? ''));
        setJsonBackupData(data);
      } catch {
        addToast('Invalid JSON file', 'error');
        setJsonBackupData(null);
      }
    };
    reader.readAsText(file);
  };

  const restoreBackup = async () => {
    if (!jsonBackupData || typeof jsonBackupData !== 'object') return;
    await storage.importAllData(jsonBackupData);
    window.location.reload();
  };

  const loadSampleData = async () => {
    const samples = generateSampleExpenses();
    const current = await storage.getExpenses();
    const next = [...current, ...samples];
    await storage.setExpenses(next);
    dispatch({ type: 'SET_EXPENSES', payload: next });
    addToast('Sample data loaded!');
  };

  const confirmClear = async () => {
    if (clearStep === 0) {
      setClearStep(1);
      return;
    }
    await storage.clearAll();
    window.location.reload();
  };

  const previewRows = csvRows.slice(0, 5);

  return (
    <div className="w-full px-4 py-6 pb-28 transition-all duration-200 md:pb-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold dark:text-[#F1F5F9] text-gray-900">Settings</h1>
          <p className="mt-1 text-sm dark:text-[#9CA3AF] text-gray-600">
            Appearance, categories, data, and app info.
          </p>
        </header>

        <SettingsSection title="Appearance" subtitle="Theme for the whole app" icon={Palette}>
          <p className="text-sm dark:text-[#9CA3AF] text-gray-600">Theme</p>
          <div className="flex gap-2 rounded-2xl border border-gray-200 p-1 dark:border-[#2D3148]">
            <SegmentedOption
              active={settings.theme === 'dark'}
              onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { theme: 'dark' } })}
            >
              <Moon className="size-4" aria-hidden />
              Dark
            </SegmentedOption>
            <SegmentedOption
              active={settings.theme === 'light'}
              onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { theme: 'light' } })}
            >
              <Sun className="size-4" aria-hidden />
              Light
            </SegmentedOption>
            <SegmentedOption
              active={settings.theme === 'system'}
              onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { theme: 'system' } })}
            >
              <Monitor className="size-4" aria-hidden />
              System
            </SegmentedOption>
          </div>
        </SettingsSection>

        <SettingsSection title="Currency" subtitle="Symbol used across the app" icon={Coins}>
          <p className="text-sm dark:text-[#9CA3AF] text-gray-600">Default currency</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {CURRENCIES.map(({ code, label }) => (
              <SegmentedOption
                key={code}
                active={settings.currency === code}
                onClick={() => dispatch({ type: 'SET_SETTINGS', payload: { currency: code } })}
                className="flex-none sm:min-w-[7rem]"
              >
                <span className="font-semibold">{CURRENCY_SYMBOLS[code]}</span>
                {code}
              </SegmentedOption>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Category manager" subtitle="Defaults, custom icons, and subcategories" icon={FolderTree}>
          <div className="space-y-2">
            {allCategories.map((cat) => {
              const isDefault = DEFAULT_CATEGORY_IDS.has(cat.id);
              const subCount = (cat.subCategories || []).length;
              return (
                <div
                  key={cat.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 px-3 py-3 dark:border-[#2D3148] dark:bg-[#1A1D28]/60 bg-gray-50/80"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ backgroundColor: cat.color || '#9CA3AF' }}
                  >
                    <IconRenderer name={cat.icon} size={22} className="text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium dark:text-[#F1F5F9] text-gray-900">{cat.name}</span>
                      {isDefault && (
                        <span className="rounded-md bg-[#3B82F6]/15 px-2 py-0.5 text-xs font-medium text-[#3B82F6]">
                          (Default)
                        </span>
                      )}
                    </div>
                    <p className="text-xs dark:text-[#9CA3AF] text-gray-500">
                      {subCount} subcategor{subCount === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
                  {!isDefault && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditCategory(cat)}
                        className="rounded-lg p-2 dark:text-[#9CA3AF] text-gray-600 hover:bg-[#3B82F6]/10 hover:text-[#3B82F6]"
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomCategory(cat.id)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                        aria-label={`Delete ${cat.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 dark:border-[#2D3148]">
            <button
              type="button"
              onClick={() => {
                if (categoryFormOpen) {
                  setCategoryFormOpen(false);
                  resetCategoryForm();
                } else {
                  openAddCategory();
                }
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium dark:text-[#F1F5F9] text-gray-800"
            >
              <span className="flex items-center gap-2">
                <Plus className="size-4 text-[#3B82F6]" aria-hidden />
                {editingCategoryId ? 'Edit custom category' : 'Add custom category'}
              </span>
              <ChevronDown
                className={`size-4 transition-transform dark:text-[#9CA3AF] ${categoryFormOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {categoryFormOpen && (
              <div className="space-y-4 border-t border-gray-200 px-4 pb-4 pt-4 dark:border-[#2D3148]">
                <div>
                  <label className="mb-1 block text-xs font-medium dark:text-[#9CA3AF] text-gray-600">Name</label>
                  <input
                    className={INPUT}
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Pet care"
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium dark:text-[#9CA3AF] text-gray-600">Icon</p>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {ICON_PICKER_NAMES.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCatIcon(name)}
                        title={name}
                        className={`flex aspect-square items-center justify-center rounded-xl border transition-all ${
                          catIcon === name
                            ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#3B82F6]'
                            : 'border-gray-200 dark:border-[#2D3148] dark:bg-[#1A1D28] bg-white hover:border-[#3B82F6]/50'
                        }`}
                      >
                        <IconRenderer name={name} size={20} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium dark:text-[#9CA3AF] text-gray-600">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCatColor(c)}
                        className={`size-9 rounded-full border-2 shadow-sm ${
                          catColor === c ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/40' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium dark:text-[#9CA3AF] text-gray-600">Subcategories</p>
                  <div className="flex flex-wrap gap-2">
                    {catSubs.map((s, idx) => (
                      <span
                        key={`${s}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#3B82F6]/15 px-3 py-1 text-xs font-medium text-[#3B82F6]"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSub(idx)}
                          className="rounded-full p-0.5 hover:bg-[#3B82F6]/20"
                          aria-label={`Remove ${s}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className={INPUT}
                      value={catSubInput}
                      onChange={(e) => setCatSubInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSubPill();
                        }
                      }}
                      placeholder="Add subcategory"
                    />
                    <button
                      type="button"
                      onClick={addSubPill}
                      className="shrink-0 rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveCategory}
                    className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    {editingCategoryId ? 'Update' : 'Add category'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetCategoryForm();
                      setCategoryFormOpen(false);
                    }}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-[#2D3148] dark:text-[#F1F5F9] text-gray-800 hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title="Data management" subtitle="Export, import, and reset" icon={Database}>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold dark:text-[#F1F5F9] text-gray-900">Export as CSV</h3>
              <p className="mt-1 text-xs dark:text-[#9CA3AF] text-gray-600">
                Columns: Date, Category, SubCategory, Amount, PaymentMode, Note, Tags
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs dark:text-[#9CA3AF] text-gray-600">Start date (optional)</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={csvExportStart}
                    onChange={(e) => setCsvExportStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs dark:text-[#9CA3AF] text-gray-600">End date (optional)</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={csvExportEnd}
                    onChange={(e) => setCsvExportEnd(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
              >
                <Download className="size-4" aria-hidden />
                Export CSV
              </button>
            </div>

            <div className="border-t border-gray-200 pt-5 dark:border-[#2D3148]">
              <h3 className="text-sm font-semibold dark:text-[#F1F5F9] text-gray-900">Backup all data (JSON)</h3>
              <button
                type="button"
                onClick={exportJsonBackup}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-[#2D3148] dark:text-[#F1F5F9] text-gray-900 hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
              >
                <Download className="size-4" aria-hidden />
                Backup all data
              </button>
            </div>

            <div className="border-t border-gray-200 pt-5 dark:border-[#2D3148]">
              <h3 className="text-sm font-semibold dark:text-[#F1F5F9] text-gray-900">Import from CSV</h3>
              <input ref={csvInputRef} type="file" accept=".csv" onChange={onCsvFile} className="hidden" />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-[#2D3148] dark:text-[#F1F5F9] text-gray-900 hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
              >
                <Upload className="size-4" aria-hidden />
                Choose CSV file
              </button>
              {csvFileName && (
                <p className="mt-2 text-xs dark:text-[#9CA3AF] text-gray-600">Selected: {csvFileName}</p>
              )}
              {csvHeaders.length > 0 && csvMapping && (
                <div className="mt-4 space-y-3">
                  {previewRows.length > 0 && (
                    <>
                      <p className="text-xs font-medium dark:text-[#9CA3AF] text-gray-600">Preview (first 5 rows)</p>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-[#2D3148]">
                        <table className="min-w-full text-left text-xs">
                          <tbody className="divide-y divide-gray-200 dark:divide-[#2D3148]">
                            {previewRows.map((row, ri) => (
                              <tr key={ri} className="dark:bg-[#1A1D28]/40">
                                {row.map((cell, ci) => (
                                  <td
                                    key={ci}
                                    className="max-w-[140px] truncate px-2 py-2 dark:text-[#F1F5F9] text-gray-800"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <p className="text-xs font-medium dark:text-[#9CA3AF] text-gray-600">Column mapping</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {mappingFields.map(({ key, label }) => (
                      <div key={key}>
                        <label className="mb-1 block text-xs dark:text-[#9CA3AF] text-gray-600">{label}</label>
                        <select
                          className={INPUT}
                          value={csvMapping[key] === '' ? '' : String(csvMapping[key])}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCsvMapping((m) => ({
                              ...m,
                              [key]: v === '' ? '' : parseInt(v, 10),
                            }));
                          }}
                        >
                          <option value="">—</option>
                          {csvHeaders.map((h, i) => (
                            <option key={i} value={String(i)}>
                              {String(h).trim() || `Column ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={importCsvExpenses}
                    disabled={parsedImportCount === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Import {parsedImportCount} expenses
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-5 dark:border-[#2D3148]">
              <h3 className="text-sm font-semibold dark:text-[#F1F5F9] text-gray-900">Import backup (JSON)</h3>
              <input
                ref={jsonBackupInputRef}
                type="file"
                accept=".json,application/json"
                onChange={onJsonBackupFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => jsonBackupInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-[#2D3148] dark:text-[#F1F5F9] text-gray-900 hover:bg-gray-50 dark:hover:bg-[#1A1D28]"
              >
                <Upload className="size-4" aria-hidden />
                Choose backup file
              </button>
              {jsonFileName && (
                <p className="mt-2 text-xs dark:text-[#9CA3AF] text-gray-600">Selected: {jsonFileName}</p>
              )}
              {jsonBackupData && (
                <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm dark:text-[#F1F5F9] text-gray-900">
                  <div className="flex gap-2">
                    <AlertTriangle className="size-5 shrink-0 text-amber-500" aria-hidden />
                    <div>
                      <p className="font-semibold">Restore backup</p>
                      <p className="mt-1 text-xs dark:text-[#9CA3AF] text-gray-700">
                        This will replace all current data in this browser.
                      </p>
                      <ul className="mt-2 list-inside list-disc text-xs dark:text-[#9CA3AF] text-gray-700">
                        <li>
                          Expenses:{' '}
                          {Array.isArray(jsonBackupData.expenses) ? jsonBackupData.expenses.length : 0}
                        </li>
                        <li>Settings: {jsonBackupData.settings ? 'yes' : 'no'}</li>
                        <li>
                          Custom categories:{' '}
                          {Array.isArray(jsonBackupData.customCategories)
                            ? jsonBackupData.customCategories.length
                            : 0}
                        </li>
                        <li>Savings goal: {jsonBackupData.savingsGoal ? 'yes' : 'no'}</li>
                      </ul>
                      <button
                        type="button"
                        onClick={restoreBackup}
                        className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                      >
                        Restore backup
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-red-500/30 pt-5">
              <h3 className="text-sm font-semibold text-red-500">Clear all data</h3>
              <p className="mt-1 text-xs dark:text-[#9CA3AF] text-gray-600">
                {clearStep === 0
                  ? 'Permanently remove expenses, settings, and categories from this device.'
                  : 'Are you sure? This cannot be undone. Click again to confirm.'}
              </p>
              <button
                type="button"
                onClick={confirmClear}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                {clearStep === 0 ? 'Delete all data' : 'Yes, delete everything'}
              </button>
              {clearStep === 1 && (
                <button
                  type="button"
                  onClick={() => setClearStep(0)}
                  className="ml-2 mt-3 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-[#2D3148]"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Sample data" subtitle="Fill the app with demo expenses" icon={Database} defaultOpen={false}>
          <p className="text-sm dark:text-[#9CA3AF] text-gray-600">
            Adds 30 days of randomized expenses (3–8 per day) across default categories, then refreshes from storage.
          </p>
          <button
            type="button"
            onClick={loadSampleData}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Load sample data
          </button>
        </SettingsSection>

        <SettingsSection title="About" subtitle="ExpenseTracker" icon={Info} defaultOpen={false}>
          <div className="space-y-2 text-sm dark:text-[#F1F5F9] text-gray-800">
            <p className="text-lg font-semibold">ExpenseTracker</p>
            <p className="dark:text-[#9CA3AF] text-gray-600">Version 1.0.0</p>
            <p className="dark:text-[#9CA3AF] text-gray-600">Built with React + Tailwind CSS</p>
            <p className="dark:text-[#9CA3AF] text-gray-600">Data stored locally in your browser</p>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
