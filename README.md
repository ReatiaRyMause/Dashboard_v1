# Panel de Análisis y Limpieza de Datos

Aplicación web para cargar, limpiar y visualizar conjuntos de datos en formato CSV y Excel. Desarrollada con Next.js 16, React 19 y Tailwind CSS.

---

## Tecnologías

| Librería | Uso |
|---|---|
| [Next.js 16](https://nextjs.org) | Framework principal (App Router) |
| [React 19](https://react.dev) | Interfaz de usuario |
| [Tailwind CSS 4](https://tailwindcss.com) | Estilos |
| [PapaParse](https://www.papaparse.com) | Parseo de archivos CSV |
| [xlsx](https://sheetjs.com) | Lectura de archivos Excel y ODS |
| [Recharts](https://recharts.org) | Gráficas del tablero |

---

## Instalación y uso

### Requisitos previos

- [Node.js](https://nodejs.org) v18 o superior
- npm, yarn, pnpm o bun


## Estructura del proyecto

```
app/
├── components/
│   ├── Nav.tsx          # Barra de navegación
│   └── DataTable.tsx    # Tabla reutilizable de datos
├── data/
│   ├── page.tsx         # Ruta /data
│   └── DataView.tsx     # Vista de carga y datos originales
├── clean/
│   ├── page.tsx         # Ruta /clean
│   └── CleanView.tsx    # Vista de limpieza y descarga
├── dashboard/
│   ├── page.tsx         # Ruta /dashboard
│   └── DashboardView.tsx # Vista del tablero con gráficas
├── store.tsx            # Contexto global + pipeline de limpieza
├── layout.tsx           # Layout raíz
├── globals.css          # Estilos globales
└── page.tsx             # Redirección a /data
```

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Genera la build de producción |
| `npm run start` | Inicia el servidor de producción |
| `npm run lint` | Ejecuta el linter |

---

## Uso de la aplicación

1. **Pestaña "Datos"** — Carga tu archivo CSV o Excel. Las filas con celdas vacías se resaltan en rojo.
2. **Pestaña "Datos Limpios"** — Revisa el reporte de problemas detectados por categoría y descarga el archivo limpio.
3. **Pestaña "Tablero"** — Explora las gráficas generadas automáticamente para cada columna del dataset limpio.

> El dataset se guarda en `localStorage`, por lo que persiste al recargar la página.
