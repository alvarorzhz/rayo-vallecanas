import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = SRC + specifier.slice(2);
    for (const f of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (statSync(f, { throwIfNoEntry: false })?.isFile()) return next(pathToFileURL(f).href, context);
    }
  }
  return next(specifier, context);
}
