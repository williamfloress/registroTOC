import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

const SEEN_KEY = 'reportesTOC.tourSeen'

const steps: DriveStep[] = [
  { popover: { title: 'Bienvenido a reportesTOC', description: 'Te mostraremos en un minuto cómo registrar y consultar las cuentas y aportes de la Tercera Orden Carmelita.' } },
  { element: '[data-tour="nav"]', popover: { title: 'Menú de navegación', description: 'Desde aquí pasas entre el libro financiero, los aportes mensuales, los participantes, los reportes y el respaldo.', side: 'right' } },
  { element: '[data-tour="period"]', popover: { title: 'Período', description: 'Elige el mes que quieres consultar. Los ingresos, egresos y aportes se calculan para ese período.', side: 'bottom' } },
  { element: '[data-tour="new-contribution"]', popover: { title: 'Registrar aporte', description: 'Anota el pago de aporte de un participante: mes, monto y forma de pago.', side: 'bottom' } },
  { element: '[data-tour="new-movement"]', popover: { title: 'Nuevo movimiento', description: 'Registra un ingreso o un egreso en una de las cuentas (USD efectivo, VES banco o VES efectivo).', side: 'bottom' } },
  { element: '[data-tour="rates"]', popover: { title: 'Referencia del dólar', description: 'Muestra la tasa oficial (BCV) y la paralela solo para tu información; la app no las usa para calcular nada. Con el botón del ojo puedes ocultar o mostrar esta sección, y con el otro botón actualizar los valores.', side: 'bottom' } },
  { element: '[data-tour="balances"]', popover: { title: 'Saldos actuales', description: 'Cada moneda y cuenta se mantiene separada. Verás el saldo y lo que entró y salió en el período.', side: 'top' } },
  { element: '[data-tour="contributions"]', popover: { title: 'Estado de los aportes', description: 'Cuántos participantes tienen pago, cuántos no tienen registro y lo recibido por moneda. Usa «Registrar pago» para anotar uno rápido.', side: 'top' } },
  { element: '[data-tour="local-card"]', popover: { title: 'Tus datos están en este dispositivo', description: 'La información no se sincroniza ni se envía a ningún servidor. Descarga un respaldo desde la sección Respaldo con frecuencia.', side: 'right' } },
  { element: '[data-tour="tour-help"]', popover: { title: 'Repetir la guía', description: 'Puedes volver a ver esta guía cuando quieras con este botón.', side: 'right' } },
]

export function hasSeenTour() {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}

function markSeen() { try { localStorage.setItem(SEEN_KEY, '1') } catch { /* sin almacenamiento */ } }

export function startTour() {
  const visible = steps.filter((s) => {
    if (!s.element) return true
    const el = document.querySelector<HTMLElement>(s.element as string)
    return !!el && el.getClientRects().length > 0
  })
  const d = driver({
    steps: visible,
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Terminar',
    popoverClass: 'toc-tour',
    overlayColor: '#1c2a1d',
    overlayOpacity: 0.6,
    onDestroyed: markSeen,
  })
  d.drive()
}
