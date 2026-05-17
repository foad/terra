// E2E harness wrapper: refuse if port 4173 is already taken, then build + preview.
// Playwright's webServer config invokes this; it forwards SIGTERM to the
// preview process so teardown is clean.

import { spawn } from "child_process";
import net from "net";

const PORT = 4173;

const portInUse = await new Promise((resolve) => {
  const server = net.createServer();
  server.once("error", () => resolve(true));
  server.once("listening", () => server.close(() => resolve(false)));
  server.listen(PORT);
});

if (portInUse) {
  process.stderr.write(
    `\nE2E harness: port ${PORT} is already in use.\n` +
      `The harness needs to manage the preview server itself so the build is up-to-date.\n` +
      `Stop any other process on port ${PORT} and retry.\n\n`,
  );
  process.exit(1);
}

const exitCode = await new Promise((resolve) => {
  const build = spawn("npm", ["run", "build"], { stdio: "inherit" });
  build.on("exit", resolve);
});
if (exitCode !== 0) {
  process.exit(exitCode ?? 1);
}

const preview = spawn("npm", ["run", "preview"], { stdio: "inherit" });
const forward = (sig) => () => preview.kill(sig);
process.on("SIGINT", forward("SIGINT"));
process.on("SIGTERM", forward("SIGTERM"));
preview.on("exit", (code) => process.exit(code ?? 0));
