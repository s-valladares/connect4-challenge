/**
 * Crea una partida de práctica contra un bot de la casa (R02).
 * Uso: npm run practice [-- casa-basico 1]
 *   arg1: casa-aleatorio | casa-basico (default casa-basico)
 *   arg2: quién abre, 1 = nosotros, 2 = la casa (default 1)
 * Requiere worker corriendo en otra terminal para jugar el turno.
 */
import 'dotenv/config';

const opponent = process.argv[2] ?? 'casa-basico';
const first = Number(process.argv[3] ?? 1);

const res = await fetch(`${process.env.ARBITRO_URL}/api/practice`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.TEAM_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ opponent, first }),
});

console.log(res.status, await res.json());
