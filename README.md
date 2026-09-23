# OpenDrop

OpenDrop is an open-source desktop app for installing apps and games on Steam
Frame. Choose an APK, a Linux ARM64 build, a Windows executable or a ZIP. OpenDrop
checks the files, sends them to your headset and adds a non-Steam Game to Steam.

> I haven't received my Steam Frame yet, so I haven't tested OpenDrop on real
hardware. This is an experimental app, and it may not work at all.

Automated tests cover the local install flow and a simulated Devkit HTTP/SSH/SFTP
server. CI builds Windows and Linux installers, but I haven't verified them on
this development machine.

The app targets Windows, macOS and Linux. It uses Electron, React, TypeScript
and daisyUI, with SSH/SFTP transfers handled in Node.js. You don't need ADB,
rsync or Python on your computer. Valve's Python helpers run on the headset.

## Run locally

Install Node.js 22.12 or later. Node.js 24 LTS is a suitable development version.

```sh
npm ci
npx --no-install install-electron
npm run dev
```

The `install-electron` command downloads the Electron 44 runtime. Run it again
if you change operating systems or CPU architectures.

To try the app without a headset:

```sh
npm run dev:demo
```

You can also turn on **Test mode** in the sidebar. Connect the simulator, choose
**Try a sample build**, select a start file and simulate an installation.
You can queue or cancel installs, simulate launches and check the library history
for all three runtimes. Test mode never connects to a headset, though install
links still download files to your computer for inspection.

## Connect a Steam Frame

1. Connect your computer and headset to the same network.
2. On the headset, enable **Settings > System > Developer Mode**.
3. Open **Settings > Developer > Pair new host**.
4. In OpenDrop, disable Test mode and click **Find headset**, or enter the
   headset's hostname or IP address. The usual service port is `32000`.
5. Click **Pair headset** and confirm on the headset. Verify and accept the SSH
   fingerprint in OpenDrop's first-connection dialog.
6. After pairing, use **Connect**. OpenDrop keeps its own SSH key, separate from
   the official Devkit Client's key.

OpenDrop finds headsets through mDNS and pairs through the Devkit HTTP service.
File transfers and launch commands use authenticated SSH on port 22. If discovery fails,
check local network permissions and try the IP address directly. Guest Wi-Fi and
client isolation can prevent the two devices from communicating.

## Install a build

Drop a file or folder into the app, or use the file picker. Check the app name and
start file, then click **Install on headset**. The queue shows progress and marks
the app installed only after Steam confirms registration.

| Build         | Requirements                                                                           |
| ------------- | -------------------------------------------------------------------------------------- |
| Android APK   | ARM64 native libraries, or an APK without native libraries. Uses Lepton.               |
| Linux         | 64-bit ARM64 ELF executable. Uses `SteamLinuxRuntime_4-arm64`.                         |
| Windows       | PE executable ending in `.exe`. Requires compatible ARM64 Proton on the headset.       |
| ZIP or folder | Must contain at least one supported app. Select the start file when there are several. |

OpenDrop keeps the ZIP's folder structure and companion files. For a Windows game
with DLLs or data files, choose the entire build folder. Selecting a single `.exe`
uploads only that file. OpenDrop gives ARM64 Linux launch files executable
permission on the headset.

Open the **Non-Steam** section of the headset's Steam library to find the Devkit
Game, or launch it from OpenDrop. Each install gets a unique `opendrop-<name>-<id>`
identifier, visible in Steam, to avoid overwriting an existing game. Installing
the same build again creates another entry.

The Library shows OpenDrop's local install history, including labeled simulated
installs. Launch is available only when the matching device is connected.
Removing an app on the headset does not remove its history entry.

## Install links

Use **Install from a link** with a public HTTPS file URL or a JSON manifest.
OpenDrop accepts `opendrop.install/v1` with one file per manifest. If you include
a SHA-256 checksum, OpenDrop verifies it before inspecting the build.

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

Open a link to see the download dialog, then download the build for review.
Installation starts only when you choose Install. Development builds do not
register a system URL handler.

