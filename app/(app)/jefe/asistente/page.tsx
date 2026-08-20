import { redirect } from 'next/navigation';
import { requerirUsuario } from '@/lib/auth';

/**
 * Pantalla oculta hasta que el jefe decida si contrata la IA.
 *
 * Es la única parte de la app que consume la API de Claude y por lo tanto la
 * única que genera factura: cada pregunta cuesta plata. Mientras no esté
 * aprobada, la puerta queda cerrada — también para quien escriba la dirección a
 * mano, que si no dejaría un gasto abierto sin que nadie lo haya autorizado.
 *
 * No se borró nada. El resto sigue en su lugar: la ruta
 * `app/api/jefe/asistente/route.ts`, el chat en `components/jefe/ChatAsistente.tsx`
 * y toda la lógica de `lib/ia/`. Para volver a mostrarla:
 *
 *   1. Recuperar el contenido de esta página del historial: el commit que la
 *      ocultó es el último que la tocó antes de este archivo.
 *   2. Devolver el atajo "Asistente" en `components/mapa3d/PanelCentral.tsx`.
 *
 * Sin `ANTHROPIC_API_KEY` en el entorno tampoco habría llamadas —el cliente
 * devuelve null y la pantalla lo avisa—, pero eso depende de una variable que
 * alguien puede poner sin darse cuenta. Cerrar la puerta acá no depende de eso.
 */
export default async function PaginaAsistente() {
  await requerirUsuario('JEFE');
  redirect('/jefe');
}
