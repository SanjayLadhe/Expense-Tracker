import { supabase, isConfigured } from './supabase.js';

const SETTINGS_KEY = 'expense_tracker_settings';
const EXPENSES_KEY = 'expense_tracker_expenses';
const CUSTOM_CATEGORIES_KEY = 'expense_tracker_custom_categories';
const SAVINGS_GOAL_KEY = 'expense_tracker_savings_goal';

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota / private mode */ }
}

function getUserId() {
  return supabase?.auth?.getUser?.()
    ? null
    : null;
}

async function currentUserId() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function expenseToRow(e, userId) {
  return {
    id: e.id,
    user_id: userId,
    amount: e.amount ?? 0,
    category: e.category ?? '',
    sub_category: e.subCategory ?? '',
    date: e.date ?? new Date().toISOString().slice(0, 10),
    payment_mode: e.paymentMode ?? 'cash',
    note: e.note ?? '',
    tags: Array.isArray(e.tags) ? e.tags : [],
    is_recurring: Boolean(e.isRecurring),
    recurring_frequency: e.recurringFrequency ?? null,
    created_at: e.createdAt ?? new Date().toISOString(),
  };
}

function rowToExpense(r) {
  return {
    id: r.id,
    amount: Number(r.amount) || 0,
    category: r.category ?? '',
    subCategory: r.sub_category ?? '',
    date: r.date ?? '',
    paymentMode: r.payment_mode ?? 'cash',
    note: r.note ?? '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    isRecurring: Boolean(r.is_recurring),
    recurringFrequency: r.recurring_frequency ?? null,
    createdAt: r.created_at ?? '',
  };
}

function categoryToRow(c, userId) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name ?? '',
    icon: c.icon ?? 'Sparkles',
    color: c.color ?? '#9CA3AF',
    sub_categories: Array.isArray(c.subCategories) ? c.subCategories : [],
  };
}

function rowToCategory(r) {
  return {
    id: r.id,
    name: r.name ?? '',
    icon: r.icon ?? 'Sparkles',
    color: r.color ?? '#9CA3AF',
    subCategories: Array.isArray(r.sub_categories) ? r.sub_categories : [],
  };
}

