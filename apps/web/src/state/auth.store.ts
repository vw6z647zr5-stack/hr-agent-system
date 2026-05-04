import { create } from 'zustand';
import type { AuthUser } from '../types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser, remember?: boolean) => void;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
  restore: () => void;
}

const STORAGE_KEY = 'hr-agent-auth';

function getStorage(kind: 'local' | 'session') {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGet(storage: Storage | null, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Keep the in-memory session usable when browser storage is unavailable.
  }
}

function safeRemove(storage: Storage | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage failures during logout/restore cleanup.
  }
}

function readStoredSession() {
  return safeGet(getStorage('session'), STORAGE_KEY) ?? safeGet(getStorage('local'), STORAGE_KEY);
}

function writeStoredSession(token: string, user: AuthUser, remember = false) {
  const value = JSON.stringify({ token, user });
  safeRemove(getStorage('local'), STORAGE_KEY);
  safeRemove(getStorage('session'), STORAGE_KEY);
  safeSet(remember ? getStorage('local') : getStorage('session'), STORAGE_KEY, value);
}

function clearStoredSession() {
  safeRemove(getStorage('local'), STORAGE_KEY);
  safeRemove(getStorage('session'), STORAGE_KEY);
}

export const authStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user, remember = false) => {
    writeStoredSession(token, user, remember);
    set({ token, user });
  },
  updateUser: (user) => {
    set((state) => {
      if (!state.token) {
        return { user };
      }

      const persistedInLocalStorage = safeGet(getStorage('local'), STORAGE_KEY) !== null;
      writeStoredSession(state.token, user, persistedInLocalStorage);
      return { user };
    });
  },
  logout: () => {
    clearStoredSession();
    set({ token: null, user: null });
  },
  restore: () => {
    const raw = readStoredSession();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<{ token: string; user: AuthUser }>;
      if (!parsed.token || !parsed.user) {
        throw new Error('认证信息无效');
      }

      set({ token: parsed.token, user: parsed.user });
    } catch {
      clearStoredSession();
      set({ token: null, user: null });
    }
  },
}));
