import { LayoutDashboard, Clock, BarChart3, Target, Settings, Plus, ShieldCheck } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

const baseTabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'analytics', label: 'Stats', icon: BarChart3 },
  { id: 'budgets', label: 'Budgets', icon: Target },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const { activeTab, dispatch } = useApp();
  const { isAdmin } = useAuth();

  const tabs = isAdmin
    ? [...baseTabs, { id: 'admin', label: 'Admin', icon: ShieldCheck }]
    : baseTabs;

  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_SHOW_ADD_MODAL', payload: true })}
        className="fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-lg shadow-blue-500/35 transition-all duration-200 active:scale-95 md:hidden hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-500/40"
        aria-label="Add expense"
      >
        <Plus className="size-7" strokeWidth={2.5} aria-hidden />
      </button>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden dark:border-[#2D3148] border-[#E2E8F0] dark:bg-[#1A1D28]/95 bg-white/95 backdrop-blur-md"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1.5">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
                className={`flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-1 transition-colors duration-150 ${
                  active ? 'text-[#3B82F6]' : 'dark:text-[#6B7280] text-gray-400'
                }`}
              >
                <TabIcon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                <span className="text-[9px] font-medium leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
