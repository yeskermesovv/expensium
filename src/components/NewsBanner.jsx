/** Разовая заметка о новой возможности. Показывается над итогами. */
export default function NewsBanner({ news, onAction, onClose }) {
  return (
    <section className="news">
      <h3 className="news__title">{news.title}</h3>
      <p className="news__text">{news.text}</p>
      <div className="news__actions">
        <button className="btn btn--ghost" onClick={onClose}>Понятно</button>
        <button className="btn btn--primary" onClick={onAction}>{news.action}</button>
      </div>
    </section>
  )
}
