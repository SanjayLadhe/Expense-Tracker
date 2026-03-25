import {
  Wallet,
  LayoutDashboard,
  PlusCircle,
  Clock,
  BarChart3,
  Target,
  Settings,
  Moon,
  Sun,
  Monitor,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'add', label: 'Add Expense', icon: PlusCircle },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'budgets', label: 'Budgets', icon: Target },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function ThemeGlyph({ theme }) {
  if (theme === 'light') return <Sun className="size-3.5 text-amber-400" aria-hidden />;
  if (theme === 'system') return <Monitor className="size-3.5 text-[#9CA3AF]" aria-hidden />;
  return <Moon className="size-3.5 text-sky-400" aria-hidden />;
}

export default function Sidebar() {
  const { activeTab, settings, dispatch } = useApp();
  const { profile, isAdmin, signOut } = useAuth();

  const displayName = profile?.full_name || profile?.email || 'User';
  const displayEmail = profile?.email || '';

  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col border-r transition-all duration-200 md:flex dark:border-[#2D3148] border-[#E2E8F0] dark:bg-[#1A1D28] bg-white"
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center gap-2 border-b px-5 transition-all duration-200 dark:border-[#2D3148] border-[#E2E8F0]">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#3B82F6]/15 text-[#3B82F6]">
          <Wallet className="size-5" strokeWidth={2} aria-hidden />
        </div>
        <span className="text-lg font-semibold tracking-tight dark:text-[#F1F5F9] text-gray-900">
          ExpenseTracker
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const { id, label, icon: NavIcon } = item;
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: id })}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/20'
                  : 'dark:text-[#9CA3AF] text-gray-600 hover:dark:bg-[#222536] hover:bg-gray-100 dark:hover:text-[#F1F5F9] hover:text-gray-900'
              }`}
            >
              <NavIcon className="size-5 shrink-0 opacity-90" strokeWidth={active ? 2.25 : 2} aria-hidden />
              {label}
            </button>
          );
        })}

        {isAdmin && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'admin' })}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
              activeTab === 'admin'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                : 'dark:text-violet-400 text-violet-600 hover:dark:bg-violet-500/10 hover:bg-violet-50'
            }`}
          >
            <ShieldCheck className="size-5 shrink-0 opacity-90" strokeWidth={activeTab === 'admin' ? 2.25 : 2} aria-hidden />
            Admin Panel
          </button>
        )}
      </nav>

      <div className="border-t p-3 transition-all duration-200 dark:border-[#2D3148] border-[#E2E8F0]">
        <div className="mb-3 flex items-center gap-2.5 rounded-lg px-2 py-2 dark:bg-[#222536]/60 bg-gray-50">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/15 text-[#3B82F6]">
            <User className="size-4" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium dark:text-[#F1F5F9] text-gray-900">{displayName}</p>
            <p className="truncate text-[10px] dark:text-[#6B7280] text-gray-500">{displayEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="shrink-0 rounded-md p-1.5 dark:text-[#6B7280] text-gray-400 hover:dark:text-red-400 hover:text-red-500 hover:dark:bg-red-500/10 hover:bg-red-50 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs dark:text-[#6B7280] text-gray-500">v1.0</span>
          <div
            className="flex items-center gap-1.5 rounded-md px-2 py-1 dark:bg-[#222536] bg-gray-100"
            title={`Theme: ${settings.theme}`}
          >
            <ThemeGlyph theme={settings.theme} />
            <span className="text-[10px] font-medium uppercase tracking-wide dark:text-[#9CA3AF] text-gray-500">
              {settings.theme}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
