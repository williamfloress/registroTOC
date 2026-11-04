# reportesTOC

Aplicación web local-first para llevar el libro financiero y controlar los aportes mensuales de la Tercera Orden Carmelita (TOC). Está pensada para simplificar el registro administrativo con una interfaz clara en español y conservar la información en el dispositivo.

> **Estado:** MVP en desarrollo incremental. Están implementados el resumen, el libro financiero, el padrón, los aportes, los reportes PDF/Excel, el respaldo JSON y el shell PWA. La aceptación offline en navegador y dispositivos reales, las pruebas E2E y la definición del dominio de producción siguen pendientes.

## Descripción corta para GitHub

> Aplicación web local-first para gestionar el libro financiero y los aportes mensuales de la Tercera Orden Carmelita, con datos privados guardados en el dispositivo.

## Objetivos y principios

- Reemplazar los registros en cuadernos del libro financiero y del control mensual de aportes.
- Hacer que las tareas comunes sean sencillas para personas con poca experiencia informática.
- Mantener separados los saldos de USD y VES y conservar las tasas de cambio históricas.
- Guardar los datos localmente y permitir trabajar sin conexión después de la primera carga de la PWA.
- Facilitar la exportación de reportes y la creación de respaldos portables.
- Mantener la lógica de negocio independiente del navegador para permitir una futura versión de escritorio.

## Alcance funcional del MVP

### 1. Resumen

El panel principal mostrará los saldos actuales de USD efectivo, VES efectivo y VES banco sin sumar monedas diferentes. También presentará ingresos y egresos del período por cuenta, actividad reciente y accesos rápidos para registrar movimientos y aportes. Cuando no existan registros, mostrará indicaciones para empezar, sin datos ficticios.

**Estado:** implementación inicial disponible. Muestra los saldos actuales por cuenta, ingresos y egresos del período sin combinar monedas, resumen mensual de aportes y actividad reciente. Incluye accesos rápidos a los formularios de movimiento y aporte.

### 2. Libro financiero

El libro conservará el formato familiar de fecha, concepto, debe, haber y saldo:

- Los ingresos se reflejan en **Debe** y aumentan el saldo.
- Los egresos se reflejan en **Haber** y disminuyen el saldo.
- Cada operación pertenece a una cuenta y usa la moneda de esa cuenta.
- El saldo se calcula a partir del saldo inicial y los movimientos ordenados por fecha y un criterio estable para operaciones del mismo día.
- Se podrá registrar, editar y eliminar movimientos; la eliminación requerirá confirmación.
- Se podrá consultar por cuenta, mes, año, rango de fechas, historial y concepto.
- El resumen del período mostrará saldo inicial, ingresos, egresos y saldo final de cada cuenta.

**Estado:** implementación inicial disponible. Incluye las tres cuentas base, saldos iniciales, CRUD de movimientos, búsqueda por concepto, filtros por cuenta y mes, resumen separado por cuenta y confirmación al eliminar. El filtro por rango personalizado y las pruebas de interacción en navegador siguen pendientes.

### 3. Participantes

Cada participante tendrá identificador, nombres, apellidos, estado activo/inactivo, fecha de creación y notas opcionales. Se podrá desactivar un participante para conservar sus aportes históricos; no se borrarán físicamente sus registros relacionados.

**Estado:** implementación inicial disponible. Incluye alta, edición, búsqueda, filtro por estado y desactivación/reactivación sin borrado físico.

### 4. Aportes mensuales

- La obligación inicial será de 1 USD por participante y mes, configurable para períodos futuros sin alterar obligaciones históricas.
- La matriz anual mostrará a los participantes en filas y los meses en columnas.
- Cada mes podrá estar pendiente o registrado como pagado en USD o en VES.
- Los pagos en VES conservarán el importe recibido, la tasa manual expresada en VES por USD, el equivalente de la obligación, la fecha real del pago y referencias/notas opcionales.
- Se permitirá pagar varios meses pendientes en una sola entrega. El sistema guardará un registro por mes y los relacionará mediante un lote compartido.
- No se permitirán duplicados para participante, año y mes. El MVP no incluye pagos parciales.
- Los aportes y el libro financiero serán módulos independientes: registrar un aporte no creará automáticamente un movimiento de caja.
- Los resúmenes mantendrán los montos en USD y VES separados; cualquier equivalente informativo en USD usará las tasas guardadas en cada pago.

**Estado:** implementación inicial disponible. Incluye matriz anual, filtros por año/persona/estado/mes, pagos individuales y agrupados en USD o VES, tasa manual histórica, redondeo por mes, detalle, historial y anulación de lotes conservando el rastro. La tabla de pagos impide duplicar participante/año/mes. El registro de aportes no crea movimientos financieros.

### 5. Reportes

El MVP completo permitirá exportar:

- **Libro financiero en PDF:** organización, título, cuenta, moneda, período, saldo inicial, detalle de movimientos, totales, saldo final y espacios para firmas/observaciones.
- **Libro financiero en Excel:** movimientos y resúmenes, con monedas y cuentas identificadas.
- **Aportes en PDF y Excel:** matriz anual, detalle individual, resumen por mes y resumen separado por moneda.

Los documentos mostrarán fechas, formatos numéricos, encabezados y totales adecuados para impresión. Ningún reporte sumará USD y VES como si fueran una sola moneda.

