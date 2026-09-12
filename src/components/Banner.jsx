/** Полоса с сообщением над итогами: заметка о новом или найденное обновление. */
export default function Banner({ title, text, action, dismiss, onAction, onDismiss }) {
  return (
    <section className="banner">
      <h3 className="banner__title">{title}</h3>
      <p className="banner__text">{text}</p>
      <div className="banner__actions">
        <button className="btn btn--ghost" onClick={onDismiss}>{dismiss}</button>
        <button className="btn btn--primary" onClick={onAction}>{action}</button>
      </div>
    </section>
  )
}
