import styles from '../styles/game.module.css';

const TEXT = { checking: 'Conectando…', online: 'Conectado', offline: 'Sin conexión con la API' };

/** Estado de la conexión con la API local (GET /api/health) y aviso de jugada incierta. */
export default function ConnectionStatus({ status, uncertain = false, onRefresh, onRetry, onCheck }) {
  return (
    <>
      <p className={`${styles.pill} ${styles[status]}`}>
        <span aria-hidden="true">●</span> {TEXT[status]}
        {status === 'offline' && <button type="button" onClick={onCheck}>Reintentar conexión</button>}
      </p>
      {uncertain && (
        <div className={styles.banner} role="alert">
          <span>Perdimos la conexión mientras enviábamos tu jugada.</span>
          <button type="button" onClick={onRefresh}>Ver estado actual</button>
          <button type="button" onClick={onRetry}>Reintentar</button>
        </div>
      )}
    </>
  );
}
