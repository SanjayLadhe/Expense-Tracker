import { LayoutDashboard, Clock, BarChart3, Settings, Plus } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';

const tabs = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'analytics', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const { activeTab, dispatch } = useApp();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden dark:border-[#2D3148] border-[#E2E8F0] dark:bg-[#1A1D28]/95 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="Mobile navigation"
    >
      <div className="relative mx-auto flex max-w-lg items-end justify-between px-2 pt-2">
        {tabs.slice(0, 2).map((tab) => {
          const { id, label, icon: TabIcon } = tab;
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: id })}
              className={`flex min-w-[4rem] flex-1 flex-col items-center gap-0.5 pb-2 transition-all duration-200 ${
                active
                  ? 'text-[#3B82F6]'
                  : 'dark:text-[#6B7280] text-gray-500'
              }`}
            >
              <TabIcon className="size-6" strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}

        <div className="relative flex w-16 shrink-0 flex-col items-center justify-end">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SHOW_ADD_MODAL', payload: true })}
            className="absolute bottom-4 flex size-14 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-lg shadow-blue-500/35 ring-4 transition-all duration-200 active:scale-95 dark:ring-[#0F1117] ring-[#F8FAFC] hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-500/40"
            aria-label="Add expense"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </button>
          <span className="invisible pb-2 text-[10px] font-medium">Add</span>
        </div>

        {tabs.slice(2).map((tab) => {
          const { id, label, icon: TabIcon } = tab;
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: id })}
              className={`flex min-w-[4rem] flex-1 flex-col items-center gap-0.5 pb-2 transition-all duration-200 ${
                active
                  ? 'text-[#3B82F6]'
                  : 'dark:text-[#6B7280] text-gray-500'
              }`}
            >
              <TabIcon className="size-6" strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
