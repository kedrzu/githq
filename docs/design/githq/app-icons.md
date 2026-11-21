# App icons

How large "/hq" sits on githq's icon tile at each size. Every icon file follows it: the web's favicon and install
icons, the desktop app's, and the reference set. `packages/app/scripts/generateIcons.ts` writes them all
(`bun --cwd packages/app icons`); `getTileShape()` there is this guideline in code. Decided in D48 (`DECISIONS.md`).
The tile, the colours and the sygnet are the brandbook's (`Logo — git/hq` in `githq.pen`) and don't change.

## The rule

**The smaller the icon is shown, the larger "/hq" is on its tile.** The type is 54 % of the side up to 32 px, then
4 points less with every doubling of the size.

|Shown at|Type|"/hq" spans|Tile|
|-|-|-|-|
|16, 24, 32 px|54 %|85 % of the width|small|
|48 px|52 %|83 %|large|
|64 px|50 %|80 %|large|
|128 px|46 %|73 %|large|
|256 px|42 %|67 %|large|
|512 px and up|38 %|61 %|large|

- **The size it is shown at counts, not its pixels.** A Retina file (`@2x`) has twice the pixels of the same icon and
  the same proportions.
- **Below 32 px the type stops growing:** at 54 % "/hq" already spans 85 % of the tile, and more would touch its
  edge.
- **Small tile** (up to 32 px): 23 % corners, a 1/32 `#2E333B` edge, tracking −5 %. **Large tile** (above): the same
  corners, a 1/120 faint white edge, tracking −3.5 %.
- **A file with several sizes draws each one for its size**, not scaled from one: `icon.icns` and `icon.ico` hold one
  image per size.
- **Square variants** (`apple-touch-icon.png`, `icon-maskable-512.png`) drop the corners and the edge, because the
  system cuts its own shape. They keep the type of their size.

## Reference set

`docs/assets/app-icons/app-icon-<size>.svg` and `.png` at 16, 24, 32, 48, 64, 128, 256 and 512 px. A new place that
shows the icon takes the file of the size it shows it at.

## Where each file is shown

|File|Shown at|
|-|-|
|`packages/app/public/favicon.svg`|32 px and below: the browser tab, Paseo's project icon|
|`packages/app/public/apple-touch-icon.png`|180 px, square: iOS home screen|
|`packages/app/public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`|the installed web app|
|`packages/desktop/src-tauri/icons/icon.icns`|macOS: 16, 32, 128, 256, 512 px, each at 1× and 2×|
|`packages/desktop/src-tauri/icons/icon.ico`|Windows: 16, 24, 32, 48, 64, 256 px|
|`packages/desktop/src-tauri/icons/*.png`|Linux: 32, 128 px (and 128 px at 2×), 512 px|
