import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import ConfirmModal from './components/ConfirmModal';
import CreateView from './components/CreateView';
import SessionList from './components/SessionList';
import ChatView from './components/ChatView';
import Toast from './components/Toast';

export default function App() {
  const [view, setView] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const [currentSession, setCurrentSession] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const confirmDialog = useCallback((title, text) => (
    new Promise((resolve) => setConfirmState({ title, text, resolve }))
  ), []);

  const closeConfirm = useCallback((value) => {
    setConfirmState((prev) => {
      if (prev) prev.resolve(value);
      return null;
    });
  }, []);

  const refreshSessions = useCallback(() => setSessionsVersion((v) => v + 1), []);

  useEffect(() => {
    if (view !== 'sessions') return undefined;
    let cancelled = false;

    setSessionsLoading(true);
    setSessionsError('');
    api('/api/sessions')
      .then((items) => {
        if (cancelled) return;
        setSessions(items);
        setSessionsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setSessionsError(e.message);
        setSessionsLoading(false);
      });

    return () => { cancelled = true; };
  }, [view, sessionsVersion]);

  const openSession = useCallback(async (sid) => {
    try {
      const data = await api(`/api/sessions/${sid}`);
      setCurrentSession(data);
      setView('chat');
    } catch (e) {
      showToast(e.message);
    }
  }, [showToast]);

  const deleteSession = useCallback(async (sid, name) => {
    const ok = await confirmDialog('删除存档', `确认删除「${name}」?记忆与对话将一并删除,不可恢复。`);
    if (!ok) return;

    try {
      await api(`/api/sessions/${sid}`, { method: 'DELETE' });
      showToast('已删除');
      if (currentSession && currentSession.id === sid) {
        setCurrentSession(null);
        setView('sessions');
      }
      refreshSessions();
    } catch (e) {
      showToast(e.message);
    }
  }, [confirmDialog, currentSession, refreshSessions, showToast]);

  const handleCreated = useCallback(async (sid) => {
    await openSession(sid);
  }, [openSession]);

  return (
    <>
      {view === 'sessions' && (
        <SessionList
          sessions={sessions}
          loading={sessionsLoading}
          error={sessionsError}
          onRefresh={refreshSessions}
          onOpen={openSession}
          onDelete={(s) => deleteSession(s.id, s.name)}
          onCreate={() => setView('create')}
        />
      )}

      {view === 'create' && (
        <CreateView
          onBack={() => setView('sessions')}
          onCreated={handleCreated}
          showToast={showToast}
          confirmDialog={confirmDialog}
        />
      )}

      {view === 'chat' && currentSession && (
        <ChatView
          key={currentSession.id}
          session={currentSession}
          onSessionChange={setCurrentSession}
          onBack={() => { setView('sessions'); refreshSessions(); }}
          onDelete={() => deleteSession(currentSession.id, currentSession.name)}
          showToast={showToast}
        />
      )}

      <Toast message={toast} />
      <ConfirmModal state={confirmState} onClose={closeConfirm} />
    </>
  );
}