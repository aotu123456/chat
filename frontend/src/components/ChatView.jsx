import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';

function WorldPanel({ world }) {
  const state = world?.state || {};
  return (
    <div className="side-panel" id="world-panel">
      <h3>🌍 世界状态</h3>
      <div className="world-card">
        <div className="wr"><span className="k">时间</span><span className="v">{state.time || '-'}</span></div>
        <div className="wr"><span className="k">天气</span><span className="v">{state.weather || '-'}</span></div>
        <div className="wr"><span className="k">地点</span><span className="v">{state.location || '-'}</span></div>
        <div className="wr"><span className="k">事件</span><span className="v">{(state.recent_events || []).join('; ') || '无'}</span></div>
        <div className="wr"><span className="k">在场</span><span className="v">{(state.active_characters || []).join(', ') || '-'}</span></div>
      </div>
    </div>
  );
}

function CharPanel({ session, selectedAgentIds, onToggle, player }) {
  return (
    <div className="side-panel" id="char-panel">
      <h3>角色(点击可暂停参与)</h3>
      {session.characters.map((character) => {
        const status = character.status || {};
        const active = selectedAgentIds.has(character.id);
        const hp = status.hp == null || status.hp === '' ? '' : ` · HP ${status.hp}`;
        return (
          <div
            key={character.id}
            className={`char-card${active ? '' : ' paused'}`}
            onClick={() => onToggle(character.id)}
          >
            <span className="c-avatar">{character.avatar || '🎭'}</span>
            <div className="c-info">
              <div className="c-name">{character.name}</div>
              <div className="c-status">
                {`${status.emotion || ''}${hp} · ${status.location || ''}`.trim() || '状态未知'}
              </div>
            </div>
            <span className="c-check">{active ? '✓' : '✕'}</span>
          </div>
        );
      })}

      <h3 style={{ marginTop: 6 }}>我的角色</h3>
      <div className="char-card">
        <span className="c-avatar">{player.avatar || '🧙'}</span>
        <div className="c-info">
          <div className="c-name">{player.name}</div>
          <div className="c-status">{(player.status || {}).location || ' '}</div>
        </div>
      </div>
    </div>
  );
}

function MessageItem({ message, session, agentMap }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  let agent = null;

  if (!isUser && !isError) {
    agent = message.agent_id
      ? session.characters.find((c) => c.id === message.agent_id)
      : agentMap[message.role];
  }

  const isAgent = !isUser && !isError && (message.role === 'agent' || agent);
  const className = isUser ? 'user' : (isError ? 'error' : (isAgent ? 'agent' : 'system'));
  const name = isUser ? (message.name || session.player.name) : (agent ? agent.name : message.name);
  const avatar = isUser ? (session.player.avatar || '🧙') : (agent ? agent.avatar : '');

  return (
    <div className={`msg ${className}`}>
      {name && <span className="msg-role">{avatar} {name}</span>}
      {message.content && <span>{message.content}</span>}
      {message.image && <img src={message.image} alt="场景图" />}
    </div>
  );
}

