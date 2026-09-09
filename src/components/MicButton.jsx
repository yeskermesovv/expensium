export default function MicButton({ listening, disabled, onClick }) {
  return (
    <button
      className={`mic ${listening ? 'mic--on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={listening ? 'Остановить запись' : 'Начать запись'}
    >
      <span className="mic__ring" />
      <span className="mic__ring mic__ring--slow" />
      <svg viewBox="0 0 24 24" className="mic__icon" aria-hidden="true">
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
        <path d="M18 11a6 6 0 0 1-12 0M12 17v4M8.5 21h7" fill="none" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  )
}
