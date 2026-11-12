# Flujos ejecutables (`features/`)

Cada feature visible de esta app tiene un `features/<módulo>/<feature>.flow.yaml`:
los pasos que haría un cliente (clic, teclado, escaneo), con qué cuenta de prueba y
qué debe verse y guardarse. Esquema del plan «feature maps ejecutables de Imperium».
El runner (`yarn flow run`), la ficha `.md` y el manual interactivo salen de estos
archivos en el núcleo; aquí no se escribe la ficha a mano.

| Campo | Qué es |
|--|--|
| `rol` | Cuenta `ia.<rol>` del seed de QA (`admin`, `cajero`, `vendedor`, `ventas`, `gerencia`, `almacen`, `surtido`, `logistica`, `chofer`, `compras`, `consulta`, `sinpermiso`) o `anonimo` (sin sesión). |
| `datos` | Lo que debe existir antes (seed o pasos previos). |
| `inicio` | Ruta donde arranca el flujo. |
| `pasos[].accion` | `clic`, `doble-clic`, `escribir`, `tecla`, `escanear`, `sin-conexion`, `esperar`. |
| `pasos[].ancla` | Valor de `data-manual-anchor`. Solo anclas que ya existen. |
| `pasos[].respaldo` | Rol ARIA y nombre visible, si el ancla no está o falla. |
| `pasos[].ancla_pendiente` | Ancla propuesta que aún no pinta el núcleo (no se valida). |
| `pasos[].espera` | `visible`, `url`, `toast`, `fila`. |
| `pasos[].backend` | Llamada que debe ocurrir (`api`, `status`). |
| `pasos[].captura` | Nombre de la captura del paso. |
| `variantes` | `teclado`, `movil-360`, `sin-conexion`, `sin-permiso`. |

`src/flows.spec.ts` valida la forma de cada flujo y que toda `ancla` citada exista
en el código de esta app (o sea del lanzador: `view-list-row`, `field-<campo>`…).

## Anclas

La caja (`/internal/pos`) es Angular del núcleo: sus anclas (`pos-*`) viven en
`frontend/src/app/components/pos` del monorepo. Los pasos internos que aún no
tienen ancla llevan `ancla_pendiente` con el nombre propuesto y su `respaldo`.
Las pantallas de esta app (promociones, crédito, sesiones, tickets, órdenes) son
hojas del lanzador: sus campos ya pintan `field-<nombre>` y las filas `view-list-row`.
