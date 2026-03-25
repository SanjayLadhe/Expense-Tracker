import { useEffect, useCallback } from 'react';
import { useAuth } from './lib/AuthContext.jsx';
import { useApp } from './lib/AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Toast from './components/Toast.jsx';
import Dashboard from './components/Dashboard.jsx';
import AddExpense from './components/AddExpense.jsx';
import History from './components/History.jsx';
import Analytics from './components/Analytics.jsx';
import Budgets from './components/Budgets.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import AuthPage, { PendingApproval, AdminPanel } from './components/AuthPage.jsx';
import { Loader2 } from 'lucide-react';

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117]">
      <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col dark:bg-[#0F1117] bg-[#F8FAFC]">
      <div className="border-b p-4 dark:border-[#2D3148] border-gray-200 md:ml-[240px]">
        <div className="mx-auto max-w-4xl">
          <div className="h-8 w-48 animate-pulse rounded-lg dark:bg-[#222536] bg-gray-200" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6 md:ml-[240px]">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="h-40 animate-pulse rounded-xl dark:bg-[#1A1D28] bg-white ring-1 dark:ring-[#2D3148] ring-gray-200" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-xl dark:bg-[#1A1D28] bg-white ring-1 dark:ring-[#2D3148] ring-gray-200" />
            <div className="h-28 animate-pulse rounded-xl dark:bg-[#1A1D28] bg-white ring-1 dark:ring-[#2D3148] ring-gray-200" />
          </div>
          <div className="h-64 animate-pulse rounded-xl dark:bg-[#1A1D28] bg-white ring-1 dark:ring-[#2D3148] ring-gray-200" />
        </div>
      </div>
    </div>
  );
}

function TabContent({ activeTab }) {
  switch (activeTab) {
    case 'dashboard':
      return <Dashboard />;
    case 'add':
      return (
        <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
          <AddExpense />
        </div>
      );
    case 'history':
      return <History />;
    case 'analytics':
      return (
        <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
          <Analytics />
        </div>
      );
    case 'budgets':
      return (
        <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
          <Budgets />
        </div>
      );
    case 'settings':
      return <SettingsPage />;
    case 'admin':
      return <AdminPanel />;
    default:
      return <Dashboard />;
  }
}

export default function App() {
  const { user, loading: authLoading, isApproved, isAdmin } = useAuth();
  const { loaded, activeTab, showAddModal, dispatch } = useApp();

  const closeModals = useCallback(() => {
    dispatch({ type: 'SET_SHOW_ADD_MODAL', payload: false });
    dispatch({ type: 'SET_EDITING_EXPENSE', payload: null });
  }, [dispatch]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      const target = e.target;
      const tag = target?.tagName;
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable;

      if (e.key === 'Escape') {
        closeModals();
        return;
      }

      if (editable) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (window.matchMedia('(max-width: 767px)').matches) {
          dispatch({ type: 'SET_SHOW_ADD_MODAL', payload: true });
        } else {
          dispatch({ type: 'SET_ACTIVE_TAB', payload: 'add' });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, closeModals]);

  if (authLoading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!isApproved) {
    return <PendingApproval />;
  }

  if (!loaded) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen dark:bg-[#0F1117] bg-[#F8FAFC]">
      <Sidebar />
      <main className="min-h-screen pb-28 md:ml-[240px] md:pb-0">
        <TabContent activeTab={activeTab} />
      </main>
      <BottomNav />
      <Toast />

      {showAddModal && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close"
            onClick={closeModals}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t dark:border-[#2D3148] border-gray-200 dark:bg-[#222536] bg-white animate-slideUp">
            <AddExpense />
          </div>
        </div>
      )}
    </div>
  );
}
