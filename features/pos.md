# POS

Quien usa la app entra al menú POS y ve sus estaciones, sesiones, tickets y
órdenes. Queda probado que la lista de Estación POS responde para la sesión
de la corrida.

## Sub-features

La app hace la acción de `estacion`: sí. Esta ficha no lleva línea
`Subject:` con imagen: el catálogo no da un tag para rellenarla. El hueco
está en `despliegue.md` del monorepo.

- `estacion` deja un resultado observable: `GET /pos` de la app responde 200.

### Archivos y contratos

- `src/subject.ts` — `define_subject` de `subject-pos` y sus `dependsOn`
  (`subject-almacen`, `subject-rh`).
- `src/modules/pos/pos.routes.ts` — `define_crud` del recurso `pos`.
- Página `pos.pos` del manifiesto, ruta `pos`, permiso `subject.pos.pos.read`.

### Mapa

| id | ruta | rol semilla | pasos | esperado | muta | receta |
| --- | --- | --- | --- | --- | --- | --- |
| `subject-pos.estacion` | `GET /pos` | sin definir | listar Estación POS | HTTP 200 | no | sin definir |

## How to get to it (user POV)

- Menú POS → Estación POS (ruta `pos` del manifiesto).

## Driving it with arnes

Preconditions:

- Doctor en 0. Si falta `subject-pos`, la receta sale `omitida`.

- **Abrir.** Ruta `pos` o `GET /pos`; el resultado de la sub-feature
  `estacion` es el status HTTP.
- **Proof.** `evidence/pos/`.

## Gotchas

- Una receta de lectura que escribe sale en fallo aunque la pantalla se vea bien.
- No hay base QA nombrada: ninguna receta muta.
- `omitida` no cuenta como probada.
