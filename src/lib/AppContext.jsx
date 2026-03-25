import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { storage } from './storage.js';

const AppContext = createContext(null);

const now = new Date();
const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const DEFAULT_SETTINGS = {
  currency: 'INR',
  theme: 'dark',
  monthlyBudget: 0,
  categoryBudgets: {},
};

const DEFAULT_GOAL = { targetAmount: 0, currentAmount: 0, targetDate: '', name: '' };

const initialState = {
  expenses: [],
  settings: DEFAULT_SETTINGS,
  customCategories: [],
  savingsGoal: DEFAULT_GOAL,
  activeTab: 'dashboard',
  editingExpense: null,
  showAddModal: false,
  toasts: [],
  searchQuery: '',
  filters: { dateRange: null, category: null, paymentMode: null, amountMin: null, amountMax: null },
  sortBy: 'date-desc',
  selectedMonth: currentYM,
  loaded: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload, loaded: true };

    case 'SET_EXPENSES':
      return { ...state, expenses: action.payload };

    case 'ADD_EXPENSE': {
      const expenses = [action.payload, ...state.expenses];
      return { ...state, expenses };
    }

    case 'UPDATE_EXPENSE': {
      const expenses = state.expenses.map(e => e.id === action.payload.id ? action.payload : e);
      return { ...state, expenses, editingExpense: null };
    }

    case 'DELETE_EXPENSE': {
      const expenses = state.expenses.filter(e => e.id !== action.payload);
      return { ...state, expenses };
    }

    case 'BULK_DELETE': {
      const ids = new Set(action.payload);
      const expenses = state.expenses.filter(e => !ids.has(e.id));
      return { ...state, expenses };
    }

    case 'SET_SETTINGS': {
      const settings = { ...state.settings, ...action.payload };
      return { ...state, settings };
    }

    case 'SET_CUSTOM_CATEGORIES':
      return { ...state, customCategories: action.payload };

    case 'SET_SAVINGS_GOAL': {
      const goal = { ...state.savingsGoal, ...action.payload };
      return { ...state, savingsGoal: goal };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_EDITING_EXPENSE':
      return { ...state, editingExpense: action.payload };

    case 'SET_SHOW_ADD_MODAL':
      return { ...state, showAddModal: action.payload };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, { id: Date.now() + Math.random(), ...action.payload }] };

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };

    case 'RESET_FILTERS':
      return { ...state, filters: initialState.filters, searchQuery: '' };

    case 'SET_SORT_BY':
      return { ...state, sortBy: action.payload };

    case 'SET_SELECTED_MONTH':
      return { ...state, selectedMonth: action.payload };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toastTimers = useRef({});

  useEffect(() => {
    let cancelled = false;

    // Phase 1: instant load from localStorage cache
    const cachedSettings = { ...DEFAULT_SETTINGS, ...storage.getSettingsLocal() };
    const cachedExpenses = storage.getExpensesLocal();
    const cachedCategories = storage.getCustomCategoriesLocal();
    const cachedGoal = { ...DEFAULT_GOAL, ...storage.getSavingsGoalLocal() };

    dispatch({
      type: 'INIT',
      payload: {
        settings: cachedSettings,
        expenses: cachedExpenses,
        customCategories: cachedCategories,
        savingsGoal: cachedGoal,
      },
    });

    // Phase 2: async fetch from Supabase (if configured) and reconcile
    (async () => {
      try {
        const [settings, expenses, customCategories, savingsGoal] = await Promise.all([
          storage.getSettings(),
          storage.getExpenses(),
          storage.getCustomCategories(),
          storage.getSavingsGoal(),
        ]);
        if (cancelled) return;
        dispatch({
          type: 'INIT',
          payload: {
            settings: { ...DEFAULT_SETTINGS, ...settings },
            expenses: expenses || [],
            customCategories: customCategories || [],
            savingsGoal: { ...DEFAULT_GOAL, ...savingsGoal },
          },
        });
      } catch {
        // Supabase unavailable — local cache is already loaded
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Async persistence middleware — fires after each state-changing dispatch
  const prevState = useRef(state);
  useEffect(() => {
    const prev = prevState.current;
    prevState.current = state;
    if (!state.loaded) return;

    if (prev.settings !== state.settings && prev.loaded) {
      storage.setSettings(state.settings);
    }
    if (prev.customCategories !== state.customCategories && prev.loaded) {
      storage.setCustomCategories(state.customCategories);
    }
    if (prev.savingsGoal !== state.savingsGoal && prev.loaded) {
      storage.setSavingsGoal(state.savingsGoal);
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (state.settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [state.settings.theme]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
      delete toastTimers.current[id];
    }, 3000);
    toastTimers.current[id] = timer;
  }, []);

  // Expense mutations — optimistic state update + async persist
  const addExpense = useCallback((expense) => {
    dispatch({ type: 'ADD_EXPENSE', payload: expense });
    storage.addExpense(expense);
  }, []);

  const updateExpense = useCallback((expense) => {
    dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
    storage.updateExpense(expense);
  }, []);

  const deleteExpense = useCallback((id) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
    storage.deleteExpense(id);
  }, []);

  const bulkDeleteExpenses = useCallback((ids) => {
    dispatch({ type: 'BULK_DELETE', payload: ids });
    storage.bulkDeleteExpenses(ids);
  }, []);

  const getMonthExpenses = useCallback((yearMonth) => {
    return state.expenses.filter(e => e.date?.slice(0, 7) === yearMonth);
  }, [state.expenses]);

  const getCurrentMonthExpenses = useCallback(() => {
    return getMonthExpenses(state.selectedMonth);
  }, [getMonthExpenses, state.selectedMonth]);

  const getTotalForMonth = useCallback((yearMonth) => {
    return getMonthExpenses(yearMonth).reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [getMonthExpenses]);

  const getCategoryTotal = useCallback((categoryId, yearMonth) => {
    return getMonthExpenses(yearMonth)
      .filter(e => e.category === categoryId)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [getMonthExpenses]);

  const value = {
    ...state,
    dispatch,
    addToast,
    addExpense,
    updateExpense,
    deleteExpense,
    bulkDeleteExpenses,
    getMonthExpenses,
    getCurrentMonthExpenses,
    getTotalForMonth,
    getCategoryTotal,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export default AppContext;
