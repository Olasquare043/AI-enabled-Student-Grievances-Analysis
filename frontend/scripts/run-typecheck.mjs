import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { ensureTypeStub } from "./ensure-next-type-stubs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const tsconfigPath = path.join(projectRoot, "tsconfig.json");

const REQUIRED_INCLUDES = [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  ".next/types/routes.d.ts",
  ".next/types/validator.ts",
  ".next/dev/types/**/*.ts",
  ".next/dev/types/**/*.d.ts",
  "**/*.mts",
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} exited with code ${code ?? 1}`));
    });
  });
}

async function normalizeTsconfig() {
  const raw = await readFile(tsconfigPath, "utf8");
  const parsed = JSON.parse(raw);
  parsed.include = REQUIRED_INCLUDES;
  await writeFile(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const tscCli = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

await run(process.execPath, [nextCli, "typegen"]);
await normalizeTsconfig();
await ensureTypeStub();
await run(process.execPath, [tscCli, "-p", "tsconfig.json", "--noEmit", "--incremental", "false"]);
