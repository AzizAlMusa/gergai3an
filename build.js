// build.js — Railway-safe build script
// Each step runs in its own child process to avoid npm chaining bugs
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Resolve paths relative to this script's location (project root)
const ROOT = __dirname;
const CLIENT = path.join(ROOT, "client");
const SERVER = path.join(ROOT, "server");

function run(cmd, cwd) {
  console.log(`\n==> ${cmd}  [cwd: ${cwd}]`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, NODE_ENV: "" } });
}

console.log("==> Build starting");
console.log("    ROOT:", ROOT);
console.log("    CWD: ", process.cwd());

// 1. Install client deps (including devDeps so Vite is available)
run("npm install", CLIENT);

// 2. Build client
run("npm run build", CLIENT);

// 3. Verify dist was created
const distPath = path.join(CLIENT, "dist", "index.html");
if (!fs.existsSync(distPath)) {
  console.error("\n!!! ERROR: client/dist/index.html not found after build!");
  console.error("    Expected at:", distPath);
  process.exit(1);
}
console.log("\n==> Client build verified:", distPath);

// 4. Install server deps (production only)
run("npm install --omit=dev", SERVER);

console.log("\n==> Build complete!");
