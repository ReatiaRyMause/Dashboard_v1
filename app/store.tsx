/**
 * store.tsx
 *
 * Contexto global de la aplicación. Gestiona el estado del conjunto de datos
 * cargado por el usuario y expone las filas originales, las filas limpias y
 * el reporte de problemas detectados durante la validación.
 *
 * Pipeline de limpieza:
 *   1. Inferencia de tipos de columna (numérico | fecha | texto)
 *   2. Validación — detecta todos los problemas y registra los índices afectados
 *   3. Eliminación — un único filtro descarta todas las filas problemáticas
 *   4. Normalización — estandariza fechas, números y capitalización del texto
 */

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

/** Representa una fila del dataset como un mapa de nombre-de-columna → valor string. */
export type Row = Record<string, string>

/**
 * Reporte de problemas encontrados en el dataset original.
 * Cada propiedad contiene los índices (base 0) de las filas afectadas.
 */
export interface CleanIssues {
  /** Filas con al menos una celda vacía, en blanco o con valor basura (NaN, null, n/a…). */
  missingRows: number[]
  /** Filas duplicadas exactas; se conserva la primera aparición. */
  duplicateRows: number[]
  /** Filas con valores negativos en columnas que semánticamente solo admiten positivos (edad, precio, etc.). */
  negativeNumericRows: number[]
  /** Filas con fechas imposibles: no parseables, año fuera de [1900, añoActual+5] o fecha de nacimiento futura. */
  invalidDateRows: number[]
  /** Filas donde un valor de texto aparece con distintas capitalizaciones en el mismo conjunto de datos. */
  inconsistentRows: number[]
  /** Filas con texto en columnas numéricas o strings no parseables en columnas de fecha. */
  invalidTypeRows: number[]
}

/** Forma del contexto expuesto a los componentes consumidores. */
interface DataStore {
  /** Nombres de las columnas del dataset cargado. */
  headers: string[]
  /** Filas originales tal como fueron leídas del archivo. */
  rows: Row[]
  /** Filas que superaron todas las validaciones, ya normalizadas. */
  cleanRows: Row[]
  /** Reporte detallado de problemas detectados en las filas originales. */
  issues: CleanIssues
  /** Nombre del archivo cargado (se usa para generar el nombre del archivo descargado). */
  fileName: string
  /**
   * Carga un nuevo dataset en el contexto.
   * @param headers - Nombres de columnas.
   * @param rows    - Filas del dataset.
   * @param fileName - Nombre del archivo fuente (opcional).
   */
  setData: (headers: string[], rows: Row[], fileName?: string) => void
  /** Elimina todos los datos del contexto y limpia el localStorage. */
  clearData: () => void
}

/** Valor inicial vacío para CleanIssues, usado al resetear el estado. */
const EMPTY_ISSUES: CleanIssues = {
  missingRows: [],
  duplicateRows: [],
  negativeNumericRows: [],
  invalidDateRows: [],
  inconsistentRows: [],
  invalidTypeRows: [],
}

/** Contexto React con valores por defecto vacíos (se sobreescriben en el Provider). */
const DataContext = createContext<DataStore>({
  headers: [], rows: [], cleanRows: [], issues: EMPTY_ISSUES, fileName: '',
  setData: () => {}, clearData: () => {},
})

// =============================================================================
// Constantes de clasificación de columnas
// =============================================================================

/**
 * Palabras clave que indican que una columna numérica solo debe contener
 * valores positivos. Se comparan contra el nombre de la columna en minúsculas.
 */
const POSITIVE_KEYWORDS = [
  'edad', 'age', 'precio', 'price', 'score', 'cantidad', 'quantity',
  'monto', 'amount', 'ingreso', 'salary', 'salario', 'sueldo',
  'peso', 'weight', 'altura', 'height',
]

/**
 * Palabras clave que indican que una columna contiene fechas.
 * Se comparan contra el nombre de la columna en minúsculas.
 */
const DATE_KEYWORDS = [
  'fecha', 'date', 'nacimiento', 'birth', 'registro', 'created',
  'updated', 'inicio', 'fin', 'start', 'end',
]

/**
 * Expresión regular que identifica valores basura o marcadores de error
 * comunes en datasets: NaN, null, n/a, #VALUE!, error, undefined, etc.
 * Estos valores se tratan como datos faltantes.
 */
