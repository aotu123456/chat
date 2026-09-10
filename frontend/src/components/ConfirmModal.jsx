export default function ConfirmModal({ state, onClose }) {
  if (!state) return null;

  return (
    <div
      id="modal-mask"
      className="modal-mask"
      onClick={(e) => { if (e.target.id === 'modal-mask') onClose(false); }}
    >
      <div className="modal">
        <h3 id="modal-title">{state.title}</h3>
        <p id="modal-text">{state.text}</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" id="modal-cancel" onClick={() => onClose(false)}>
            取消
          </button>
          <button type="button" className="btn danger" id="modal-ok" onClick={() => onClose(true)}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}