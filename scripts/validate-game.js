const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);

function collectFiles(directory, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectFiles(path.join(directory, entry.name), predicate));
      }
    } else if (predicate(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

const jsFiles = collectFiles(root, (name) => name.endsWith(".js"));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `JavaScript syntax check failed for ${path.relative(root, file)}:\n${result.stderr}`
  );
}

const candidateFiles = [
  path.join(root, "index.html"),
  ...collectFiles(root, (name) => [".css", ".js", ".html"].some((extension) => name.endsWith(extension))),
];
const assetExtensions = /\.(?:png|webp|jpe?g|gif|mp3|wav|ogg|mp4)(?:[?#][^"'`\s)]*)?/i;
const referencedAssets = new Set();
for (const file of candidateFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/["'`]([^"'`\r\n]+)["'`]/g)) {
    const reference = match[1];
    if (!assetExtensions.test(reference) || reference.includes("${")) continue;
    const assetPath = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    if (/^(?:https?:|data:|blob:)/i.test(assetPath) || assetPath === "Map/9.png") continue;
    referencedAssets.add(path.resolve(root, assetPath));
  }
}

const missingAssets = [...referencedAssets].filter((asset) => !fs.existsSync(asset));
assert.deepEqual(
  missingAssets,
  [],
  `Missing referenced assets:\n${missingAssets.map((asset) => path.relative(root, asset)).join("\n")}`
);

const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(gameSource, /function resolveArenaMapPath\(path\)/, "Map 9 must use the map fallback resolver.");
assert.match(gameSource, /Map\/9\.png[\s\S]{0,80}DEFAULT_ARENA_MAP_PATH/, "Map 9 fallback is not configured.");
assert.doesNotMatch(gameSource, /hitStopTimer/, "Hit-stop must remain removed.");
assert.match(
  gameSource,
  /document\.getElementById\("start-btn"\)\.addEventListener\("click", startMatchWithIntro\)/,
  "Start button must open the match flow."
);
assert.match(
  gameSource,
  /function startMatchWithIntro\(\)\s*\{[\s\S]*?initGameState\(p1Char, p2Char\);[\s\S]*?state\.running = true;/,
  "Start flow must initialize and start the match."
);
assert.equal((htmlSource.match(/class="char-card"/g) || []).length, 8, "Expected eight selectable fighters.");
assert.equal((htmlSource.match(/class="game-mode-btn/g) || []).length, 3, "Expected three game modes.");
for (let mapNumber = 1; mapNumber <= 15; mapNumber += 1) {
  if (mapNumber === 9) continue;
  assert.ok(
    fs.existsSync(path.join(root, "Map", `${mapNumber}.png`)),
    `Missing map asset Map/${mapNumber}.png`
  );
}

console.log(`Validated syntax for ${jsFiles.length} JavaScript files.`);
console.log(`Validated ${referencedAssets.size} explicit local asset references.`);
console.log("Validated fighter/mode counts, map fallback, and start-match wiring.");
