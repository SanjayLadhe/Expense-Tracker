import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isConfigured } from './supabase.js';

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase.rpc('get_my_profile');
    if (!error && data && data.length > 0) return data[0];
  } catch {}
  try {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single();
    if (!error && data) return data;
  } catch {}
  return null;
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
      setState(s => ({ ...s, user: null, profile: null, loading: false }));
      return;
    }
    setState(s => ({ ...s, user: sessionUser }));
    const p = await fetchProfile(sessionUser.id);
    setState(s => ({ ...s, user: sessionUser, profile: p, loading: false }));
  }, []);

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setState({ user: null, profile: null, loading: false, authError: null });
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      loadUserAndProfile(session?.user ?? null);
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

  const clearAuthError = useCallback(() => {
    setState(s => ({ ...s, authError: null }));
  }, []);

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
