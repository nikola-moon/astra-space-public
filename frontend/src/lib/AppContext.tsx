import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api, ApiError, DEFAULT_API_URL, PUBLIC_WEB, setApiUrl, StationUnreachableError } from './api';
import { demo, DemoStationDown } from './demo';
import { storage } from './storage';
import type { DiscussionReply, LinkState, MeState, Mode, ReportCategory, ReportResult, Session, Topic } from './types';

interface AppValue {
  ready: boolean;
  session: Session | null;
  state: MeState | null;
  /** Horodatage du bilan affiché : synchronisation serveur ou sauvegarde du cache. */
  stateTime: string | null;
  fromCache: boolean;
  link: LinkState;
  linkMessage: string | null;
  apiUrl: string;
  setStationUrl: (url: string) => Promise<void>;
  login: (mode: Mode, profileId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  ask: (topic: Topic) => Promise<DiscussionReply>;
  report: (category: ReportCategory) => Promise<ReportResult>;
}

const Ctx = createContext<AppValue | null>(null);

const POLL_MS = 15000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<MeState | null>(null);
  const [stateTime, setStateTime] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [link, setLink] = useState<LinkState>('loading');
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  /** Affiche le dernier bilan connu de CE profil uniquement. */
  const showCache = useCallback(async (s: Session) => {
    const cached = await storage.loadCache(s);
    if (sessionRef.current !== s) return;
    if (cached) {
      setState(cached.state);
      setStateTime(cached.state.synchronized_at ?? cached.saved_at);
      setFromCache(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const next = s.mode === 'demo' ? await demo.me(s) : await api.me();
      if (sessionRef.current !== s) return;
      // Le serveur fait foi sur l'identité : un profil ne consulte que ses propres données.
      if (next.profile.id !== s.profileId) throw new ApiError(401, 'La session ne correspond plus à ce profil.');
      setState(next);
      setStateTime(next.synchronized_at);
      setFromCache(false);
      setLink(s.mode === 'demo' ? 'demo' : 'connected');
      setLinkMessage(null);
      await storage.saveCache(s, next);
    } catch (err) {
      if (sessionRef.current !== s) return;
      if (err instanceof StationUnreachableError || err instanceof DemoStationDown) {
        setLink('unreachable');
        setLinkMessage(err.message);
        if (s.mode === 'demo') await showCache(s);
        else setFromCache(true);
      } else if (err instanceof ApiError && err.status === 401) {
        sessionRef.current = null;
        setSession(null);
        setState(null);
        setStateTime(null);
        setFromCache(false);
        setLink('session_expired');
        setLinkMessage('Session expirée sur la station. Reconnectez ce profil.');
        await storage.clearSession();
      } else {
        setLink('unreachable');
        setLinkMessage(err instanceof Error ? err.message : 'Erreur inconnue.');
        if (s.mode === 'demo') await showCache(s);
        else setFromCache(true);
      }
    }
  }, [showCache]);

  // Démarrage : adresse de station enregistrée, puis session précédente.
  useEffect(() => {
    (async () => {
      const savedUrl = PUBLIC_WEB ? null : await storage.loadApiUrl();
      if (savedUrl) {
        setApiUrl(savedUrl);
        setApiUrlState(savedUrl);
      }
      const saved = await storage.loadSession();
      await storage.clearLegacyStationCache();
      if (saved?.mode === 'demo') {
        sessionRef.current = saved;
        setSession(saved);
        await showCache(saved);
      } else if (saved?.mode === 'api') {
        try {
          const verified = await api.me();
          if (verified.profile.id !== saved.profileId) throw new Error('Profil différent.');
          sessionRef.current = saved;
          setSession(saved);
          setState(verified);
          setStateTime(verified.synchronized_at);
          setLink('connected');
        } catch {
          await storage.clearSession();
        }
      }
      setReady(true);
    })();
  }, [showCache]);

  useEffect(() => {
    if (!session) return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [session, refresh]);

  const setStationUrl = useCallback(async (url: string) => {
    setApiUrl(url);
    setApiUrlState(url.trim().replace(/\/+$/, ''));
    await storage.saveApiUrl(url.trim());
  }, []);

  const login = useCallback(async (mode: Mode, profileId: string, code: string) => {
    let name: string;
    if (mode === 'demo') name = demo.profileName(profileId);
    else name = (await api.login(profileId, code)).name;
    const next: Session = { mode, profileId, name };
    // Changement de profil : on vide l'affichage avant de lire le cache du nouveau profil.
    setState(null);
    setStateTime(null);
    setFromCache(false);
    setLink('loading');
    sessionRef.current = next;
    setSession(next);
    await storage.saveSession(next);
    await showCache(next);
  }, [showCache]);

  const logout = useCallback(async () => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s?.mode === 'api') {
      try {
        await api.logout();
      } catch {
        // Station injoignable : la session locale est quand même fermée.
      }
    }
    setSession(null);
    setState(null);
    setStateTime(null);
    setLink('loading');
    await storage.clearSession();
  }, []);

  const ask = useCallback(async (topic: Topic) => {
    const s = sessionRef.current;
    if (!s) throw new Error('Aucun profil ouvert.');
    return s.mode === 'demo' ? demo.discussion(s, topic) : api.discussion(topic);
  }, []);

  const report = useCallback(async (category: ReportCategory) => {
    const s = sessionRef.current;
    if (!s) throw new Error('Aucun profil ouvert.');
    const result = s.mode === 'demo' ? await demo.report(s, category) : await api.report(category);
    refresh();
    return result;
  }, [refresh]);

  const value = useMemo<AppValue>(
    () => ({ ready, session, state, stateTime, fromCache, link, linkMessage, apiUrl, setStationUrl, login, logout, refresh, ask, report }),
    [ready, session, state, stateTime, fromCache, link, linkMessage, apiUrl, setStationUrl, login, logout, refresh, ask, report],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp doit être utilisé dans AppProvider');
  return value;
}
