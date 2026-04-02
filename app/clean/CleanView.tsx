/**
 * CleanView.tsx
 *
 * Vista de la pestaña "Datos Limpios".
 *
 * Muestra:
 *   - Un resumen del proceso de limpieza: filas originales vs. filas limpias.
 *   - Badges por categoría de problema detectado (valores nulos, duplicados,
 *     negativos inválidos, fechas inválidas, inconsistencias de formato y
 *     tipos inválidos), con el conteo de filas afectadas en cada categoría.
 *   - La tabla con las filas que superaron todas las validaciones, ya normalizadas.
 *   - Indicadores de las normalizaciones aplicadas (fechas y texto).
 *   - Botón para descargar el dataset limpio como CSV con el sufijo "_limpio".
 */

'use client'

import Link from 'next/link'
import { useData } from '../store'
import DataTable from '../components/DataTable'
import Papa from 'papaparse'

// =============================================================================
// Función de descarga
// =============================================================================

/**
 * Genera y descarga el dataset limpio como archivo CSV.
 * El nombre del archivo descargado conserva el nombre original con el
 * sufijo "_limpio" antes de la extensión (ej. "datos.xlsx" → "datos_limpio.xlsx").
 *
 * @param headers  - Nombres de las columnas.
 * @param rows     - Filas limpias a exportar.
 * @param fileName - Nombre del archivo original cargado.
 */
function downloadClean(headers: string[], rows: import('../store').Row[], fileName: string) {
  // Serializar las filas limpias a formato CSV
  const csv  = Papa.unparse({ fields: headers, data: rows })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)

  // Construir el nombre del archivo de descarga
  const ext  = fileName.includes('.') ? fileName.split('.').pop() : 'csv'
  const base = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName

  // Crear un enlace temporal, hacer clic programáticamente y liberar la URL
  const a = document.createElement('a')
  a.href     = url
  a.download = `${base || 'datos'}_limpio.${ext ?? 'csv'}`
  a.click()
  URL.revokeObjectURL(url)
}

// =============================================================================
// Componente de badge de problema
// =============================================================================

/** Props del componente IssueBadge. */
interface BadgeProps {
  /** Número de filas afectadas por este tipo de problema. */
  count: number
  /** Descripción del tipo de problema. */
  label: string
  /** Clases de Tailwind para el color del contenedor (fondo, borde, texto). */
  color: string
  /** Clase de Tailwind para el color del punto indicador. */
  dot: string
}

/**
 * Badge que muestra el conteo y descripción de un tipo de problema detectado.
 * No renderiza nada si `count` es 0, para no mostrar categorías sin problemas.
 */
function IssueBadge({ count, label, color, dot }: BadgeProps) {
  if (!count) return null
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${color}`}>
      {/* Punto de color indicador */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <div>
        <p className="text-xs font-semibold">{count} fila{count !== 1 ? 's' : ''}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </div>
  )
}

// =============================================================================
// Componente principal
// =============================================================================

/**
 * Componente principal de la pestaña "Datos Limpios".
 * Consume el contexto global para acceder a los datos originales,
 * las filas limpias y el reporte de problemas.
 */
export default function CleanView() {
  const { headers, rows, cleanRows, issues, fileName } = useData()

  // Redirigir al usuario si no hay datos cargados
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

  // Total de filas únicas eliminadas (una fila puede tener múltiples problemas,
  // por eso se usa un Set para evitar contarla más de una vez)
  const totalIssueRows = new Set([
    ...issues.missingRows,
    ...issues.duplicateRows,
    ...issues.negativeNumericRows,
    ...issues.invalidDateRows,
    ...issues.inconsistentRows,
    ...issues.invalidTypeRows,
  ]).size

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

      {/* ── Encabezado con resumen y botón de descarga ───────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Limpieza de Datos</h1>
          <p className="text-sm text-slate-400 mt-1">
            {rows.length} filas originales →{' '}
            <span className="text-indigo-600 font-medium">{cleanRows.length} filas limpias</span>
            {' · '}{totalIssueRows} eliminadas
          </p>
        </div>

        {/* Botón de descarga — solo visible si hay filas limpias */}
        {cleanRows.length > 0 && (
          <button
            onClick={() => downloadClean(headers, cleanRows, fileName)}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar CSV limpio
          </button>
        )}
      </div>

      {/* ── Badges de problemas detectados ───────────────────────────────────── */}
      {totalIssueRows > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Problemas detectados
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

            {/* Valores nulos o vacíos */}
            <IssueBadge
              count={issues.missingRows.length}
              label="Valores nulos / vacíos"
              color="bg-red-50 border-red-100 text-red-700"
              dot="bg-red-400"
            />

            {/* Filas duplicadas exactas */}
            <IssueBadge
              count={issues.duplicateRows.length}
              label="Filas duplicadas"
              color="bg-orange-50 border-orange-100 text-orange-700"
              dot="bg-orange-400"
            />

            {/* Valores negativos en columnas que solo admiten positivos */}
            <IssueBadge
              count={issues.negativeNumericRows.length}
              label="Valores negativos inválidos"
              color="bg-yellow-50 border-yellow-100 text-yellow-700"
              dot="bg-yellow-400"
            />

            {/* Fechas imposibles o fuera de rango */}
            <IssueBadge
              count={issues.invalidDateRows.length}
              label="Fechas inválidas"
              color="bg-purple-50 border-purple-100 text-purple-700"
              dot="bg-purple-400"
            />

            {/* Mismo valor con distintas capitalizaciones */}
            <IssueBadge
              count={issues.inconsistentRows.length}
              label="Inconsistencias de formato"
              color="bg-cyan-50 border-cyan-100 text-cyan-700"
              dot="bg-cyan-400"
            />

            {/* Texto en columna numérica o fecha no parseable */}
            <IssueBadge
              count={issues.invalidTypeRows.length}
              label="Tipo inválido (NaN, error, texto en col. numérica)"
              color="bg-rose-50 border-rose-100 text-rose-700"
              dot="bg-rose-400"
            />

          </div>
        </div>
      )}

      {/* ── Tabla de datos limpios ────────────────────────────────────────────── */}
      {cleanRows.length === 0 ? (
        /* Mensaje cuando todas las filas fueron eliminadas */
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">Todas las filas tenían problemas y fueron eliminadas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">

          {/* Indicadores de normalización aplicada */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xs text-slate-400">
              Mostrando solo las filas que pasaron todos los filtros de limpieza
            </p>

            {/* Normalización de fechas */}
            <span className="inline-flex items-center gap-1 text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Fechas normalizadas a YYYY-MM-DD
            </span>

            {/* Normalización de capitalización de texto */}
            <span className="inline-flex items-center gap-1 text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Texto unificado al formato más frecuente
            </span>
          </div>

          {/* Tabla con scroll vertical limitado al 65% del viewport */}
          <div className="max-h-[65vh] overflow-auto rounded-xl">
            <DataTable headers={headers} rows={cleanRows} />
          </div>

        </div>
      )}

    </main>
  )
}
