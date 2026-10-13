# Security Policy

Block52 Poker Desktop handles wallet keys and signs transactions, so we take security reports seriously.

## Supported versions

Only the latest release receives security fixes. Please update before reporting.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting: go to the repository's **Security** tab and choose **Report a vulnerability**.
Include:

- what you found and the impact (for example: key exposure, wrong-amount signing, fund redirection),
- the app version and operating system,
- steps to reproduce, or a proof of concept.

You can expect an acknowledgement within a few days. Please give us reasonable time to fix the issue before
disclosing it publicly.

## Scope

In scope: this desktop application (the Electron main process, preload bridge, renderer code, wallet and signing
logic, build and release workflows).

Out of scope: the Block52 chain, bridge contracts, indexer and payment proxy (report those to the Block52 team
directly), and attacks that require a compromised operating system or physical access to an unlocked machine.

## Good to know

- The wallet seed phrase is encrypted at rest with the OS secure storage (optionally also with a password) and signing
  runs in the main process. Without a password, any process running as your user can still ask the OS keychain for
  the key, which is a limit of OS storage rather than of this app. On Linux without a keyring the phrase is only
  obfuscated.
- Release installers are not yet code-signed.
