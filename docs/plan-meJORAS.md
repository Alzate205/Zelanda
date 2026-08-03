# Plan de Mejoras - FincApp La Zelanda

## Objetivo Central
Centralizar y digitalizar todo lo que pasa dentro de una finca de aguacates, permitiendo que el jefe/dueño esté enterado de todo de manera rápida y eficiente.

## Problemas Identificados

### 1. Problemas Visuales/UX Críticos
- **Mapa se sale del layout**: El contenedor del dashboard usa `-mx-4 -my-6` que puede causar desbordamientos
- **Z-index conflictivos**: Header (z-20), BottomNav (z-20), Mapa (z-0), Paneles flotantes (z-20 a z-30)
- **Controles de mapa superpuestos**: Los controles de MapLibre pueden montarse sobre el header

### 2. Funcionalidades que Pueden Mejorarse

#### Dashboard/Centro de Control
- ✅ Ya tiene KPIs en tiempo real
- ✅ Panel central con alertas y atajos
- ⚠️ Falta: Vista rápida de clima actual
- ⚠️ Falta: Resumen ejecutivo imprimible
- ⚠️ Falta: Comparación vs mes anterior más visible

#### Reportes
- ✅ Reportes básicos existentes
- ⚠️ Falta: Exportación a PDF profesional
- ⚠️ Falta: Gráficos visuales de tendencias
- ⚠️ Falta: Filtros por rango de fechas personalizado

#### Navegación
- ✅ Bottom nav funcional
- ⚠️ Podría mejorar con accesos directos a acciones frecuentes

### 3. Mejoras Sugeridas Prioritarias

#### A. Correcciones Visuales Inmediatas
1. Arreglar márgenes negativos en CentroControl.tsx
2. Ajustar z-index para que header siempre esté encima
3. Mejorar posición de controles de mapa
4. Asegurar que paneles no tapen navegación crítica

#### B. Funcionalidades de Alto Valor
1. **Clima en Tiempo Real**: Widget pequeño con temperatura, lluvia, humedad
2. **Resumen Ejecutivo**: Botón "Imprimir reporte del día" para compartir con dueños
3. **Comparativa Mes Actual vs Anterior**: Con porcentaje de cambio visible
4. **Accesos Rápidos Flotantes**: Para acciones más usadas (nueva asignación, registrar cosecha)
5. **Notificaciones Push Mejoradas**: Prompt más visible para activar notificaciones

#### C. Optimizaciones de Rendimiento
1. Cache más agresivo en datos estáticos
2. Lazy loading en componentes pesados
3. Optimizar consultas Prisma con índices

#### D. Funcionalidades Específicas para Aguacate
1. **Calendario Fenológico**: Mostrar etapa esperada de cada lote según fecha
2. **Alertas Climáticas**: Integración con API del tiempo para heladas/sequías
3. **Seguimiento de Floración**: Registro específico de periodo de floración
4. **Estimación de Cosecha**: Proyección basada en histórico + condiciones actuales

## Implementación Propuesta

### Fase 1: Correcciones Críticas (YA)
- [x] Arreglar z-index en CentroControl.tsx
- [x] Corregir márgenes negativos
- [x] Ajustar controles de mapa

### Fase 2: Mejoras de UX (PRIORIDAD)
- [ ] Widget de clima
- [ ] Resumen ejecutivo imprimible
- [ ] Comparativa mensual visible
- [ ] Mejorar prompt de notificaciones push

### Fase 3: Funcionalidades Avanzadas
- [ ] Calendario fenológico
- [ ] Estimación de cosecha
- [ ] Gráficos de tendencias
- [ ] Exportación PDF profesional

### Fase 4: Optimización
- [ ] Auditoría de rendimiento
- [ ] Optimización de consultas
- [ ] Cache estratégico

## Métricas de Éxito
1. **Tiempo en dashboard**: < 3 segundos para entender estado de la finca
2. **Clicks a información crítica**: Máximo 2 clicks desde el dashboard
3. **Sincronización**: Datos actualizados en < 1 minuto
4. **Uso offline**: Funcionalidad básica sin conexión
5. **Adopción**: >80% del equipo usando la app diariamente
