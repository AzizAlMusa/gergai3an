// Railway build script — runs each step as isolated child process
const { execSync } = require("child_process");
const run = (cmd, cwd) => {
  console.log(`\n==> ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
};

run("npm install",    __dirname + "/client");
run("npm run build",  __dirname + "/client");
run("npm install --omit=dev", __dirname + "/server");
console.log("\n==> Build complete!");
