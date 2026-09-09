const STATUS_TEXT = {
  idle: 'Не синхронизируется',
  syncing: 'Синхронизирую…',
  ok: 'Записи в облаке',
  offline: 'Нет сети, отправлю позже',
  error: 'Облако не отвечает',
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="google-mark" aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.3 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10z" />
      <path fill="#EA4335" d="M24 10.6c3.2 0 5.4 1.4 6.7 2.6l5.9-5.8C33 4.1 29.9 2 24 2 15.4 2 8 6.7 4.4 14l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z" />
    </svg>
  )
}

/** Вход через Google и состояние синхронизации. Живёт в настройках. */
export default function CloudPanel({ cloud, onSync }) {
  if (!cloud.configured) {
    return (
      <p className="cloud__hint">
        Облако не подключено: записи хранятся только на этом устройстве.
      </p>
    )
  }

  if (!cloud.user) {
    return (
      <div className="cloud">
        <button className="btn btn--google" onClick={cloud.signIn}>
          <GoogleMark />
          Войти через Google
        </button>
        <p className="cloud__hint">
          После входа записи будут синхронизироваться между телефоном и компьютером.
          Без входа всё работает как раньше, только на этом устройстве.
        </p>
      </div>
    )
  }

  return (
    <div className="cloud">
      <div className="cloud__row">
        <span className="cloud__user">{cloud.user.email}</span>
        <span className={`cloud__status cloud__status--${cloud.status}`}>
          {STATUS_TEXT[cloud.status] ?? ''}
        </span>
      </div>
      {cloud.error && <p className="cloud__error">{cloud.error}</p>}
      <div className="cloud__actions">
        <button className="btn btn--ghost" onClick={onSync} disabled={cloud.status === 'syncing'}>
          Синхронизировать
        </button>
        <button className="btn btn--ghost" onClick={cloud.signOut}>Выйти</button>
      </div>
    </div>
  )
}
