import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const nextTypesDir = path.join(projectRoot, ".next", "types");
const nextDevTypesDir = path.join(projectRoot, ".next", "dev", "types");
const targetFile = path.join(nextTypesDir, "cache-life.d.ts");
const sourceFile = path.join(nextDevTypesDir, "cache-life.d.ts");

const fallbackContents = `declare module "next/cache" {
  export function cacheLife(profile: string | { stale?: number; revalidate?: number; expire?: number }): void;
  export const unstable_cacheLife: typeof cacheLife;
}
`;

export async function ensureTypeStub() {
  await mkdir(nextTypesDir, { recursive: true });

  try {
    await copyFile(sourceFile, targetFile);
    return;
  } catch {
    await writeFile(targetFile, fallbackContents, "utf8");
  }
}

if (import.meta.url === `file://${__filename}`) {
  await ensureTypeStub();
}
