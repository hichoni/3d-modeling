# Browser FDM worker build

The committed `vendor/kiri/fdm-worker.js` is sufficient to run the app. No npm install, external CDN, remote slicer or Bambu Studio is required for participants or for browser jobs on the relay.

Rebuild only when changing the engine adapter/profile. From the repository root, with Node 20+ and Git:

```powershell
git clone https://github.com/GridSpace/grid-apps.git artifacts/grid-apps
git -C artifacts/grid-apps checkout d138275bbe9d4e4030d8cb8b2dcf66607da9295a
cd tools/slicer
npm ci --ignore-scripts --no-audit --no-fund
cd ../..
node tools/slicer/build.cjs
node scripts/build.cjs
node --test tests/*.test.cjs
```

If the checkout already exists, verify its revision rather than cloning over it. Do not run upstream setup/clean scripts. The builder refuses a different revision. The lockfile pins build dependencies. `build-info.json` records source/adapter/bundle hashes.

The adapter invokes upstream worker dispatch directly, includes only the FDM driver, adapts the generated Three/JSZip/QuickJS imports to npm packages and embeds QuickJS WASM as a data URI. The main HTML creates a Blob Worker, so one HTML file works offline. No SharedArrayBuffer/cross-origin isolation is required. Upstream optional geometry WASM and network integrations are unused; the test harness rejects all external fetch/imports. No printer credentials enter this worker.

`src/browser-slice-worker.js` fixes the 180mm A1 mini bed, 0.4mm nozzle, PLA with 0.12/0.16/0.20mm layers (0.20mm first layer), with allowlisted Generic PLA and Bambu PLA Matte web presets in src/print-profiles.js. It exports **model paths only**, without machine heating/homing. `src/toolpaths.js` independently validates these paths in the browser and relay. The relay adds its own fixed machine wrapper and packages a 3MF. Physical validation of this combination is still pending; see `docs/WEB_FIRST.md`.

Licenses: `vendor/kiri/LICENSES.txt` and the preserved esbuild notices. Public engine source: [pinned GridSpace tree](https://github.com/GridSpace/grid-apps/tree/d138275bbe9d4e4030d8cb8b2dcf66607da9295a). Build adapters and fixed settings remain readable in this repository. The existing r128 renderer stays separate from the worker's Three 0.182 dependency.
