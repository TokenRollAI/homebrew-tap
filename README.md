# Tool Bridge Homebrew Tap

[![Tests](https://github.com/TokenRollAI/homebrew-tap/actions/workflows/tests.yml/badge.svg)](https://github.com/TokenRollAI/homebrew-tap/actions/workflows/tests.yml)

Homebrew distribution for the [Tool Bridge](https://github.com/TokenRollAI/tool-bridge) CLI, `tb`.

## Install

```sh
brew install tokenrollai/tap/tool-bridge
tb --version
tb --help
```

Homebrew installs the Node.js runtime dependency automatically. This tap installs the published `@tool-bridge/cli` npm package and exposes the `tb` command on macOS and Linux.

If `tb` was previously installed globally through npm, remove that installation before switching package managers:

```sh
npm uninstall -g @tool-bridge/cli
brew install tokenrollai/tap/tool-bridge
```

If Homebrew already installed the formula but reported a link conflict, run `brew link tokenrollai/tap/tool-bridge` after removing the npm installation.

## Upgrade or uninstall

```sh
brew update
brew upgrade tokenrollai/tap/tool-bridge
```

```sh
brew uninstall tool-bridge
```

The CLI stores profiles under `$XDG_CONFIG_HOME/tool-bridge`, or `~/.config/tool-bridge` by default. Homebrew does not remove those profiles when uninstalling the formula.

## Release updates

The **Update tool-bridge** workflow checks npm every day at 03:23 UTC and can also be started manually from GitHub Actions. It validates the package identity, stable version, registry URL and npm SHA512 integrity before updating the formula's URL and SHA256. It rejects version downgrades and changes to an already packaged version.

An update creates an `automation/tool-bridge-<version>` branch and explicitly runs the **Tests** workflow on that branch. By default, the workflow provides a comparison link in its run summary for a maintainer to open a pull request. The current organization policy disallows pull requests created by `GITHUB_TOKEN`. If that policy later allows them, set the repository Actions variable `CREATE_UPDATE_PRS` to `true` to enable automatic PR creation. Merge updates after both platform checks pass. No cross-repository token is required.

The top-level npm tarball is pinned by version and SHA256. The upstream package does not ship an npm lockfile, so transitive dependencies are resolved by npm during installation; this is not a fully locked dependency tree.

To update manually with Node.js 22 or newer:

```sh
node --test scripts/update-formula.test.mjs
node scripts/update-formula.mjs
```

## Validation

The **Tests** workflow installs the formula on macOS and Linux, runs `brew audit --strict`, and tests offline profile listing and switching, including the saved configuration. It does not contact a Tool Bridge gateway.

To validate an installed formula locally:

```sh
brew audit --strict tokenrollai/tap/tool-bridge
brew test tokenrollai/tap/tool-bridge
```

Use `brew test --force tokenrollai/tap/tool-bridge` if the formula was installed with `--skip-link` to avoid an existing `tb` command.

Report packaging problems in [this repository](https://github.com/TokenRollAI/homebrew-tap/issues); report CLI problems in [Tool Bridge](https://github.com/TokenRollAI/tool-bridge/issues).