const JUNK_RE = /^(nan|null|none|n\/a|na|n\.a\.?|#n\/a|#value!|#ref!|#div\/0!|#name\?|#num!|#null!|error|#error|undefined|inf|-inf|infinity|-infinity|\?|-{1,2}|x|xx|xxx|tbd|tbc|unknown|desconocido)$/i

/** Devuelve `true` si el valor es un marcador de error o dato faltante conocido. */
const isJunk = (v: string) => JUNK_RE.test(v.trim())

/** Año actual, usado para validar rangos de fechas. */
const THIS_YEAR = new Date().getFullYear()

// =============================================================================
// Inferencia de tipos de columna
// =============================================================================

/** Tipos posibles para una columna del dataset. */
type ColType = 'numeric' | 'date' | 'text'

/** Devuelve `true` si el nombre de columna sugiere que solo acepta valores positivos. */
const looksPositiveOnly = (h: string) => POSITIVE_KEYWORDS.some((k) => h.toLowerCase().includes(k))

/** Devuelve `true` si el nombre de columna sugiere que contiene fechas. */
const looksLikeDateCol  = (h: string) => DATE_KEYWORDS.some((k) => h.toLowerCase().includes(k))

/**
 * Infiere el tipo de cada columna del dataset.
 *
 * Prioridad:
 *   1. Si el nombre contiene una palabra clave de fecha → 'date'
 *   2. Si el nombre contiene una palabra clave de positivo → 'numeric'
 *   3. Si una muestra de hasta 100 valores no vacíos son todos numéricos → 'numeric'
 *   4. En cualquier otro caso → 'text'
 *
 * @param headers - Nombres de las columnas.
 * @param rows    - Filas del dataset (se usan para muestrear valores).
 * @returns Mapa de nombre-de-columna → tipo inferido.
 */
function inferColTypes(headers: string[], rows: Row[]): Record<string, ColType> {
  const types: Record<string, ColType> = {}

  for (const h of headers) {
    // Prioridad 1: columna de fecha por nombre
    if (looksLikeDateCol(h))  { types[h] = 'date';    continue }
    // Prioridad 2: columna numérica positiva por nombre
    if (looksPositiveOnly(h)) { types[h] = 'numeric'; continue }

    // Prioridad 3: inferencia por muestreo de valores
    const sample = rows
      .map((r) => r[h]?.trim() ?? '')
      .filter((v) => v !== '' && !isJunk(v))
      .slice(0, 100)

    const allNum = sample.length > 0 && sample.every((v) => !isNaN(Number(v.replace(/,/g, ''))))
    types[h] = allNum ? 'numeric' : 'text'
  }

  return types
}

// =============================================================================
// Validadores individuales
// Cada función recibe una fila y devuelve true si la fila tiene ese problema.
// =============================================================================

/**
 * Regla 1 — Valores faltantes.
 * Una fila falla si alguna celda está vacía, es solo espacios o es un valor basura.
 */
function hasMissingValues(row: Row): boolean {
  return Object.values(row).some((v) => {
    const t = (v ?? '').trim()
    return t === '' || isJunk(t)
  })
}

/**
 * Regla 2 — Tipo de dato inválido.
 * Una fila falla si una columna numérica contiene texto no parseable como número,
 * o si una columna de fecha contiene un string que no puede interpretarse como fecha.
 * Los valores vacíos o basura se omiten aquí (ya los captura la Regla 1).
 */
function hasInvalidType(row: Row, headers: string[], colTypes: Record<string, ColType>): boolean {
  for (const h of headers) {
    const v = row[h]?.trim() ?? ''
    if (v === '' || isJunk(v)) continue // ya cubierto por Regla 1

    if (colTypes[h] === 'numeric') {
      const n = Number(v.replace(/,/g, ''))
      if (isNaN(n)) return true // ej. "error" o "abc" en columna de edad
    }

    if (colTypes[h] === 'date') {
      const d = new Date(v)
      if (isNaN(d.getTime())) return true // string de fecha no parseable
    }
  }
  return false
}

/**
 * Regla 3 — Valores negativos en columnas que solo admiten positivos.
 * Aplica únicamente a columnas cuyo nombre contiene palabras clave como
 * 'edad', 'precio', 'ingreso', etc.
 */
function hasNegativeValue(row: Row, headers: string[], colTypes: Record<string, ColType>): boolean {
  for (const h of headers) {
    if (colTypes[h] !== 'numeric' || !looksPositiveOnly(h)) continue
    const v = row[h]?.trim() ?? ''
    if (v === '') continue
    const n = Number(v.replace(/,/g, ''))
    if (!isNaN(n) && n < 0) return true
  }
  return false
}

/**
 * Regla 4 — Fechas inválidas o imposibles.
 * Una fecha es inválida si:
 *   - No puede parsearse como objeto Date.
 *   - Su año está fuera del rango [1900, añoActual + 5].
 *   - Es una fecha de nacimiento en el futuro.
 */
function hasInvalidDate(row: Row, headers: string[], colTypes: Record<string, ColType>): boolean {
  for (const h of headers) {
    if (colTypes[h] !== 'date') continue
    const v = row[h]?.trim() ?? ''
    if (v === '') continue

    const d = new Date(v)
    if (isNaN(d.getTime())) return true

    const y = d.getFullYear()
    // Año fuera del rango permitido
    if (y < 1900 || y > THIS_YEAR + 5) return true

    // Fecha de nacimiento en el futuro
    if (h.toLowerCase().includes('nacimiento') || h.toLowerCase().includes('birth')) {
      if (d > new Date()) return true
    }
  }
  return false
}

/**
 * Construye un mapa de variantes de capitalización por columna de texto.
 * Para cada valor único (en minúsculas) registra todas las formas en que
 * aparece escrito en el dataset (ej. "cdmx", "CDMX", "Cdmx").
 *
 * @returns Mapa: nombre-de-columna → (valorEnMinúsculas → Set de variantes).
 */
function buildCasingVariants(
  headers: string[],
  rows: Row[],
  colTypes: Record<string, ColType>,
): Record<string, Map<string, Set<string>>> {
  const result: Record<string, Map<string, Set<string>>> = {}

  for (const h of headers) {
    if (colTypes[h] !== 'text') continue
    const map = new Map<string, Set<string>>()

    for (const row of rows) {
      const v = row[h]?.trim() ?? ''
      if (!v || isJunk(v)) continue
      const key = v.toLowerCase()
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(v)
    }

    result[h] = map
  }

  return result
}

/**
 * Regla 5 — Inconsistencias de capitalización.
 * Una fila falla si alguno de sus valores de texto aparece en el dataset
 * con más de una forma de escritura (ej. "monterrey" y "Monterrey").
 */
function hasInconsistentCasing(
  row: Row,
  headers: string[],
  colTypes: Record<string, ColType>,
  variants: Record<string, Map<string, Set<string>>>,
): boolean {
  for (const h of headers) {
    if (colTypes[h] !== 'text') continue
    const v = row[h]?.trim() ?? ''
    if (!v || isJunk(v)) continue
    // Si hay más de una variante para este valor → inconsistencia
    if ((variants[h]?.get(v.toLowerCase())?.size ?? 0) > 1) return true
  }
  return false
}

// =============================================================================
// Paso 1 — Validación completa
// =============================================================================

/**
 * Ejecuta todas las reglas de validación sobre el dataset original y
 * devuelve un reporte con los índices de las filas problemáticas por categoría.
 *
 * Las filas pueden aparecer en más de una categoría si tienen múltiples problemas.
 * La eliminación posterior usa la unión de todos los índices.
 *
 * @param headers - Nombres de las columnas.
 * @param rows    - Filas originales del dataset.
 * @returns Objeto CleanIssues con los índices afectados por cada tipo de problema.
 */
function validate(headers: string[], rows: Row[]): CleanIssues {
  const colTypes = inferColTypes(headers, rows)
  const variants = buildCasingVariants(headers, rows, colTypes)

  const missingRows: number[]         = []
  const invalidTypeRows: number[]     = []
  const negativeNumericRows: number[] = []
  const invalidDateRows: number[]     = []
  const inconsistentRows: number[]    = []

  // Aplicar las reglas 1–5 a cada fila
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (hasMissingValues(row))                                    missingRows.push(i)
    if (hasInvalidType(row, headers, colTypes))                   invalidTypeRows.push(i)
    if (hasNegativeValue(row, headers, colTypes))                 negativeNumericRows.push(i)
    if (hasInvalidDate(row, headers, colTypes))                   invalidDateRows.push(i)
    if (hasInconsistentCasing(row, headers, colTypes, variants))  inconsistentRows.push(i)
  }

  // Regla 6 — Duplicados exactos (se conserva la primera aparición)
  const seen = new Set<string>()
  const duplicateRows: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const key = JSON.stringify(rows[i])
    if (seen.has(key)) duplicateRows.push(i)
    else seen.add(key)
  }

  return {
    missingRows,
    duplicateRows,
    negativeNumericRows,
    invalidDateRows,
    inconsistentRows,
    invalidTypeRows,
  }
}

