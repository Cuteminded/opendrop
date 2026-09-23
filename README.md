# OpenDrop

OpenDrop is an open-source desktop app for installing software on Steam Frame.
Choose an APK, a Linux ARM64 build, a Windows executable, or a ZIP. OpenDrop checks
the files, transfers them to your headset and adds a Devkit Game to Steam.

The app targets Windows, macOS and Linux. It uses Electron, React, TypeScript and daisyUI,
with SSH/SFTP implemented in Node.js. You do not need ADB, rsync or Python on your
computer. Valve's small Python helpers run on the headset.

This is an early version. Automated tests cover the local install flow and a
simulated Devkit HTTP/SSH/SFTP server. Installation and launching on a physical
Steam Frame still need testing. Windows and Linux installers are configured in CI;
they have not been verified on this development machine.

## Run locally

Install Node.js 22.12 or later. Node.js 24 LTS is a suitable development version.

```sh
npm ci
npx --no-install install-electron
npm run dev
```

Electron 44 downloads its native runtime through the separate `install-electron`
command. Run that command again if you change operating systems or architectures.

To try the app without a headset:

```sh
npm run dev:demo
```

You can also enable **Test mode** in the sidebar. Connect the simulator, choose
**Try a sample build**, select a start file, then simulate an installation.
The simulator supports all three runtimes, a queue, cancellation, launch events
and local library history. It never connects to a headset. Choosing an install
link still downloads the file to your computer for inspection.

## Connect a Steam Frame

1. Put the computer and headset on the same network.
2. On the headset, enable **Settings > System > Developer Mode**.
3. Open **Settings > Developer > Pair new host**.
4. In OpenDrop, disable Test mode and click **Find headset**, or enter the
   headset's hostname or IP address. The usual service port is `32000`.
5. Click **Pair headset** and confirm on the headset. Verify and accept the SSH
   fingerprint in OpenDrop's first-connection dialog.
6. On later visits, use **Connect**. OpenDrop keeps its own SSH key, separate from
   the official Devkit Client's key.

Device discovery uses mDNS. Pairing uses the Devkit HTTP service. Authenticated
uploads and launch commands use SSH on port 22. If discovery does not work,
check local network permissions and try the IP address directly. Guest Wi-Fi and
client isolation can prevent the two devices from communicating.

## Install a build

Drop a file or folder into the app, or use the file picker. Check the app name and
start file, then click **Install on headset**. The install queue reports progress
and only marks the app installed after Steam confirms registration.

| Build         | Requirements                                                                           |
| ------------- | -------------------------------------------------------------------------------------- |
| Android APK   | ARM64 native libraries, or an APK without native libraries. Uses Lepton.               |
| Linux         | 64-bit ARM64 ELF executable. Uses `SteamLinuxRuntime_4-arm64`.                         |
| Windows       | PE executable ending in `.exe`. Requires compatible ARM64 Proton on the headset.       |
| ZIP or folder | Must contain at least one supported app. Select the start file when there are several. |

ZIP wrapper directories and companion files are preserved. For a Windows game
with DLLs or data files, choose its entire build folder. Selecting a single `.exe`
uploads only that file. Native ARM64 Linux launch files receive executable
permission on the headset.

Open the **Non-Steam** section of the headset's Steam library to find the Devkit
Game, or launch it from OpenDrop. Each install gets a unique `opendrop-<name>-<id>`
identifier so it cannot overwrite an existing game. The identifier is visible in
Steam. Installing the same build again creates another entry.

OpenDrop's Library is local install history, not a live inventory of the headset.
It labels simulated installs and enables Launch only for the matching connected
device. Removing an app on the headset does not remove its history entry.

## Install links

Use **Install from a link** with a public HTTPS file URL or a JSON manifest.
OpenDrop accepts `opendrop.install/v1` with one file per manifest. An optional
SHA-256 checksum is verified before inspection.

```json
{
  "schema": "opendrop.install/v1",
  "name": "My game",
  "files": [{ "url": "https://example.com/my-game-arm64.apk" }]
}
```

The packaged app registers its own URL scheme:

