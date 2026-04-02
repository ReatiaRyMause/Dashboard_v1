/**
 * DashboardView.tsx
 *
 * Vista de la pestaña "Dashboard".
 *
 * Muestra un análisis visual del dataset limpio con:
 *   - Tarjetas de resumen: total de filas, filas limpias, eliminadas y columnas.
 *   - Una gráfica por columna, adaptada al tipo de dato:
 *       · Columnas numéricas → histograma de barras con estadísticas (mín, máx, promedio).
 *       · Columnas categóricas con ≤ 6 valores únicos → gráfica de pastel (donut).
 *       · Columnas categóricas con > 6 valores únicos → barras horizontales (top 10).
 *
 * Todas las gráficas se generan con Recharts y son responsivas.
 * El análisis se recalcula con `useMemo` solo cuando cambian los datos limpios.
 */

'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useData, Row } from '../store'

/** Paleta de colores para las gráficas de pastel y barras categóricas. */
const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#fb923c']

// =============================================================================
// Funciones de análisis por columna
// =============================================================================

/**
 * Determina si un valor string puede interpretarse como número.
 * Excluye cadenas vacías para evitar falsos positivos.
 *
 * @param val - Valor a evaluar.
 * @returns `true` si el valor es un número válido.
 */
function isNumeric(val: string): boolean {
  return val !== '' && !isNaN(Number(val))
}

/**
 * Analiza una columna del dataset limpio y devuelve los datos necesarios
 * para renderizar su gráfica correspondiente.
 *
 * Para columnas numéricas:
 *   - Calcula mínimo, máximo y promedio.
 *   - Agrupa los valores en 8 intervalos (bins) para el histograma.
 *
 * Para columnas categóricas:
 *   - Cuenta la frecuencia de cada valor único.
 *   - Devuelve los 10 valores más frecuentes ordenados de mayor a menor.
 *
 * @param header - Nombre de la columna a analizar.
 * @param rows   - Filas del dataset limpio.
 * @returns Objeto con el tipo de columna y los datos para la gráfica.
 */
function analyzeColumn(header: string, rows: Row[]) {
  const values = rows.map((r) => r[header])

  // Determinar si todos los valores son numéricos
  const numeric = values.every(isNumeric)

  if (numeric) {
    // ── Análisis numérico ──────────────────────────────────────────────────
    const nums = values.map(Number)
    const min  = Math.min(...nums)
    const max  = Math.max(...nums)
    const avg  = nums.reduce((a, b) => a + b, 0) / nums.length

    // Crear 8 bins para el histograma
    const buckets = 8
    const step    = (max - min) / buckets || 1 // evitar división por cero

    // Inicializar todos los bins en 0
    const bins: Record<string, number> = {}
    for (let i = 0; i < buckets; i++) {
      bins[`${(min + i * step).toFixed(1)}`] = 0
    }

    // Asignar cada valor a su bin correspondiente
    for (const n of nums) {
      const idx   = Math.min(Math.floor((n - min) / step), buckets - 1)
      const label = `${(min + idx * step).toFixed(1)}`
      bins[label] = (bins[label] ?? 0) + 1
    }

    return {
      type: 'numeric' as const,
      min, max, avg,
      chartData: Object.entries(bins).map(([nombre, frecuencia]) => ({ nombre, frecuencia })),
    }
  } else {
    // ── Análisis categórico ────────────────────────────────────────────────
    const freq: Record<string, number> = {}
    for (const v of values) freq[v] = (freq[v] ?? 0) + 1

    // Ordenar por frecuencia descendente y tomar los 10 primeros
    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      type: 'categorical' as const,
      unique: Object.keys(freq).length,
      chartData: sorted.map(([nombre, cantidad]) => ({ nombre, cantidad })),
    }
  }
}

// =============================================================================
// Datos para las tarjetas de resumen
// =============================================================================

