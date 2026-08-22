import type { KirletDataClient, NoxServices } from "@opus-perpetuus/imperium-core-kit";
import { new_id, now_iso } from "@opus-perpetuus/imperium-core-kit";

export async function seed_demo(ctx: {
  data: KirletDataClient;
  nox: NoxServices;
  technical_id: string;
}): Promise<void> {
  const n = await ctx.data.count("pos_session");
  if (n > 0) return;
  const ts = now_iso();
  await ctx.data.insert("pos_session", {
    id: new_id("pos-sess"),
    name: "Sesiones POS (ejemplo)",
    description: "Registro semilla del súbdito. Sustituye al migrar desde Mongo.",
    is_active: true,
    ref: "seed-pos",
    created_at: ts,
    updated_at: ts,
  });
}
