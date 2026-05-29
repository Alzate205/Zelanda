import { requerirUsuario } from '@/lib/auth';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { FormularioNuevoMiembro } from './FormularioNuevoMiembro';

export const metadata = { title: 'Nuevo miembro' };

export default async function PaginaNuevoMiembro() {
  await requerirUsuario('JEFE');
  const config = await obtenerConfiguracion();
  return (
    <FormularioNuevoMiembro
      jornalTarifaDefault={
        config.jornal_tarifa_default != null ? Number(config.jornal_tarifa_default) : null
      }
      fijoSalarioDefault={
        config.fijo_salario_default != null ? Number(config.fijo_salario_default) : null
      }
      fijoPeriodoPagoDefault={config.fijo_periodo_pago_default ?? null}
    />
  );
}
