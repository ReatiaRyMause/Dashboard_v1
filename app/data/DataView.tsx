/**
 * DataView.tsx
 *
 * Vista principal de carga y visualización del dataset original.
 *
 * Funcionalidades:
 *   - Zona de arrastrar-y-soltar (drag & drop) para cargar archivos.
 *   - Selector de archivo mediante clic.
 *   - Soporte para CSV (parseado con PapaParse) y todos los formatos de
 *     Excel (.xlsx, .xls, .xlsm, .xlsb, .ods) mediante la librería xlsx.
 *   - Muestra la tabla completa del dataset con resaltado de filas que
 *     tienen celdas vacías.
 *   - Indicador del número de filas con datos faltantes.
 *   - Botón para limpiar el dataset y volver a la pantalla de carga.
 */

'use client'

import { useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useData, Row } from '../store'
import DataTable from '../components/DataTable'

/** Extensiones de archivo aceptadas por el input de carga. */
const ACCEPT = '.csv,.xls,.xlsx,.xlsm,.xlsb,.ods,.numbers'

/**
 * Convierte los datos crudos del parser (array de objetos con valores `unknown`)
 * a un arreglo de `Row` (Record<string, string>), normalizando cada valor a string
 * y eliminando espacios al inicio y al final.
 *
 * @param hdrs - Nombres de las columnas en el orden correcto.
 * @param data - Filas crudas devueltas por PapaParse o xlsx.
 * @returns Arreglo de filas normalizadas como `Row`.
 */
function normalizeRows(hdrs: string[], data: Record<string, unknown>[]): Row[] {
  return data.map((row) => {
    const normalized: Row = {}
    for (const h of hdrs) {
      const val = row[h]
      // Convertir null/undefined a cadena vacía; el resto a string con trim
      normalized[h] = val === undefined || val === null ? '' : String(val).trim()
    }
    return normalized
  })
}

/**
 * Componente principal de la pestaña "Datos".
 * Gestiona la carga del archivo y muestra el dataset original en una tabla.
 */
export default function DataView() {
  // Estado global del dataset
  const { headers, rows, setData, clearData } = useData()

  // Mensaje de error de lectura de archivo
  const [error, setError] = useState('')

  // Referencia al input oculto de tipo file para activarlo programáticamente
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Procesa el archivo seleccionado o soltado por el usuario.
   * Detecta el formato por extensión y usa el parser correspondiente.
   *
   * @param file - Archivo a procesar.
   */
  function handleFile(file: File) {
    setError('')
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

    if (ext === 'csv') {
      // ── CSV: parsear con PapaParse ──────────────────────────────────────────
      Papa.parse<Row>(file, {
        header: true,          // Primera fila como encabezados
        skipEmptyLines: false, // Conservar filas vacías para detectarlas en validación
        complete(results) {
          const hdrs = results.meta.fields ?? []
          setData(hdrs, normalizeRows(hdrs, results.data as Record<string, unknown>[]), file.name)
        },
        error(err) { setError(err.message) },
      })
    } else {
      // ── Excel / ODS: leer con FileReader + xlsx ─────────────────────────────
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          // Parsear el buffer del archivo como workbook
          const wb = XLSX.read(e.target?.result, { type: 'array' })

          // Usar siempre la primera hoja del libro
          const ws = wb.Sheets[wb.SheetNames[0]]

          // Convertir la hoja a JSON; defval:'' rellena celdas vacías con string vacío
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: '',
            raw: false, // Devolver todos los valores como strings formateados
          })

          if (!json.length) { setError('La hoja está vacía.'); return }

          const hdrs = Object.keys(json[0])
          setData(hdrs, normalizeRows(hdrs, json), file.name)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al leer el archivo.')
        }
      }

      reader.onerror = () => setError('No se pudo leer el archivo.')
      reader.readAsArrayBuffer(file) // Leer como ArrayBuffer para xlsx
    }
  }

  /**
   * Manejador del evento change del input de archivo.
   * Extrae el primer archivo seleccionado y lo procesa.
   */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  /**
   * Manejador del evento drop para la zona de arrastrar-y-soltar.
   * Previene el comportamiento por defecto del navegador (abrir el archivo)
   * y procesa el primer archivo soltado.
   */
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // Número de filas con al menos una celda vacía (para el indicador del header)
  const missingCount = rows.filter((row) =>
    Object.values(row).some((v) => v === null || v === undefined || v.trim() === '')
  ).length

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

      {/* ── Encabezado de la sección ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Set de Datos</h1>
          {/* Estadísticas rápidas: solo visibles cuando hay datos cargados */}
          {rows.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {rows.length} filas · {headers.length} columnas ·{' '}
              <span className="text-red-400">{missingCount} con datos faltantes</span>
            </p>
          )}
        </div>

        {/* Botón para limpiar el dataset (solo visible con datos cargados) */}
        {rows.length > 0 && (
          <button
            onClick={clearData}
            className="self-start sm:self-auto text-sm px-4 py-2 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* ── Zona de carga o tabla de datos ───────────────────────────────────── */}
      {rows.length === 0 ? (
        /* Zona de drag & drop — visible cuando no hay datos cargados */
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()} // Necesario para habilitar el drop
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group"
        >
          {/* Ícono de carga */}
          <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
            <svg className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>

          {/* Instrucciones de carga */}
          <div className="text-center">
            <p className="text-slate-700 font-medium">Arrastra tu archivo aquí</p>
            <p className="text-slate-400 text-sm mt-1">CSV, Excel (.xlsx, .xls, .xlsm, .xlsb, .ods)</p>
          </div>

          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            o haz clic para seleccionar
          </span>

          {/* Input oculto — se activa al hacer clic en la zona o en el botón */}
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onFileChange} />
        </div>
      ) : (
        /* Vista de tabla — visible cuando hay datos cargados */
        <div className="flex flex-col gap-4">

          {/* Controles superiores: botón de recarga e indicador de faltantes */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="self-start text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Cargar otro archivo
            </button>

            {/* Input oculto reutilizado para cargar un nuevo archivo */}
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onFileChange} />

            {/* Indicador de filas con datos faltantes */}
            {missingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                Las filas en rojo tienen celdas vacías
              </span>
            )}
          </div>

          {/* Tabla con scroll vertical limitado al 65% del viewport */}
          <div className="max-h-[65vh] overflow-auto rounded-xl">
            <DataTable headers={headers} rows={rows} highlightMissing />
          </div>

        </div>
      )}

      {/* ── Mensaje de error de lectura ──────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}

    </main>
  )
}