```text
opendrop://install?manifest=https%3A%2F%2Fexample.com%2Fmy-game.json
opendrop://install?url=https%3A%2F%2Fexample.com%2Fmy-game.apk
```

Opening a link presents a download dialog. Downloading presents a build review.
Neither action starts an installation. Development builds do not register a
system URL handler.

## Limits and storage

- Maximum build size: 32 GiB or 50,000 files. Maximum download size: 8 GiB.
- ZIP extraction rejects path traversal, encrypted entries, symbolic links,
  duplicate names and paths that cannot be represented safely on all platforms.
  Folder uploads also reject symbolic links. Shell scripts are not detected as
  Linux entry points in this version.
- Download URLs require public HTTPS on port 443. Private addresses, credentials
  and local URLs are rejected. Redirects receive the same validation, and DNS
  results are pinned for each request.
- OpenDrop checks the package structure and CPU architecture. It cannot guarantee
  compatibility with a game's VR APIs, store services or copy protection.
- Required headset runtimes must already be available. OpenDrop does not install
  or update Proton, Lepton or Steam Linux Runtime.
- Cancelled or failed device uploads can leave partial files. The Activity log
  includes the exact `~/devkit-game/opendrop-...` directory. This version has no
  uninstall or resume function.

History, trusted host fingerprints, a private SSH key and temporary build files
are stored in Electron's per-user application data directory:

| Platform | Default directory                        |
| -------- | ---------------------------------------- |
| macOS    | `~/Library/Application Support/OpenDrop` |
| Windows  | `%APPDATA%/OpenDrop`                     |
| Linux    | `${XDG_CONFIG_HOME:-~/.config}/OpenDrop` |

Keep `id_ed25519` private. A changed device fingerprint is rejected. If a headset
is reset, verify its new fingerprint before removing that host's saved entry
from `state.json` while OpenDrop is closed. Temporary files are removed after
discarding a build, finishing an install or exiting normally. A crash may leave
files in the `cache` subdirectory; these can be removed while the app is closed.
No analytics or remote account is used.

The interface uses daisyUI components with flat light and dark themes. Choose Light,
Dark or System under Appearance in the sidebar. OpenDrop remembers this choice
on this computer.

## Development and builds

```sh
npm run check       # TypeScript checks, automated tests, production build
npm run test:ui     # Launch and test the built Electron app
npm run test:interface # Check layout, themes, keyboard flow and interface states
npm run package     # Build an installer for the current operating system
```

The UI test requires a graphical session. On headless Linux use
`xvfb-run --auto-servernum npm run test:ui`. Protocol tests bind temporary loopback
ports and communicate only with their test servers. They do not discover or
contact real headsets.

Run `npm run build` before either interface test. Both use temporary application
data. The interface checks cover 320 to 1180 pixel widths, 200% zoom, light and
dark themes, gradient-free backgrounds, dialog focus, filters and queue visibility. Screenshots are saved
in `test-results/interface/`.

Installers are written to `release/`: DMG and ZIP on macOS, NSIS on Windows, and
AppImage on Linux. The GitHub Actions workflow builds these on their respective
operating systems and stores them as workflow artifacts. It does not publish a
release. macOS and Windows distribution still require signing setup for normal
public releases; the default development packages are unsigned.

The main folders are:

| Folder             | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `src/main`         | Build inspection, downloads, pairing, transfers, queue and persistence |
| `src/preload`      | Narrow IPC bridge between the sandboxed UI and the main process        |
| `src/renderer`     | Desktop interface                                                      |
| `src/shared`       | Shared types                                                           |
| `resources/devkit` | Pinned MIT-licensed Valve helpers for Steam registration and launch    |
| `tests`            | Package validation, queue, URL and local protocol tests                |

## Protocol references

The implementation follows the public
[SteamOS Devkit source](https://gitlab.steamos.cloud/devkit/steamos-devkit) at
revision `e091c1761d761c77ee100fada5b272bfd2e591ad`. Its runtime aliases take
precedence over older examples in the
[Steam Frame loading guide](https://partner.steamgames.com/doc/steamhardware/steamframe/loadgames?l=english).
SFTP replaces the official client's rsync transfer step.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
OpenDrop is not affiliated with Valve.
