import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="panel">
      <h1 className="panel__title">Страница не найдена</h1>
      <p className="panel__text">
        Такой страницы нет. <Link to="/">Вернуться на главную</Link>
      </p>
    </section>
  )
}
