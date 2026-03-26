import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isConfigured } from './supabase.js';

const AuthContext = createContext(null);
const PROFILE_CACHE_KEY = 'et_profile_cache';

function getCachedProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY)); } catch { return null; }
}
function setCachedProfile(p) {
  try { if (p) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); else localStorage.removeItem(PROFILE_CACHE_KEY); } catch {}
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function fetchProfile(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await withTimeout(supabase.rpc('get_my_profile'), 8000);
    if (!error && data && data.length > 0) { setCachedProfile(data[0]); return data[0]; }
  } catch {}
  try {
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('*').eq('id', userId).single(), 8000
    );
    if (!error && data) { setCachedProfile(data); return data; }
  } catch {}
  return getCachedProfile();
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    profile: null,
    loading: true,
    authError: null,
  });

  const loadUserAndProfile = useCallback(async (sessionUser) => {
    if (!sessionUser?.id) {
      setCachedProfile(null);
      setState(s => ({ ...s, user: null, profile: null, loading: false }));
      return;
    }
    const cached = getCachedProfile();
    if (cached && cached.id === sessionUser.id) {
      setState(s => ({ ...s, user: sessionUser, profile: cached, loading: false }));
    } else {
      setState(s => ({ ...s, user: sessionUser }));
    }
    const p = await fetchProfile(sessionUser.id);
    setState(s => ({ ...s, user: sessionUser, profile: p ?? cached, loading: false }));
  }, []);

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setState({ user: null, profile: null, loading: false, authError: null });
      return;
    }

    let mounted = true;

    withTimeout(supabase.auth.getSession(), 6000)
      .then(({ data: { session } }) => {
        if (mounted) loadUserAndProfile(session?.user ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        const cached = getCachedProfile();
        if (cached) {
          setState({ user: { id: cached.id }, profile: cached, loading: false, authError: null });
        } else {
          setState(s => ({ ...s, loading: false }));
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (_event === 'INITIAL_SESSION') return;
        loadUserAndProfile(session?.user ?? null);
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadUserAndProfile]);

  const refreshProfile = useCallback(async () => {
    if (!state.user?.id) { setState(s => ({ ...s, profile: null })); return; }
    const p = await fetchProfile(state.user.id);
    setState(s => ({ ...s, profile: p }));
  }, [state.user?.id]);

  const clearAuthError = useCallback(() => setState(s => ({ ...s, authError: null })), []);

  const signUp = useCallback(async (email, password, fullName) => {
    if (!supabase) return { error: new Error('Supabase is not configured') };
    setState(s => ({ ...s, authError: null }));
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });
    if (error) { setState(s => ({ ...s, authError: error.message })); return { error }; }
    return { error: null };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: new Error('Supabase is not configured') };
    setState(s => ({ ...s, authError: null, loading: true }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState(s => ({ ...s, authError: error.message, loading: false }));
      return { error };
    }
    if (data?.user) {
      const p = await fetchProfile(data.user.id);
      setState(s => ({ ...s, user: data.user, profile: p, loading: false }));
    } else {
      setState(s => ({ ...s, loading: false }));
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    setCachedProfile(null);
    if (supabase) await supabase.auth.signOut();
    setState({ user: null, profile: null, loading: false, authError: null });
  }, []);

  const isApproved = state.profile?.is_approved === true;
  const isAdmin = state.profile?.is_admin === true;

  const value = useMemo(
    () => ({
      user: state.user,
      profile: state.profile,
      loading: state.loading,
      authError: state.authError,
      clearAuthError,
      signUp, signIn, signOut, refreshProfile,
      isApproved, isAdmin,
    }),
    [state, clearAuthError, signUp, signIn, signOut, refreshProfile, isApproved, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