export default function ChatView({
  session,
  onSessionChange,
  onBack,
  onDelete,
  showToast,
}) {
  const [messages, setMessages] = useState(() => session.messages || []);
  const [selectedAgentIds, setSelectedAgentIds] = useState(
    () => new Set(session.characters.map((c) => c.id)),
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const messagesRef = useRef(null);
  const streamRef = useRef({ agentId: null });

  const agentMap = useMemo(
    () => Object.fromEntries(session.characters.map((c) => [c.id, c])),
    [session.characters],
  );

  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  const updateSession = (updater) => {
    onSessionChange((prev) => (
      typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
    ));
  };

  const toggleAgent = (agentId) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleSSEEvent = (part) => {
    const lines = part.split('\n');
    let event = 'message';
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }

    if (!dataLines.length) return;

    let data;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch (e) {
      return;
    }

    switch (event) {
      case 'agent_reply': {
        const sameAgent = streamRef.current.agentId === data.agent_id;
        streamRef.current.agentId = data.agent_id;

        setMessages((prev) => {
          if (!sameAgent) {
            return [
              ...prev,
              {
                role: 'agent',
                agent_id: data.agent_id,
                name: data.name,
                content: data.content || '',
              },
            ];
          }
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            content: `${last?.content || ''}${data.content || ''}`,
          };
          return next;
        });
        break;
      }
      case 'world_update':
        updateSession((prev) => ({
          ...prev,
          world: { ...prev.world, state: data.world },
        }));
        break;
      case 'error':
        setMessages((prev) => [
          ...prev,
          { role: 'error', content: `服务端错误: ${data.error || '未知错误'}` },
        ]);
        break;
      default:
        break;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (sending || !text) return;

    setSending(true);
    setInput('');
    streamRef.current.agentId = null;
    setMessages((prev) => [
      ...prev,
      { role: 'user', name: session.player.name, content: text },
    ]);

    try {
      const res = await fetch(`/api/sessions/${session.id}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          agent_ids: Array.from(selectedAgentIds),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) handleSSEEvent(part);
      }
      if (buffer.trim()) handleSSEEvent(buffer);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', content: `连接失败: ${e.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const generateImage = async () => {
    if (imageLoading) return;
    setImageLoading(true);
    const tempId = `image-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'agent', name: '🎨 画师', content: '正在绘制场景图,请稍候...' },
    ]);

    try {
      const data = await api(`/api/sessions/${session.id}/image`, {
        method: 'POST',
        body: {},
      });

      setMessages((prev) => prev.map((msg) => {
        if (msg.id !== tempId) return msg;
        if (data.success) {
          return { id: tempId, role: 'agent', name: '🎨 场景图', image: data.url };
        }
        return { id: tempId, role: 'error', content: `图片生成失败: ${data.error || '未知错误'}` };
      }));
    } catch (e) {
      setMessages((prev) => prev.map((msg) => (
        msg.id === tempId
          ? { id: tempId, role: 'error', content: `图片生成请求失败: ${e.message}` }
          : msg
      )));
    } finally {
      setImageLoading(false);
    }
  };

  const renameSession = async () => {
    const name = window.prompt('修改存档名称', session.name);
    if (!name || !name.trim() || name.trim() === session.name) return;

    try {
      const result = await api(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      updateSession((prev) => ({ ...prev, name: result.name }));
      showToast('已改名');
    } catch (e) {
      showToast(e.message);
    }
  };

  return (
    <section id="view-chat" className="view">
      <header className="chat-topbar">
        <button type="button" className="btn ghost" id="btn-back-to-list" onClick={onBack}>
          ← 存档列表
        </button>
        <div className="topbar-title">
          <span
            id="chat-session-name"
            className="session-name"
            title="双击改名"
            onDoubleClick={renameSession}
          >
            {session.name}
          </span>
          {session.genre && <span id="chat-genre" className="badge">{session.genre}</span>}
        </div>
        <div className="topbar-right">
          <span id="chat-player" className="player-tag">
            {session.player.avatar || '🧙'} {session.player.name}
          </span>
          <button type="button" className="btn danger tiny" id="btn-delete-session" onClick={onDelete}>
            删除
          </button>
        </div>
      </header>

      <div className="chat-layout">
        <aside className="chat-sidebar" id="chat-sidebar">
          <WorldPanel world={session.world} />
          <CharPanel
            session={session}
            selectedAgentIds={selectedAgentIds}
            onToggle={toggleAgent}
            player={session.player}
          />
        </aside>

        <main className="chat-area">
          <div className="messages" id="messages" ref={messagesRef}>
            {messages.length === 0 ? (
              <div className="welcome">
                <h2>冒险即将开始</h2>
                <p>和世界中的角色们聊聊吧。</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageItem
                  key={message.id || `message-${index}`}
                  message={message}
                  session={session}
                  agentMap={agentMap}
                />
              ))
            )}
          </div>

          <div className="input-bar">
            <input
              type="text"
              value={input}
              placeholder={`以「${session.player.name}」的身份说...(Enter 发送)`}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button type="button" className="btn primary" id="send-btn" disabled={sending} onClick={sendMessage}>
              发送
            </button>
            <button
              type="button"
              className="btn secondary"
              id="image-btn"
              disabled={imageLoading}
              onClick={generateImage}
            >
              🎨 生成场景图
            </button>
          </div>
        </main>
      </div>
    </section>
  );
}