export const storage = {

  async getSettings() {
    if (!isConfigured) return readLocal(SETTINGS_KEY, {});
    const uid = await currentUserId();
    if (!uid) return readLocal(SETTINGS_KEY, {});
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', uid)
      .single();
    if (error || !data) return readLocal(SETTINGS_KEY, {});
    const settings = {
      currency: data.currency ?? 'INR',
      theme: data.theme ?? 'dark',
      monthlyBudget: Number(data.monthly_budget) || 0,
      categoryBudgets: data.category_budgets ?? {},
    };
    writeLocal(SETTINGS_KEY, settings);
    return settings;
  },

  async setSettings(settings) {
    writeLocal(SETTINGS_KEY, settings);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await supabase
      .from('settings')
      .upsert({
        user_id: uid,
        currency: settings.currency ?? 'INR',
        theme: settings.theme ?? 'dark',
        monthly_budget: settings.monthlyBudget ?? 0,
        category_budgets: settings.categoryBudgets ?? {},
        updated_at: new Date().toISOString(),
      });
  },

  async getExpenses() {
    if (!isConfigured) return readLocal(EXPENSES_KEY, []);
    const uid = await currentUserId();
    if (!uid) return readLocal(EXPENSES_KEY, []);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false });
    if (error || !data) return readLocal(EXPENSES_KEY, []);
    const expenses = data.map(rowToExpense);
    writeLocal(EXPENSES_KEY, expenses);
    return expenses;
  },

  async addExpense(expense) {
    const all = readLocal(EXPENSES_KEY, []);
    all.unshift(expense);
    writeLocal(EXPENSES_KEY, all);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await supabase.from('expenses').insert(expenseToRow(expense, uid));
  },

  async updateExpense(expense) {
    const all = readLocal(EXPENSES_KEY, []);
    const idx = all.findIndex(e => e.id === expense.id);
    if (idx >= 0) all[idx] = expense;
    writeLocal(EXPENSES_KEY, all);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await supabase
      .from('expenses')
      .update(expenseToRow(expense, uid))
      .eq('id', expense.id);
  },

  async deleteExpense(id) {
    const all = readLocal(EXPENSES_KEY, []);
    writeLocal(EXPENSES_KEY, all.filter(e => e.id !== id));
    if (!isConfigured) return;
    await supabase.from('expenses').delete().eq('id', id);
  },

  async bulkDeleteExpenses(ids) {
    const idSet = new Set(ids);
    const all = readLocal(EXPENSES_KEY, []);
    writeLocal(EXPENSES_KEY, all.filter(e => !idSet.has(e.id)));
    if (!isConfigured) return;
    await supabase.from('expenses').delete().in('id', ids);
  },

  async setExpenses(expenses) {
    writeLocal(EXPENSES_KEY, expenses);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await supabase.from('expenses').delete().eq('user_id', uid);
    if (expenses.length > 0) {
      const rows = expenses.map(e => expenseToRow(e, uid));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('expenses').insert(rows.slice(i, i + 500));
      }
    }
  },

  async getCustomCategories() {
    if (!isConfigured) return readLocal(CUSTOM_CATEGORIES_KEY, []);
    const uid = await currentUserId();
    if (!uid) return readLocal(CUSTOM_CATEGORIES_KEY, []);
    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });
    if (error || !data) return readLocal(CUSTOM_CATEGORIES_KEY, []);
    const categories = data.map(rowToCategory);
    writeLocal(CUSTOM_CATEGORIES_KEY, categories);
    return categories;
  },

  async setCustomCategories(categories) {
    writeLocal(CUSTOM_CATEGORIES_KEY, categories);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await supabase.from('custom_categories').delete().eq('user_id', uid);
    if (categories.length > 0) {
      await supabase.from('custom_categories').insert(categories.map(c => categoryToRow(c, uid)));
    }
  },

  async getSavingsGoal() {
    if (!isConfigured) return readLocal(SAVINGS_GOAL_KEY, {});
    const uid = await currentUserId();
    if (!uid) return readLocal(SAVINGS_GOAL_KEY, {});
    const { data, error } = await supabase
      .from('savings_goal')
      .select('*')
      .eq('user_id', uid)
      .single();
    if (error || !data) return readLocal(SAVINGS_GOAL_KEY, {});
    const goal = {
      targetAmount: Number(data.target_amount) || 0,
      currentAmount: Number(data.current_amount) || 0,
      targetDate: data.target_date ?? '',
      name: data.name ?? '',
    };
    writeLocal(SAVINGS_GOAL_KEY, goal);
    return goal;
  },

  async setSavingsGoal(goal) {
    writeLocal(SAVINGS_GOAL_KEY, goal);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await supabase
      .from('savings_goal')
      .upsert({
        user_id: uid,
        name: goal.name ?? '',
        target_amount: goal.targetAmount ?? 0,
        current_amount: goal.currentAmount ?? 0,
        target_date: goal.targetDate ?? '',
        updated_at: new Date().toISOString(),
      });
  },

  async exportAllData() {
    const [settings, expenses, customCategories, savingsGoal] = await Promise.all([
      this.getSettings(),
      this.getExpenses(),
      this.getCustomCategories(),
      this.getSavingsGoal(),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      settings,
      expenses,
      customCategories,
      savingsGoal,
    };
  },

  async importAllData(data) {
    if (!data || typeof data !== 'object') return;
    await Promise.all([
      this.setSettings(data.settings ?? {}),
      this.setExpenses(Array.isArray(data.expenses) ? data.expenses : []),
      this.setCustomCategories(Array.isArray(data.customCategories) ? data.customCategories : []),
      this.setSavingsGoal(data.savingsGoal ?? {}),
    ]);
  },

  async clearAll() {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(EXPENSES_KEY);
    localStorage.removeItem(CUSTOM_CATEGORIES_KEY);
    localStorage.removeItem(SAVINGS_GOAL_KEY);
    if (!isConfigured) return;
    const uid = await currentUserId();
    if (!uid) return;
    await Promise.all([
      supabase.from('expenses').delete().eq('user_id', uid),
      supabase.from('custom_categories').delete().eq('user_id', uid),
      supabase.from('settings').delete().eq('user_id', uid),
      supabase.from('savings_goal').delete().eq('user_id', uid),
    ]);
  },

  getExpensesLocal() {
    return readLocal(EXPENSES_KEY, []);
  },

  getSettingsLocal() {
    return readLocal(SETTINGS_KEY, {});
  },

  getCustomCategoriesLocal() {
    return readLocal(CUSTOM_CATEGORIES_KEY, []);
  },

  getSavingsGoalLocal() {
    return readLocal(SAVINGS_GOAL_KEY, {});
  },
};