## Limits and storage

- Maximum build size: 32 GiB or 50,000 files. Maximum download size: 8 GiB.
- OpenDrop rejects ZIP entries that escape the extraction folder, encrypted
  entries, symbolic links, duplicate names and paths that are unsafe on any
  supported platform. Folder uploads also reject symbolic links. This version
  does not recognize shell scripts as Linux start files.
- Download URLs must use public HTTPS on port 443. OpenDrop rejects private
  addresses, credentials in URLs and local URLs. It checks redirects by the same
  rules and pins DNS results for each request.
- OpenDrop checks the package structure and CPU architecture. It cannot guarantee
  compatibility with a game's VR APIs, store services or copy protection.
- Install the required runtimes on your headset first. OpenDrop does not install
  or update Proton, Lepton or Steam Linux Runtime.
- Cancelled or failed device uploads can leave partial files. The Activity log
  includes the exact `~/devkit-game/opendrop-...` directory. This version has no
  uninstall or resume function.

OpenDrop stores install history, trusted host fingerprints, its private SSH key
and temporary build files in your application data directory:

| Platform | Default directory                        |
| -------- | ---------------------------------------- |
| macOS    | `~/Library/Application Support/OpenDrop` |
| Windows  | `%APPDATA%/OpenDrop`                     |
| Linux    | `${XDG_CONFIG_HOME:-~/.config}/OpenDrop` |

Keep `id_ed25519` private. OpenDrop rejects connections when a device's fingerprint
changes. If you reset your headset, verify its new fingerprint, close OpenDrop
and remove the old host entry from `state.json`.

OpenDrop removes temporary files when you discard a build, finish an install or
exit normally. After a crash, you can delete leftover files in `cache` while the
app is closed. OpenDrop has no analytics and needs no remote account.

The interface uses daisyUI with flat light and dark themes. Choose Light, Dark
or System under Appearance in the sidebar. OpenDrop saves your choice on this
computer.

## Development and builds

```sh
npm run check       # TypeScript checks, automated tests, production build
npm run test:ui     # Launch and test the built Electron app
npm run test:interface # Check layout, themes, keyboard flow and interface states
npm run package     # Build an installer for the current operating system
```

The UI tests need a graphical session. On headless Linux, use
`xvfb-run --auto-servernum npm run test:ui`. Protocol tests bind temporary loopback
ports and communicate only with their test servers, without discovering or
contacting real headsets.

Run `npm run build` before either UI test command. Both use temporary application
data. The interface checks cover widths from 320 to 1180 pixels, 200% zoom,
light and dark themes, gradient-free backgrounds, dialog focus, filters and
queue visibility. Find the screenshots in `test-results/interface/`.

`npm run package` writes installers to `release/`: DMG and ZIP on macOS, NSIS on
Windows, and AppImage on Linux. GitHub Actions builds these on each operating
system and saves them as workflow artifacts without publishing a release.
Development packages are unsigned. Set up signing before distributing public
macOS or Windows releases.

The main folders are:

| Folder             | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `src/main`         | Build inspection, downloads, pairing, transfers, queue and persistence |
| `src/preload`      | IPC bridge between the sandboxed UI and the main process               |
| `src/renderer`     | Desktop interface                                                      |
| `src/shared`       | Shared types                                                           |
| `resources/devkit` | Pinned MIT-licensed Valve helpers for Steam registration and launch    |
| `tests`            | Package validation, queue, URL and local protocol tests                |

## Contributing

I'm open to changes and improvements. If something is broken or could work
better, pull requests are welcome.

## Protocol references

The implementation follows the public
[SteamOS Devkit source](https://gitlab.steamos.cloud/devkit/steamos-devkit) at
revision `e091c1761d761c77ee100fada5b272bfd2e591ad`. OpenDrop uses the runtime names
from that revision rather than older examples in the
[Steam Frame loading guide](https://partner.steamgames.com/doc/steamhardware/steamframe/loadgames?l=english).
SFTP replaces the official client's rsync transfer step.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
OpenDrop is not affiliated with Valve.
