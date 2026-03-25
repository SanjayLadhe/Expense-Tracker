import { CheckCircle, XCircle, Info } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';

const styles = {
  success: {
    Icon: CheckCircle,
    bar: 'border-emerald-600/30 bg-[#10B981] text-white',
    iconWrap: 'text-white',
  },
  error: {
    Icon: XCircle,
    bar: 'border-red-600/30 bg-[#EF4444] text-white',
    iconWrap: 'text-white',
  },
  info: {
    Icon: Info,
    bar: 'border-blue-600/30 bg-[#3B82F6] text-white',
    iconWrap: 'text-white',
  },
};

export default function Toast() {
  const { toasts, dispatch } = useApp();

  const dismiss = (id) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 md:items-end md:justify-end"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const variant = styles[toast.type] || styles.info;
        const { Icon } = variant;
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto flex max-w-md cursor-pointer items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg transition-all duration-200 animate-toast hover:brightness-110 ${variant.bar}`}
          >
            <span className={`shrink-0 ${variant.iconWrap}`}>
              <Icon className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <span className="text-left text-sm font-medium">{toast.message}</span>
          </button>
        );
      })}
    </div>
  );
}
