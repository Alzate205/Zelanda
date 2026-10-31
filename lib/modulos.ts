/**
 * Módulos que se pueden apagar sin borrar código ni datos.
 *
 * NÓMINA agrupa todo lo que es plata que la finca le paga a la gente: pagos,
 * tarifas, jornales, servicios contratados, ausencias, salario y tarifa de cada
 * vinculación y el saldo por persona. Se apagó (2026-10-30) para presentarle
 * la app al dueño: en "Saldos" solo debe verse lo que entra por venta de
 * aguacate y lo que sale en compras.
 *
 * Apagado no borra nada: las tablas y los registros siguen en la base, las
 * pantallas responden 404 y los atajos no aparecen. Para volver a prenderlo
 * basta con poner `true`.
 */
export const MODULO_NOMINA = false;
