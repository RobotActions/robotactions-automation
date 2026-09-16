/**
 * Regenerate .features-gen whenever a feature or step file changes.
 *
 * Why this exists: the VS Code Playwright extension discovers tests from
 * playwright.config.ts → testDir, which for playwright-bdd is the *generated*
 * .features-gen directory. Without regeneration, a scenario you just wrote
 * never reaches the Testing view, and a deleted one lingers there.
 *
 * Deliberately dependency-free (no chokidar/nodemon): node:fs recursive watch
 * where the platform supports it, with a per-directory fallback for the Linux
 * + Node 18 combination where recursive watching throws.
 */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCHED = ['features', 'steps'];
const DEBOUNCE_MS = 200;

/** @type {NodeJS.Timeout | null} */
let timer = null;
let running = false;
let queued = false;

function generate() {
    if (running) { queued = true; return; }
    running = true;
    const started = Date.now();
    const child = spawn('npx', ['bddgen'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => {
        running = false;
        const ms = Date.now() - started;
        console.log(code === 0 ? `[bddgen] regenerated in ${ms}ms` : `[bddgen] failed (exit ${code})`);
        if (queued) { queued = false; generate(); }
    });
}

/** @param {string | null} file */
function schedule(file) {
    if (file && !/\.(feature|ts)$/.test(file)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(generate, DEBOUNCE_MS);
}

for (const dir of WATCHED) {
    const target = path.join(root, dir);
    try {
        watch(target, { recursive: true }, (_event, file) => schedule(file));
    } catch {
        // ERR_FEATURE_UNAVAILABLE_ON_PLATFORM — both directories are flat in
        // this template, so a non-recursive watch loses nothing.
        watch(target, (_event, file) => schedule(file));
    }
}

console.log(`[bddgen] watching ${WATCHED.join(', ')} — regenerating .features-gen on change`);
generate();
