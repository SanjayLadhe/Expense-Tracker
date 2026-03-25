import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isConfigured } from './supabase.js';

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error || !data || data.length === 0) {
    const fallback = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (fallback.error) return null;
    return fallback.data;
  }
  return data[0];
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const profileFetchRef = useRef(0);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user?.id) {
      setProfile(null);
      return;
    }
    const data = await fetchProfile(user.id);
    setProfile(data);
  }, [user?.id]);

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setLoading(false);
      setUser(null);
      setProfile(null);
      return;
    }

    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser?.id) {
        const p = await fetchProfile(sessionUser.id);
        if (mounted) setProfile(p);
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user ?? null;

      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const fetchId = ++profileFetchRef.current;
      setUser(nextUser);
      setLoading(true);

      const p = await fetchProfile(nextUser.id);
      if (!mounted || fetchId !== profileFetchRef.current) return;

      setProfile(p);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signUp = useCallback(async (email, password, fullName) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setAuthError(error.message);
      return { error };
    }
    setAuthError(null);
    return { error: null };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured') };
    }
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setProfile(null);
      setAuthError(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAuthError(null);
  }, []);

  const isApproved = profile?.is_approved === true;
  const isAdmin = profile?.is_admin === true;

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authError,
      clearAuthError,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      isApproved,
      isAdmin,
    }),
    [
      user,
      profile,
      loading,
      authError,
      clearAuthError,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      isApproved,
      isAdmin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
