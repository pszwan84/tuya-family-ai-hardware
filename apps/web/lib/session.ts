'use client';

import { useCallback, useEffect, useState } from 'react';

export type Session = {
  token: string;
  user: { userId: string; displayName: string; role: string; isMinor: boolean };
  family: { familyId: string; name: string };
  role: string;
};

const KEY = 'fah.session';

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (typeof window === 'undefined') return;
  if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('fah-session'));
}

export function useSession(): { session: Session | null; ready: boolean; setSession: (session: Session | null) => void } {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionState(loadSession());
    setReady(true);
    const sync = () => setSessionState(loadSession());
    window.addEventListener('fah-session', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('fah-session', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setSession = useCallback((next: Session | null) => {
    saveSession(next);
    setSessionState(next);
  }, []);

  return { session, ready, setSession };
}

export const roleLabel: Record<string, string> = {
  grandparent: '祖辈',
  middle: '中间一代',
  child: '子女 / 孙辈',
};