/**
 * Local development only – bypasses TLS certificate verification for the Node.js process,
 * fixing UNABLE_TO_VERIFY_LEAF_SIGNATURE on some Windows setups (AV HTTPS inspection).
 * Do NOT use this for production deployments.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextCli, "dev"], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
