import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { obtenerConfiguracion } from '@/lib/configuracion';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { FormularioConfiguracion } from './FormularioConfiguracion';

export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion() {
  await requerirUsuario('JEFE');
  const config = await obtenerConfiguracion();

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header>
        <Eyebrow>Finca · Configuración</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Configuración</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Parámetros operativos y valores por defecto de la finca.
        </p>
      </header>

      <FormularioConfiguracion
        config={{
          finca_nombre: config.finca_nombre,
          finca_telefono: config.finca_telefono,
          finca_correo: config.finca_correo,
          canasta_kg_default: Number(config.canasta_kg_default),
          alerta_dias_anticipacion: config.alerta_dias_anticipacion,
          despacho_hora_corte: config.despacho_hora_corte,
          insumo_stock_minimo_default: Number(config.insumo_stock_minimo_default),
          jornal_tarifa_default:
            config.jornal_tarifa_default != null ? Number(config.jornal_tarifa_default) : null,
          fijo_salario_default:
            config.fijo_salario_default != null ? Number(config.fijo_salario_default) : null,
          fijo_periodo_pago_default: config.fijo_periodo_pago_default,
        }}
      />
    </div>
  );
}
