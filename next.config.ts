import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

// Reorganización IA v2 (2026-05-28): páginas migradas a 4 secciones posesivas.
// `permanent: true` emite HTTP 308 — query strings se preservan por defecto
// (e.g. /transacciones?day=2026-05-28 → /mi-dinero/movimientos?day=2026-05-28).
const iaRedirects = [
  { source: '/cuentas', destination: '/mi-dinero/cuentas', permanent: true },
  { source: '/cuentas/:path*', destination: '/mi-dinero/cuentas/:path*', permanent: true },
  { source: '/transacciones', destination: '/mi-dinero/movimientos', permanent: true },
  { source: '/transacciones/:path*', destination: '/mi-dinero/movimientos/:path*', permanent: true },
  { source: '/deudas', destination: '/mi-dinero/deudas', permanent: true },
  { source: '/deudas/:path*', destination: '/mi-dinero/deudas/:path*', permanent: true },
  { source: '/presupuestos', destination: '/mi-plan/presupuestos', permanent: true },
  { source: '/presupuestos/:path*', destination: '/mi-plan/presupuestos/:path*', permanent: true },
  { source: '/metas', destination: '/mi-plan/metas', permanent: true },
  { source: '/metas/:path*', destination: '/mi-plan/metas/:path*', permanent: true },
  { source: '/ahorro', destination: '/mi-plan/ahorro', permanent: true },
  { source: '/ahorro/:path*', destination: '/mi-plan/ahorro/:path*', permanent: true },
  { source: '/cash-flow', destination: '/mi-dinero/cash-flow', permanent: true },
  { source: '/cash-flow/:path*', destination: '/mi-dinero/cash-flow/:path*', permanent: true },
  { source: '/mi-plan/cash-flow', destination: '/mi-dinero/cash-flow', permanent: true },
  { source: '/mi-plan/cash-flow/:path*', destination: '/mi-dinero/cash-flow/:path*', permanent: true },
  { source: '/ajustes/recurring', destination: '/mi-plan/recurrentes', permanent: true },
  { source: '/ajustes/recurring/:path*', destination: '/mi-plan/recurrentes/:path*', permanent: true },
  { source: '/insights', destination: '/mi-historia/insights', permanent: true },
  { source: '/insights/:path*', destination: '/mi-historia/insights/:path*', permanent: true },
  { source: '/informes', destination: '/mi-historia/informes', permanent: true },
  { source: '/informes/:path*', destination: '/mi-historia/informes/:path*', permanent: true },
  // /importar deja de ser ruta — es CTA dentro de Movimientos. El query
  // ?import=open hace que ImportDialog se monte abierto al cargar.
  { source: '/importar', destination: '/mi-dinero/movimientos?import=open', permanent: true },
  // Ajustes consolidados (Fase E): las 5 sub-rutas se convirtieron en
  // anchors dentro de /ajustes. /categorias también se mueve aquí.
  { source: '/ajustes/perfil-financiero', destination: '/ajustes#perfil', permanent: true },
  { source: '/ajustes/integraciones-bancarias', destination: '/ajustes#integraciones-bancarias', permanent: true },
  { source: '/ajustes/integraciones', destination: '/ajustes#integraciones-ia', permanent: true },
  { source: '/ajustes/alertas', destination: '/ajustes#alertas', permanent: true },
  { source: '/categorias', destination: '/ajustes#categorias', permanent: true },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Router Cache del cliente: cuánto tiempo se reusa el RSC ya renderizado de
    // una ruta antes de re-fetchear. El default `dynamic: 0` descarta toda ruta
    // dinámica al instante → cada navegación entre secciones vuelve a cargar de
    // cero (skeleton + fetch) aunque ya la hayas visitado. Con `dynamic: 30` una
    // sección visitada/prefetcheada se reusa 30s → volver a ella es instantáneo,
    // sin reload. Las Server Actions hacen revalidatePath, que bustea este cache
    // apenas mutás algo, así que los datos no quedan viejos tras un cambio.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    // Tree-shaking dirigido de paquetes con barrels pesados: solo entra al
    // bundle lo que se importa, no el index completo.
    optimizePackageImports: [
      'lucide-react',
      'motion',
      '@visx/axis',
      '@visx/curve',
      '@visx/group',
      '@visx/responsive',
      '@visx/scale',
      '@visx/shape',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return iaRedirects
  },
}

export default nextConfig
