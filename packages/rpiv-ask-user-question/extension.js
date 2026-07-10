import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundledExtension = join(here, "dist", "extension.js");
const mod = existsSync(bundledExtension)
  ? await import("./dist/extension.js")
  : await import("./index.ts");

export default mod.default;
