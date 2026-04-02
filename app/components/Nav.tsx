/**
 * Nav.tsx
 *
 * Barra de navegación principal de la aplicación.
 * Muestra el nombre del proyecto y los enlaces a las tres secciones:
 * Datos, Datos Limpios y Dashboard.
 *
 * Resalta visualmente la pestaña activa comparando el pathname actual
 * con el href de cada enlace usando el hook `usePathname` de Next.js.
 *
 * Se marca como componente cliente ('use client') porque usa hooks de
 * navegación que requieren acceso al entorno del navegador.
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Definición de las pestañas de navegación: ruta y etiqueta visible. */
const tabs = [
  { href: '/data',      label: 'Datos'         },
  { href: '/clean',     label: 'Datos Limpios' },
  { href: '/dashboard', label: 'Dashboard'     },
]

/**
 * Componente de navegación global.
 * Se posiciona fijo en la parte superior de la pantalla (sticky top-0)
 * para permanecer visible al hacer scroll.
 */
export default function Nav() {
  // Pathname actual para determinar qué pestaña está activa
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 h-14">

        {/* Nombre / logo de la aplicación */}
        <span className="font-semibold text-slate-800 text-sm tracking-tight mr-4">
          Panel_V1
        </span>

        {/* Pestañas de navegación */}
        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pathname === t.href
                  // Pestaña activa: fondo y texto en índigo
                  ? 'bg-indigo-50 text-indigo-600'
                  // Pestaña inactiva: texto gris con hover
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

      </div>
    </header>
  )
}
