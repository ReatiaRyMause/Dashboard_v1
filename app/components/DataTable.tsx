/**
 * DataTable.tsx
 *
 * Tabla reutilizable para mostrar un dataset en formato tabular.
 *
 * Características:
 *   - Encabezado fijo (sticky) para facilitar la lectura en tablas largas.
 *   - Numeración automática de filas en la primera columna.
 *   - Modo de resaltado opcional: cuando `highlightMissing` es true, las filas
 *     con celdas vacías se muestran con fondo rojo y el valor faltante se
 *     reemplaza por un guión largo (—) en cursiva roja.
 *   - Scroll horizontal y vertical para datasets con muchas columnas o filas.
 */

'use client'

import { Row } from '../store'

/** Props del componente DataTable. */
interface Props {
  /** Nombres de las columnas, en el orden en que deben mostrarse. */
  headers: string[]
  /** Filas del dataset a renderizar. */
  rows: Row[]
  /**
   * Si es `true`, las filas con celdas vacías o nulas se resaltan en rojo
   * y las celdas faltantes muestran "—" en lugar del valor vacío.
   * Por defecto es `false`.
   */
  highlightMissing?: boolean
}

/**
 * Componente de tabla de datos.
 * Devuelve `null` si no hay encabezados, evitando renderizar una tabla vacía.
 */
export default function DataTable({ headers, rows, highlightMissing = false }: Props) {
  // No renderizar si no hay columnas definidas
  if (!headers.length) return null

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">

        {/* Encabezado fijo con nombres de columnas */}
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
          <tr>
            {/* Columna de número de fila */}
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide w-10">
              #
            </th>
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        {/* Cuerpo de la tabla */}
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => {
            // Determinar si la fila tiene algún valor faltante (para resaltado)
            const hasMissing =
              highlightMissing &&
              Object.values(row).some((v) => v === null || v === undefined || v.trim() === '')

            return (
              <tr
                key={i}
                className={
                  hasMissing
                    ? 'bg-red-50'                              // Fila con datos faltantes
                    : 'hover:bg-slate-50 transition-colors'   // Fila normal con hover
                }
              >
                {/* Número de fila (base 1) */}
                <td className="px-4 py-2.5 text-slate-300 text-xs tabular-nums">{i + 1}</td>

                {/* Celdas de datos */}
                {headers.map((h) => {
                  const val = row[h]
                  const missing =
                    highlightMissing &&
                    (val === null || val === undefined || val.trim() === '')

                  return (
                    <td
                      key={h}
                      className={`px-4 py-2.5 whitespace-nowrap text-sm ${
                        missing
                          ? 'text-red-400 italic'  // Celda faltante: rojo en cursiva
                          : 'text-slate-700'        // Celda normal
                      }`}
                    >
                      {/* Mostrar guión largo si el valor falta, o el valor real */}
                      {missing ? '—' : val}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>

      </table>
    </div>
  )
}
