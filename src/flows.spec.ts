//   #region FLOWS (feature maps ejecutables)

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Los `features/<módulo>/<feature>.flow.yaml` describen cada feature como la
 * usaría un cliente. El runner y el manual del núcleo los leen; aquí solo se
 * cuida que estén bien formados y que cada `ancla` citada exista en el código
 * de esta app (o sea un ancla conocida del lanzador). Un ancla renombrada sin
 * actualizar su flujo rompe esta prueba, no la corrida nocturna.
 */

const ROOT = join(import.meta.dir, "..");

/** Cuentas `ia.*` del plan (sin el prefijo) y `anonimo` para el sitio público. */
const ROLES = new Set([
  "admin", "cajero", "vendedor", "ventas", "gerencia", "almacen", "surtido",
  "logistica", "chofer", "compras", "consulta", "sinpermiso", "anonimo",
]);
const ACCIONES = new Set([
  "clic", "doble-clic", "escribir", "tecla", "escanear", "sin-conexion", "esperar",
]);
const VARIANTES = new Set(["teclado", "movil-360", "sin-conexion", "sin-permiso"]);

/** Anclas que pinta el lanzador del núcleo (no viven en este repo). */
const CORE_ANCHORS = new Set<string>([
  "view-list-row", "main-menu-toggle", "header-manual-button", "header-logout",
  // Caja Angular del núcleo (frontend/src/app/components/pos).
  "pos-apartados", "pos-arqueo", "pos-atajos", "pos-cotizaciones", "pos-credito-clientes",
  "pos-devolucion", "pos-entrada-efectivo", "pos-formas-de-pago", "pos-live-catalog",
  "pos-reimpresion", "pos-ventas-en-espera",
]);

type Paso = {
  accion: string;
  ancla?: string;
  ancla_pendiente?: string;
  respaldo?: { rol?: string; nombre?: string };
  tecla?: string;
};
type Flujo = {
  feature: string;
  modulo: string;
  titulo: string;
  rol: string;
  datos: string[];
  inicio: string;
  pasos: Paso[];
  variantes: string[];
};

function source_text(): string {
  const glob = new Bun.Glob("src/**/*.ts");
  let out = "";
  for (const f of glob.scanSync({ cwd: ROOT })) {
    if (f.endsWith(".spec.ts")) continue;
    out += readFileSync(join(ROOT, f), "utf8") + "\n";
  }
  return out;
}

const SRC = source_text();

/** Campos declarados (`name: "x"`) → su ancla automática `field-x`. */
const FIELD_NAMES = new Set(
  [...SRC.matchAll(/name:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]!),
);
for (const m of SRC.matchAll(/text_field\(\s*\w+,\s*"([a-z0-9_]+)"/g)) FIELD_NAMES.add(m[1]!);
for (const m of SRC.matchAll(/menu_field\(\s*"([a-z0-9_]+)"/g)) FIELD_NAMES.add(m[1]!);

function anchor_exists(anchor: string): boolean {
  if (CORE_ANCHORS.has(anchor)) return true;
  if (anchor.startsWith("field-") && FIELD_NAMES.has(anchor.slice(6))) return true;
  if (SRC.includes(`"${anchor}"`) || SRC.includes(`\`${anchor}\``)) return true;
  // Sufijos que arma el helper (`${anchor}-cantidad`) o prefijos con dato (`x-${slug}`).
  const suffix = /^(.*)-(cantidad|enviar)$/.exec(anchor);
  if (suffix && SRC.includes(`"${suffix[1]}"`) && SRC.includes(`\${anchor}-${suffix[2]}`)) return true;
  for (const m of SRC.matchAll(/`([a-z0-9-]+-)\$\{/g)) if (anchor.startsWith(m[1]!)) return true;
  return false;
}

function load_flows(): Array<{ file: string; flow: Flujo }> {
  const glob = new Bun.Glob("features/**/*.flow.yaml");
  return [...glob.scanSync({ cwd: ROOT })].sort().map((file) => ({
    file,
    flow: Bun.YAML.parse(readFileSync(join(ROOT, file), "utf8")) as Flujo,
  }));
}

const FLOWS = load_flows();

describe("features/*.flow.yaml", () => {
  test("hay flujos", () => {
    expect(FLOWS.length).toBeGreaterThan(0);
  });

  for (const { file, flow } of FLOWS) {
    test(file, () => {
      const [, modulo, name] = /^features\/([^/]+)\/([^/]+)\.flow\.yaml$/.exec(file) ?? [];
      expect(flow.modulo).toBe(modulo!);
      expect(flow.feature).toBe(name!);
      expect(typeof flow.titulo).toBe("string");
      expect(ROLES.has(flow.rol)).toBe(true);
      expect(Array.isArray(flow.datos)).toBe(true);
      expect(flow.inicio.startsWith("/")).toBe(true);
      expect(flow.pasos.length).toBeGreaterThan(0);
      for (const v of flow.variantes) expect(VARIANTES.has(v)).toBe(true);
      flow.pasos.forEach((p, i) => {
        const at = `${file} paso ${i + 1}`;
        expect(ACCIONES.has(p.accion), `${at}: acción «${p.accion}»`).toBe(true);
        if (p.accion === "tecla") expect(p.tecla, at).toBeTruthy();
        if (p.accion === "clic" || p.accion === "escribir" || p.accion === "doble-clic") {
          // Sin ancla, el respaldo por rol y nombre visible es obligatorio.
          expect(Boolean(p.ancla || p.respaldo?.nombre), `${at}: sin ancla ni respaldo`).toBe(true);
        }
        if (p.ancla) expect(anchor_exists(p.ancla), `${at}: ancla «${p.ancla}» no existe`).toBe(true);
      });
    });
  }
});

//   #endregion FLOWS
