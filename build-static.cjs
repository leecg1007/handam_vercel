const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = __dirname;
const output = path.join(root, "dist");
const staticFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "week-calendar.js",
  "diary-stats.js",
  "animations.js",
  "interactions.js",
  "prompt-animations.js",
  "segment-control.js",
  "db-worker.js",
  "manifest.webmanifest",
  "apple-touch-icon.png",
];

console.log("Building React UI (react-bits splash)...");
execSync("npx vite build", { cwd: root, stdio: "inherit" });

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of staticFiles) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

fs.cpSync(path.join(root, "icons"), path.join(output, "icons"), { recursive: true });

const dataDir = path.join(root, "data");
if (fs.existsSync(dataDir)) {
  fs.mkdirSync(path.join(output, "data"), { recursive: true });
  for (const name of fs.readdirSync(dataDir)) {
    if (name.endsWith(".json")) {
      fs.copyFileSync(path.join(dataDir, name), path.join(output, "data", name));
    }
  }
}

const uiDist = path.join(root, "ui-dist");
if (fs.existsSync(uiDist)) {
  fs.mkdirSync(path.join(output, "ui-dist"), { recursive: true });
  for (const name of fs.readdirSync(uiDist)) {
    fs.copyFileSync(path.join(uiDist, name), path.join(output, "ui-dist", name));
  }
}

console.log("Static web app exported to dist");
