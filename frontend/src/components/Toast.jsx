export default function Toast({ message }) {
  return (
    <div id="toast" className={`toast${message ? '' : ' hidden'}`}>
      {message || ''}
    </div>
  );
}