/**
 * Genera el arreglo de datos para las tarjetas de estadísticas generales.
 *
 * @param rows      - Filas originales del dataset.
 * @param cleanRows - Filas limpias tras el proceso de limpieza.
 * @param headers   - Nombres de las columnas.
 * @returns Arreglo de objetos con etiqueta, valor y color para cada tarjeta.
 */
const statCards = (rows: Row[], cleanRows: Row[], headers: string[]) => [
  { label: 'Total filas',      value: rows.length,                    color: 'text-slate-800'  },
  { label: 'Filas limpias',    value: cleanRows.length,               color: 'text-indigo-600' },
  { label: 'Filas eliminadas', value: rows.length - cleanRows.length, color: 'text-red-500'    },
  { label: 'Columnas',         value: headers.length,                 color: 'text-slate-800'  },
]

// =============================================================================
// Componente principal
// =============================================================================

/**
 * Componente principal de la pestaña "Dashboard".
 * Consume el contexto global para acceder a los datos limpios y
 * renderiza las gráficas de análisis por columna.
 */
export default function DashboardView() {
  const { headers, cleanRows, rows } = useData()

  /**
   * Análisis por columna memoizado.
   * Solo se recalcula cuando cambian `headers` o `cleanRows`,
   * evitando cómputos innecesarios en cada render.
   */
  const analyses = useMemo(
    () => headers.map((h) => ({ header: h, ...analyzeColumn(h, cleanRows) })),
    [headers, cleanRows]
  )

  // Estado: sin datos cargados
  if (!rows.length) {
    return (
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-slate-400 text-sm">
          No hay datos cargados.{' '}
          <Link href="/data" className="text-indigo-600 hover:underline">Cargar un archivo</Link>
        </p>
      </main>
    )
  }

  // Estado: datos cargados pero todas las filas fueron eliminadas
  if (!cleanRows.length) {
    return (
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-slate-400 text-sm">No hay filas limpias para mostrar en el tablero.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

      {/* ── Título de la sección ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Basado en {cleanRows.length} filas limpias · {headers.length} columnas
        </p>
      </div>

      {/* ── Tarjetas de resumen ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards(rows, cleanRows, headers).map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-semibold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Gráficas por columna ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {analyses.map((col) => (
          <div key={col.header} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">

            {/* Encabezado de la tarjeta: nombre de columna y badge de tipo */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">{col.header}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {col.type === 'numeric'
                    ? `numérico · ${cleanRows.length} valores`
                    : `categórico · ${col.unique} únicos`}
                </p>
              </div>
              {/* Badge de tipo de columna */}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                col.type === 'numeric'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-cyan-50 text-cyan-600'
              }`}>
                {col.type === 'numeric' ? 'Numérico' : 'Categórico'}
              </span>
            </div>

            {/* ── Gráfica según tipo de columna ─────────────────────────────── */}

            {col.type === 'numeric' ? (
              /* Columna numérica: mini-stats + histograma de barras */
              <>
                {/* Estadísticas rápidas: mínimo, máximo y promedio */}
                <div className="flex gap-4 mb-4">
                  {[
                    { label: 'Mín',  val: col.min.toFixed(2) },
                    { label: 'Máx',  val: col.max.toFixed(2) },
                    { label: 'Prom', val: col.avg.toFixed(2) },
                  ].map((s) => (
                    <div key={s.label} className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-slate-400">{s.label}</p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">{s.val}</p>
                    </div>
                  ))}
                </div>

                {/* Histograma de distribución */}
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={col.chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="frecuencia" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>

            ) : col.chartData.length <= 6 ? (
              /* Columna categórica con pocos valores: gráfica de pastel (donut) */
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={col.chartData}
                    dataKey="cantidad"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}   // Agujero central para efecto donut
                    outerRadius={75}
                    paddingAngle={3}   // Separación visual entre segmentos
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {/* Asignar color a cada segmento de la paleta */}
                    {col.chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>

            ) : (
              /* Columna categórica con muchos valores: barras horizontales (top 10) */
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={col.chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="nombre"
                    type="category"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="cantidad" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

          </div>
        ))}
      </div>

    </main>
  )
}
