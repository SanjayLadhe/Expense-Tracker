import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import {
  Wallet,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  ShieldAlert,
  RefreshCw,
  LogOut,
  CheckCircle2,
  XCircle,
  Crown,
} from 'lucide-react';

const inputWrap =
  'flex items-center gap-3 rounded-xl border border-[#2D3148] bg-[#222536] px-4 py-3 text-[#F1F5F9] focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/40';
const inputClass = 'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500';

export default function AuthPage() {
  const { signIn, signUp, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    setLocalError(null);
    setSignupSuccess(false);
    clearAuthError();
  }, [mode, clearAuthError]);

  const displayError = localError || authError;

  async function handleSignIn(e) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      /* authError set in context */
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);
    if (!error) {
      setSignupSuccess(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2D3148] bg-[#1A1D28] p-8 shadow-xl shadow-black/40">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/20 ring-2 ring-blue-500/30">
            <Wallet className="h-7 w-7 text-blue-400" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#F1F5F9]">ExpenseTracker</h1>
        </div>

        <div className="mb-6 flex rounded-xl bg-[#222536] p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
              mode === 'signin'
                ? 'bg-[#2D3148] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-[#2D3148] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {signupSuccess && mode === 'signup' ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
              Account created! Please wait for admin approval before you can access the app.
            </p>
            <button
              type="button"
              onClick={() => {
                setSignupSuccess(false);
                setMode('signin');
              }}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Go to Sign In
            </button>
          </div>
        ) : mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className={inputWrap}>
              <Mail className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className={inputWrap}>
              <Lock className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 text-slate-500 hover:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {displayError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
            </button>

            <p className="text-center text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Sign Up
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className={inputWrap}>
              <User className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                type="text"
                required
                autoComplete="name"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className={inputWrap}>
              <Mail className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className={inputWrap}>
              <Lock className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 text-slate-500 hover:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className={inputWrap}>
              <Lock className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="shrink-0 text-slate-500 hover:text-slate-300"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {displayError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
            </button>

            <p className="text-center text-sm text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export function PendingApproval() {
  const { signOut, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-[#0F1117] bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md rounded-2xl border dark:border-[#2D3148] border-gray-200 dark:bg-[#1A1D28] bg-white p-8 text-center shadow-xl dark:shadow-black/40 shadow-gray-200/60">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-2 ring-amber-500/25">
          <Clock className="h-8 w-8 text-amber-400" aria-hidden />
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/50">
          <ShieldAlert className="h-6 w-6 text-slate-400" aria-hidden />
        </div>
        <h2 className="mb-3 text-xl font-semibold text-[#F1F5F9]">Waiting for Approval</h2>
        <p className="mb-8 text-sm leading-relaxed text-slate-400">
          Your account is pending admin approval. You&apos;ll be able to access the app once an admin approves your
          account.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D3148] bg-[#222536] px-5 py-3 text-sm font-medium text-[#F1F5F9] transition hover:bg-[#2a2d42] disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Status
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600/90 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  const loadProfiles = useCallback(async () => {
    if (!supabase) {
      setProfiles([]);
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase.rpc('get_all_profiles');
    if (qErr) {
      setError(qErr.message);
      setProfiles([]);
    } else {
      setProfiles(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  async function setApproved(id, value) {
    if (!supabase) return;
    setActionId(id);
    const { error: rpcErr } = await supabase.rpc('admin_update_profile', {
      target_id: id,
      new_is_approved: value,
    });
    setActionId(null);
    if (rpcErr) setError(rpcErr.message);
    else await loadProfiles();
  }

  async function toggleAdmin(id, current) {
    if (!supabase) return;
    setActionId(id);
    const { error: rpcErr } = await supabase.rpc('admin_update_profile', {
      target_id: id,
      new_is_admin: !current,
    });
    setActionId(null);
    if (rpcErr) setError(rpcErr.message);
    else await loadProfiles();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <div className="min-h-screen dark:bg-[#0F1117] bg-[#F8FAFC] p-4 pb-28 md:p-8 md:pb-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold dark:text-[#F1F5F9] text-gray-900">Admin — Profiles</h2>
            <p className="mt-1 text-sm dark:text-slate-400 text-gray-500">Approve users and manage roles</p>
          </div>
          <button
            type="button"
            onClick={loadProfiles}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D3148] bg-[#1A1D28] px-4 py-2.5 text-sm font-medium text-[#F1F5F9] hover:bg-[#222536] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="rounded-2xl border border-[#2D3148] bg-[#1A1D28] p-4 shadow-xl md:p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading && profiles.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="py-12 text-center text-slate-400">No profiles found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-slate-400">
                    <th className="border-b border-[#2D3148] px-3 py-3 font-medium">Email</th>
                    <th className="border-b border-[#2D3148] px-3 py-3 font-medium">Name</th>
                    <th className="border-b border-[#2D3148] px-3 py-3 font-medium">Created</th>
                    <th className="border-b border-[#2D3148] px-3 py-3 font-medium">Status</th>
                    <th className="border-b border-[#2D3148] px-3 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((row) => (
                    <tr key={row.id} className="text-[#F1F5F9]">
                      <td className="border-b border-[#2D3148]/60 px-3 py-3 align-middle">{row.email ?? '—'}</td>
                      <td className="border-b border-[#2D3148]/60 px-3 py-3 align-middle">{row.full_name ?? '—'}</td>
                      <td className="border-b border-[#2D3148]/60 px-3 py-3 align-middle text-slate-400">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="border-b border-[#2D3148]/60 px-3 py-3 align-middle">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${
                              row.is_approved
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-200'
                            }`}
                          >
                            {row.is_approved ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            {row.is_approved ? 'Approved' : 'Pending'}
                          </span>
                          {row.is_admin && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">
                              <Crown className="h-3.5 w-3.5" />
                              Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-b border-[#2D3148]/60 px-3 py-3 align-middle">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {!row.is_approved ? (
                            <button
                              type="button"
                              disabled={actionId === row.id}
                              onClick={() => setApproved(row.id, true)}
                              className="inline-flex min-w-[5.5rem] items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {actionId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Approve'
                              )}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={actionId === row.id}
                                onClick={() => setApproved(row.id, false)}
                                className="rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                              >
                                Revoke
                              </button>
                              <button
                                type="button"
                                disabled={actionId === row.id}
                                onClick={() => toggleAdmin(row.id, row.is_admin)}
                                className="rounded-lg border border-[#2D3148] bg-[#222536] px-3 py-1.5 text-xs font-medium text-[#F1F5F9] hover:bg-[#2a2d42] disabled:opacity-50"
                              >
                                {row.is_admin ? 'Remove admin' : 'Make admin'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
