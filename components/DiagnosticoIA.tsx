import React, { useState, useEffect } from 'react';
import { Brain, AlertTriangle, CheckCircle, TrendingUp, Droplets, Sprout, ShieldAlert, Calendar, Thermometer, Wind, CloudRain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Simulación de datos de la finca (en producción vendrían de la DB)
const mockFincaData = {
  clima: { temp: 24, humedad: 78, lluviaRecente: true, viento: 12 },
  lotes: [
    { id: 1, nombre: 'Lote A - Hass', edad: 5, fase: 'Floración', salud: 85, plagas: 0, riego: 'Óptimo' },
    { id: 2, nombre: 'Lote B - Fuerte', edad: 8, fase: 'Cuajado', salud: 60, plagas: 2, riego: 'Deficitario' },
    { id: 3, nombre: 'Lote C - Criollo', edad: 12, fase: 'Cosecha', salud: 92, plagas: 0, riego: 'Óptimo' },
  ],
  tareasPendientes: 4,
  ultimoReportePlagas: 'Hace 3 días'
};

const DiagnosticoIA = () => {
  const [analisis, setAnalisis] = useState(null);
  const [loading, setLoading] = useState(true);

  // Motor de "IA" basado en reglas expertas para Aguacate
  useEffect(() => {
    const generarDiagnostico = () => {
      const riesgos = [];
      const recomendaciones = [];
      let puntajeSaludGeneral = 0;

      // 1. Análisis Climático y de Enfermedades (Phytophthora / Root Rot)
      if (mockFincaData.clima.humedad > 75 && mockFincaData.clima.lluviaRecente) {
        riesgos.push({
          tipo: 'CRÍTICO',
          titulo: 'Alto Riesgo de Hongos (Phytophthora)',
          desc: 'La combinación de alta humedad (>75%) y lluvias recientes crea el ambiente perfecto para la pudrición de raíz.',
          icon: <CloudRain className="text-blue-500" />
        });
        recomendaciones.push('Aplicar fungicida preventivo (Fosfito de Potasio) en los lotes bajos.');
        recomendaciones.push('Revisar sistemas de drenaje inmediatamente.');
      } else if (mockFincaData.clima.humedad < 40) {
        riesgos.push({
          tipo: 'ALERTA',
          titulo: 'Estrés Hídrico Inminente',
          desc: 'Humedad muy baja puede causar caída de flor o fruto cuajado.',
          icon: <Thermometer className="text-orange-500" />
        });
        recomendaciones.push('Aumentar frecuencia de riego en un 20%.');
      }

      // 2. Análisis por Lote
      mockFincaData.lotes.forEach(lote => {
        puntajeSaludGeneral += lote.salud;
        
        if (lote.fase === 'Floración' && lote.riego === 'Deficitario') {
          riesgos.push({
            tipo: 'ALERTA',
            titulo: `Riesgo en ${lote.nombre}`,
            desc: 'Déficit hídrico durante la floración causará caída masiva de flores.',
            icon: <Sprout className="text-yellow-500" />
          });
        }

        if (lote.plagas > 0) {
          riesgos.push({
            tipo: 'ATENCIÓN',
            titulo: `Presencia de Plagas en ${lote.nombre}`,
            desc: 'Se han reportado focos de plagas que pueden afectar la calidad del fruto.',
            icon: <ShieldAlert className="text-red-500" />
          });
          recomendaciones.push(`Realizar muestreo y control integrado en ${lote.nombre}.`);
        }
      });

      const saludPromedio = Math.round(puntajeSaludGeneral / mockFincaData.lotes.length);
      
      // 3. Generación de Veredicto Final
      let veredicto = "ESTABLE";
      let colorVeredicto = "bg-green-100 text-green-800";
      if (riesgos.filter(r => r.tipo === 'CRÍTICO').length > 0) {
        veredicto = "REQUIERE ATENCIÓN INMEDIATA";
        colorVeredicto = "bg-red-100 text-red-800";
      } else if (riesgos.length > 2) {
        veredicto = "INESTABLE";
        colorVeredicto = "bg-orange-100 text-orange-800";
      }

      setAnalisis({
        saludPromedio,
        veredicto,
        colorVeredicto,
        riesgos,
        recomendaciones,
        prediccionCosecha: saludPromedio > 80 ? 'Alta (Estimada +15%)' : 'Media/Baja (Monitorear)'
      });
      setLoading(false);
    };

    // Simular tiempo de procesamiento de IA
    setTimeout(generarDiagnostico, 1500);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Brain className="w-12 h-12 animate-pulse text-blue-600" />
        <p className="text-lg font-medium text-gray-600">El Asistente Agrícola está analizando los datos...</p>
        <p className="text-sm text-gray-400">Cruzando información de clima, suelo y fenología</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header del Diagnóstico */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            Diagnóstico Inteligente de la Finca
          </h2>
          <p className="text-gray-500">Análisis generado automáticamente basado en datos en tiempo real.</p>
        </div>
        <Badge className={`px-4 py-2 text-lg ${analisis.colorVeredicto}`}>
          Estado General: {analisis.veredicto}
        </Badge>
      </div>

      {/* Tarjetas de Resumen Superior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Salud Promedio del Cultivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analisis.saludPromedio}%</div>
            <Progress value={analisis.saludPromedio} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Predicción de Cosecha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {analisis.prediccionCosecha}
            </div>
            <p className="text-xs text-gray-400 mt-1">Basado en cuajado y salud actual</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Factores de Riesgo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analisis.riesgos.length}</div>
            <p className="text-xs text-gray-400 mt-1">Detectados por el sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Sección Principal: Riesgos y Recomendaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Columna Izquierda: Riesgos Detectados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Alertas y Riesgos Detectados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analisis.riesgos.length === 0 ? (
              <div className="text-center py-8 text-green-600">
                <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                <p>No se detectaron riesgos críticos actualmente.</p>
              </div>
            ) : (
              analisis.riesgos.map((riesgo, idx) => (
                <Alert key={idx} variant={riesgo.tipo === 'CRÍTICO' ? 'destructive' : 'default'} className={riesgo.tipo !== 'CRÍTICO' ? 'border-yellow-500 bg-yellow-50' : ''}>
                  <div className="flex gap-3">
                    <div className="mt-1">{riesgo.icon}</div>
                    <div>
                      <AlertTitle className="font-bold">{riesgo.titulo}</AlertTitle>
                      <AlertDescription>{riesgo.desc}</AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))
            )}
          </CardContent>
        </Card>

        {/* Columna Derecha: Plan de Acción */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Plan de Acción Recomendado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">La IA sugiere priorizar las siguientes acciones para maximizar la producción:</p>
            <ul className="space-y-3">
              {analisis.recomendaciones.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="min-w-[24px] h-6 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-gray-700 font-medium">{rec}</span>
                </li>
              ))}
              {analisis.recomendaciones.length === 0 && (
                <li className="text-gray-500 italic">Continuar con el plan de manejo habitual.</li>
              )}
            </ul>
            
            <div className="mt-6 pt-4 border-t">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                Generar Órdenes de Trabajo desde este Diagnóstico
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalle por Lotes */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis Detallado por Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Lote</th>
                  <th className="px-6 py-3">Fase Fenológica</th>
                  <th className="px-6 py-3">Salud</th>
                  <th className="px-6 py-3">Riego</th>
                  <th className="px-6 py-3">Diagnóstico IA</th>
                </tr>
              </thead>
              <tbody>
                {mockFincaData.lotes.map((lote) => (
                  <tr key={lote.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{lote.nombre}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline">{lote.fase}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Progress value={lote.salud} className="w-24 h-2" />
                        <span className={`font-bold ${lote.salud > 80 ? 'text-green-600' : 'text-orange-600'}`}>{lote.salud}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{lote.riego}</td>
                    <td className="px-6 py-4">
                      {lote.salud < 70 ? (
                        <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> Revisar</span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4"/> OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosticoIA;
