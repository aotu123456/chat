import { fmtTime, genreClass } from '../utils';

function EmptyState({ emoji, title, desc, children }) {
  return (
    <div className="empty-state">
      <div className="big-emoji">{emoji}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
      {children}
    </div>
  );
}

export default function SessionList({
  sessions,
  loading,
  error,
  onRefresh,
  onOpen,
  onDelete,
  onCreate,
}) {
  return (
    <section id="view-sessions" className="view">
      <header className="home-header">
        <div className="home-brand">
          <div className="brand-mark">⚔️</div>
          <div>
            <h1 className="logo">multiCHAT</h1>
            <p className="subtitle">多智能体 RPG · 每个存档都是一段冒险</p>
          </div>
        </div>
        <div className="home-actions">
          <span id="session-total" className="total-tag">
            {sessions.length ? `共 ${sessions.length} 个存档` : ''}
          </span>
          <button type="button" id="btn-new-session" className="btn primary big" onClick={onCreate}>
            ＋ 新建存档
          </button>
        </div>
      </header>

      <main className="sessions-grid" id="sessions-grid">
        {loading && (
          <EmptyState emoji="⏳" title="加载中" desc="正在读取存档列表..." />
        )}

        {!loading && error && (
          <EmptyState emoji="⚠️" title="加载失败" desc={error}>
            <div>
              <button type="button" className="btn primary" onClick={onRefresh}>重新加载</button>
            </div>
          </EmptyState>
        )}

        {!loading && !error && sessions.length === 0 && (
          <EmptyState
            emoji="🏰"
            title="还没有存档"
            desc="创建你的第一个世界,书写属于你的冒险故事"
          >
            <div>
              <button type="button" className="btn primary" onClick={onCreate}>✨ 创建世界</button>
            </div>
          </EmptyState>
        )}

        {!loading && !error && sessions.map((s) => {
          const avatars = (s.avatars || []).slice(0, 4);
          return (
            <div
              key={s.id}
              className="session-card"
              onClick={() => onOpen(s.id)}
            >
              <div className="card-top">
                <span className={`badge ${genreClass(s.genre)}`}>{s.genre || '未分类'}</span>
                <span className="card-time">{fmtTime(s.updated_at)}</span>
              </div>

              <div className="card-title">{s.name}</div>
              <div className="card-synopsis">{s.synopsis || '暂无简介'}</div>
              <hr className="card-divider" />

              <div className="card-meta">
                <div className="avatar-stack">
                  {[...avatars, s.player_avatar || '🧙'].map((avatar, index) => (
                    <span className="av" key={`${s.id}-avatar-${index}`}>{avatar}</span>
                  ))}
                  {s.character_count > avatars.length && (
                    <span className="av plus">+{s.character_count - avatars.length}</span>
                  )}
                </div>
                <span>👤 {s.character_count} · 💬 {s.message_count}</span>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="btn enter-btn"
                  onClick={(e) => { e.stopPropagation(); onOpen(s.id); }}
                >
                  进入冒险
                </button>
                <button
                  type="button"
                  className="btn del-btn"
                  onClick={(e) => { e.stopPropagation(); onDelete(s); }}
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </section>
  );
}