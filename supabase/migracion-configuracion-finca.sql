-- Panel de configuración del jefe: parámetros operativos de la finca
CREATE TABLE IF NOT EXISTS configuracion_finca (
  id                           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Cosecha: kg por canasta por defecto (método CANASTA)
  canasta_kg_default           NUMERIC(8,2)   NOT NULL DEFAULT 23,

  -- Alertas: días de anticipación para considerar tarea "próxima a vencer"
  alerta_dias_anticipacion     INT            NOT NULL DEFAULT 7,

  -- Bodega: hora de corte HH:MM para alertar despachos abiertos
  despacho_hora_corte          TEXT           NOT NULL DEFAULT '17:00',

  -- Bodega: stock mínimo por defecto al crear insumos nuevos
  insumo_stock_minimo_default  NUMERIC(10,3)  NOT NULL DEFAULT 0,

  -- Financiero: defaults al crear trabajadores (nullable, solo pre-rellenan)
  jornal_tarifa_default        NUMERIC(12,2),
  fijo_salario_default         NUMERIC(12,2),
  fijo_periodo_pago_default    tipo_periodo_pago,

  -- Datos de la finca (para reportes futuros)
  finca_nombre                 TEXT           NOT NULL DEFAULT 'Hacienda La Zelanda',
  finca_telefono               TEXT,
  finca_correo                 TEXT,

  -- Auditoría
  updated_at                   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_by                   UUID           REFERENCES auth.users(id)
);

-- Garantizar que siempre existe la fila con defaults
INSERT INTO configuracion_finca DEFAULT VALUES ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE configuracion_finca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jefe_lee_config" ON configuracion_finca
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'JEFE')
  );

CREATE POLICY "jefe_modifica_config" ON configuracion_finca
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'JEFE')
  );