// =============================================================================
// Paso 2 — Eliminación
// =============================================================================

/**
 * Elimina todas las filas problemáticas en un único paso de filtrado.
 * Construye un Set con la unión de todos los índices marcados por la validación
 * y descarta las filas cuyos índices estén en ese Set.
 *
 * @param rows   - Filas originales del dataset.
 * @param issues - Reporte de problemas generado por `validate`.
 * @returns Arreglo de filas que superaron todas las validaciones.
 */
function eliminate(rows: Row[], issues: CleanIssues): Row[] {
  // Unión de todos los índices problemáticos
  const bad = new Set([
    ...issues.missingRows,
    ...issues.duplicateRows,
    ...issues.negativeNumericRows,
    ...issues.invalidDateRows,
    ...issues.inconsistentRows,
    ...issues.invalidTypeRows,
  ])
  return rows.filter((_, i) => !bad.has(i))
}

// =============================================================================
// Paso 3 — Normalización
// =============================================================================

/**
 * Convierte una cadena de fecha a formato ISO YYYY-MM-DD.
 * Si el valor no puede parsearse, lo devuelve sin modificar.
 *
 * @param v - Valor de fecha como string.
 * @returns Fecha en formato YYYY-MM-DD o el valor original si no es parseable.
 */
function normalizeDate(v: string): string {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Limpia un valor numérico eliminando separadores de miles (comas)
 * y lo devuelve como string.
 *
 * @param v - Valor numérico como string, posiblemente con comas.
 * @returns Número limpio como string, o el valor original si no es parseable.
 */
function normalizeNumber(v: string): string {
  const n = Number(v.replace(/,/g, ''))
  return isNaN(n) ? v : String(n)
}

/**
 * Construye un mapa canónico para columnas de texto.
 * Para cada valor único (en minúsculas), elige la variante de capitalización
 * más frecuente como forma canónica.
 *
 * Ejemplo: si "CDMX" aparece 80 veces y "cdmx" aparece 3, la forma canónica es "CDMX".
 *
 * @param headers  - Nombres de las columnas.
 * @param rows     - Filas ya filtradas (sin problemáticas).
 * @param colTypes - Tipos inferidos de cada columna.
 * @returns Mapa: nombre-de-columna → (valorEnMinúsculas → forma canónica).
 */
function buildCanonMap(
  headers: string[],
  rows: Row[],
  colTypes: Record<string, ColType>,
): Record<string, Map<string, string>> {
  const canon: Record<string, Map<string, string>> = {}

  for (const h of headers) {
    if (colTypes[h] !== 'text') continue

    // Contar frecuencia de cada variante
    const freq = new Map<string, number>()
    for (const row of rows) {
      const v = row[h]?.trim() ?? ''
      if (v) freq.set(v, (freq.get(v) ?? 0) + 1)
    }

    // Elegir la variante más frecuente por clave en minúsculas
    const best = new Map<string, string>()
    for (const [variant, count] of freq) {
      const key = variant.toLowerCase()
      const cur = best.get(key)
      if (!cur || (freq.get(cur) ?? 0) < count) best.set(key, variant)
    }

    canon[h] = best
  }

  return canon
}

/**
 * Aplica la normalización a cada fila del dataset filtrado:
 *   - Fechas → YYYY-MM-DD
 *   - Números → sin separadores de miles
 *   - Texto → forma canónica (capitalización más frecuente)
 *
 * @param headers  - Nombres de las columnas.
 * @param rows     - Filas ya filtradas.
 * @param colTypes - Tipos inferidos de cada columna.
 * @param canonMap - Mapa canónico de texto generado por `buildCanonMap`.
 * @returns Filas normalizadas.
 */
function normalizeRows(
  headers: string[],
  rows: Row[],
  colTypes: Record<string, ColType>,
  canonMap: Record<string, Map<string, string>>,
): Row[] {
  return rows.map((row) => {
    const out: Row = {}
    for (const h of headers) {
      const v = row[h]?.trim() ?? ''
      if (colTypes[h] === 'date')         out[h] = v ? normalizeDate(v)   : v
      else if (colTypes[h] === 'numeric') out[h] = v ? normalizeNumber(v) : v
      else out[h] = canonMap[h]?.get(v.toLowerCase()) ?? v
    }
    return out
  })
}

// =============================================================================
// Punto de entrada del pipeline
// =============================================================================

/**
 * Ejecuta el pipeline completo de limpieza sobre un dataset:
 *   1. Validación   → detecta todos los problemas y registra índices
 *   2. Eliminación  → descarta filas problemáticas en un único filtro
 *   3. Normalización → estandariza fechas, números y capitalización
 *
 * @param headers - Nombres de las columnas.
 * @param rows    - Filas originales del dataset.
 * @returns Objeto con las filas limpias y el reporte de problemas.
 */
function process(
  headers: string[],
  rows: Row[],
): { cleanRows: Row[]; issues: CleanIssues } {
  // Paso 1: validar sobre los datos originales
  const issues = validate(headers, rows)

  // Paso 2: eliminar todas las filas problemáticas de una vez
  const filtered = eliminate(rows, issues)

  // Paso 3: normalizar las filas supervivientes
  const colTypes  = inferColTypes(headers, filtered)
  const canonMap  = buildCanonMap(headers, filtered, colTypes)
  const cleanRows = normalizeRows(headers, filtered, colTypes, canonMap)

  return { cleanRows, issues }
}

// =============================================================================
// Provider del contexto
// =============================================================================

/**
 * Proveedor del contexto global de datos.
 * Persiste el dataset en localStorage para que sobreviva recargas de página.
 * Al montar, intenta restaurar el último dataset guardado.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [headers,   setHeaders]   = useState<string[]>([])
  const [rows,      setRows]      = useState<Row[]>([])
  const [cleanRows, setCleanRows] = useState<Row[]>([])
  const [issues,    setIssues]    = useState<CleanIssues>(EMPTY_ISSUES)
  const [fileName,  setFileName]  = useState('')

  // Restaurar dataset desde localStorage al montar el componente
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dataset')
      if (saved) {
        const { headers: h, rows: r, fileName: f } = JSON.parse(saved)
        const result = process(h, r)
        setHeaders(h)
        setRows(r)
        setCleanRows(result.cleanRows)
        setIssues(result.issues)
        setFileName(f ?? '')
      }
    } catch {
      // Si el dato guardado está corrupto, se ignora silenciosamente
    }
  }, [])

  /**
   * Carga un nuevo dataset, ejecuta el pipeline de limpieza y persiste en localStorage.
   * @param h - Nombres de columnas.
   * @param r - Filas del dataset.
   * @param f - Nombre del archivo fuente (opcional).
   */
  function setData(h: string[], r: Row[], f = '') {
    const result = process(h, r)
    setHeaders(h)
    setRows(r)
    setCleanRows(result.cleanRows)
    setIssues(result.issues)
    setFileName(f)
    localStorage.setItem('dataset', JSON.stringify({ headers: h, rows: r, fileName: f }))
  }

  /** Resetea todo el estado y elimina el dataset del localStorage. */
  function clearData() {
    setHeaders([])
    setRows([])
    setCleanRows([])
    setIssues(EMPTY_ISSUES)
    setFileName('')
    localStorage.removeItem('dataset')
  }

  return (
    <DataContext.Provider value={{ headers, rows, cleanRows, issues, fileName, setData, clearData }}>
      {children}
    </DataContext.Provider>
  )
}

/**
 * Hook para consumir el contexto de datos desde cualquier componente cliente.
 * Debe usarse dentro del árbol envuelto por `DataProvider`.
 *
 * @example
 * const { rows, cleanRows, issues } = useData()
 */
export function useData() {
  return useContext(DataContext)
}
