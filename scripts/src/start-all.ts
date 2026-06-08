import { execSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

console.log("🧹 Cleaning up ports 3000 (Backend), 8081 (Expo), 8100 (OCR)...");
try {
  execSync("npx -y kill-port 3000 8081 8100", { stdio: "inherit" });
} catch (e) {
  console.warn("⚠️ Non-critical warning: Failed to clean some ports. Moving forward.");
}

function startService(name: string, command: string, args: string[], cwd: string) {
  console.log(`🚀 Starting ${name}...`);
  const child = spawn(command, args, {
    cwd,
    shell: true,
    stdio: "pipe",
    env: { ...process.env, FORCE_COLOR: "true" }
  });

  child.stdout?.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) console.log(`[${name}] ${line.trim()}`);
    }
  });

  child.stderr?.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) console.error(`[${name} ERR] ${line.trim()}`);
    }
  });

  child.on("close", (code) => {
    console.log(`🛑 ${name} process exited with code ${code}`);
  });

  return child;
}

const ocrDir = path.join(rootDir, "artifacts/ocr-service");
const backendDir = path.join(rootDir, "artifacts/api-server");
const expoDir = path.join(rootDir, "artifacts/discharge-buddy");

// Start services
const ocr = startService("OCR", "python", ["main.py"], ocrDir);
const backend = startService("Backend", "pnpm", ["run", "dev"], backendDir);
const expo = startService("Expo", "pnpm", ["run", "dev"], expoDir);

// Handle process termination gracefully
const cleanup = () => {
  console.log("\n👋 Stopping all services...");
  try { ocr.kill(); } catch {}
  try { backend.kill(); } catch {}
  try { expo.kill(); } catch {}
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
