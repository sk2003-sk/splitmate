import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  signIn: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    const { data } = await api.get('/api/auth/me');
    return data.user as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const setUser = useCallback(
    (user: User | null) => {
      queryClient.setQueryData(['me'], user);
    },
    [queryClient],
  );

  const clearOtherData = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'me',
    });
  }, [queryClient]);

  const signIn = useCallback(
    (user: User) => {
      queryClient.setQueryData(['me'], user);
      clearOtherData();
    },
    [queryClient, clearOtherData],
  );

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    queryClient.setQueryData(['me'], null);
    clearOtherData();
  }, [queryClient, clearOtherData]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: data ?? null, loading: isLoading, setUser, signIn, logout }),
    [data, isLoading, setUser, signIn, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
