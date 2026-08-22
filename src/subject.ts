import { define_subject } from "@opus-perpetuus/imperium-core-kit";
import pkg from "../package.json" with { type: "json" };
import { pos_session_module } from "./modules/pos-session/pos-session.routes.ts";
import { pos_module } from "./modules/pos/pos.routes.ts";
import { pos_order_module } from "./modules/pos-order/pos-order.routes.ts";
import { pos_tickets_module } from "./modules/pos-tickets/pos-tickets.routes.ts";
import { seed_demo } from "./seed.ts";

export const SUBJECT = define_subject({
  id: "SUBJECT-pos",
  name: "POS",
  version: pkg.version,
  image: `ghcr.io/opus-perpetuus/subject-pos:${pkg.version}`,
  compat: { nox: ">=0.5.0", kit: "^0.5.0" },
  schema_version: 1,
  menu_root: {
    id: "pos.root",
    label: "POS",
    order: 0,
  },
  modules: [pos_session_module, pos_module, pos_order_module, pos_tickets_module],
  seed: seed_demo,
});

export const KIRLET = SUBJECT;