**Estado:** implementado. La sección Reportes genera PDF y Excel del libro por cuenta, mes, año, rango de fechas o historial completo. Los reportes de aportes incluyen matriz anual, detalle de pagos y anulaciones, resumen mensual y totales separados en USD/VES. Los documentos identifican cuentas y monedas, repiten encabezados y ofrecen formatos de impresión; los totales excluyen pagos anulados.

### 6. Respaldo y restauración

El MVP completo tendrá exportación e importación de respaldo JSON versionado. Antes de restaurar, validará estructura e integridad referencial, mostrará un resumen y pedirá confirmación. La restauración reemplazará los datos dentro de una transacción para evitar importaciones parciales. También mostrará la fecha del último respaldo y recordatorios periódicos.

**Estado:** implementado. Exporta la base completa en JSON versionado, valida estructura y relaciones, muestra los registros incluidos antes de importar y reemplaza la base en una transacción tras confirmación.

### 7. Configuración y PWA

La aplicación puede instalarse como PWA cuando el navegador lo admite. Un service worker cachea la aplicación y los recursos cargados para volver a abrirla sin conexión. La app solicita almacenamiento persistente cuando está disponible e informa si el navegador lo concede.

**Estado:** implementado. Manifest, iconos y service worker están incluidos. La interfaz permite iniciar la instalación cuando el navegador expone el aviso y comunica el estado de caché offline y almacenamiento persistente. La validación manual en navegadores reales sigue pendiente.

## Modelo monetario y reglas de integridad

- Cuentas iniciales: `usd-cash` (USD efectivo), `ves-cash` (VES efectivo) y `ves-bank` (VES banco).
- Cada cuenta mantiene su saldo de forma independiente; nunca se consolida USD con VES.
- Importes se almacenan como enteros en unidades menores (dos decimales: centavos/céntimos). Los cálculos suman enteros; el formato decimal se aplica al mostrar los datos.
- Los movimientos deben ser mayores que cero. Los saldos se derivan del saldo inicial y el historial, no de un saldo copiado en cada operación.
- El saldo inicial se puede definir antes del primer movimiento y se bloquea al iniciar el historial de esa cuenta para evitar cambios opacos.
- Las tasas de cambio de aportes serán manuales e históricas; el MVP no consultará APIs de tasas.
- Las migraciones de IndexedDB deben conservar los datos existentes; una actualización de interfaz no debe reinicializar la base.

## Arquitectura y tecnologías

- React 19, TypeScript y Vite.
- Tailwind CSS 4 para estilos.
- Dexie.js sobre IndexedDB para persistencia local, con esquema versionado.
- Zod para validación de entradas.
- Lógica de dominio y cálculos monetarios separados de la interfaz y de la persistencia.
- Vitest para pruebas unitarias.
- ExcelJS para libros de cálculo y jsPDF + AutoTable para documentos PDF; Playwright para pruebas de aceptación futuras.
- Sin backend, cuentas de usuario, autenticación ni sincronización remota en el MVP.

## Privacidad y límites de almacenamiento

Los registros financieros se guardan en IndexedDB del navegador; la aplicación no los envía a un servidor. La base está aislada por origen, perfil del navegador y dispositivo. Borrar los datos del sitio, cambiar de navegador/perfil o cambiar el dominio puede dejar los registros inaccesibles. En equipos compartidos, los datos locales pueden estar disponibles para otras personas con acceso al mismo perfil. La persistencia del navegador no garantiza disponibilidad indefinida: descarga y guarda respaldos JSON externos con frecuencia.

No se incluye sincronización entre dispositivos ni control de acceso. El alojamiento estático entrega la aplicación, pero no guarda los datos financieros.

## Desarrollo local

Requisitos: Node.js y pnpm.

```sh
pnpm install
pnpm dev
```

Comprobaciones:

```sh
pnpm test
pnpm build
```

`pnpm test` cubre cálculos financieros, aportes, respaldos y solicitud de almacenamiento persistente. `pnpm build` genera el sitio de producción con manifest y service worker. Las pruebas end-to-end con Playwright y la prueba manual offline en navegadores reales siguen pendientes.

## Hoja de ruta del MVP

1. **Fundación y libro financiero:** implementados en su versión inicial; faltan filtros de rango y aceptación de persistencia en navegador.
2. **Participantes y obligaciones:** implementación inicial disponible; falta revisión visual/interactiva en navegador.
3. **Aportes:** implementación inicial disponible; cubre pagos agrupados de meses atrasados en uno o varios años, conversión histórica en VES, duplicados y anulaciones con historial. Build y pruebas unitarias pasan; queda la revisión visual/interactiva en navegador.
4. **Resumen:** saldos por cuenta, movimiento del período, aportes y actividad reciente.
5. **Reportes:** exportaciones PDF y Excel para el libro y los aportes.
6. **Respaldo:** JSON versionado, validación, restauración transaccional y recordatorios.
7. **PWA y aceptación:** soporte PWA implementado; falta validar offline e instalación en navegadores/dispositivos reales, añadir pruebas Playwright, revisar con usuarios y definir el dominio HTTPS de producción.

## Fuera del MVP

- Backend, base de datos en la nube, autenticación y sincronización remota.
- Conversión automática de aportes en movimientos financieros.
- Pagos parciales y actualización automática de tasas históricas.
- Gráficos complejos antes de completar los flujos de registro.
- Aplicación de escritorio Tauri + SQLite (posible etapa futura).
