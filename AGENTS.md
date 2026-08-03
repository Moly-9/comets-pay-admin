# Repository Instructions

## Scope

This workspace maintains only COMETS Pay on `192.168.88.188:8771`.
Do not modify, restart, inspect secrets from, or deploy into adjacent services or ports.

## Remote Baseline

- SSH user: `mac`
- Remote root: `/Users/mac/Services/muse-pay-8771`
- LaunchDaemon: `system/com.muse-pay-8771`
- Installed plist: `/Library/LaunchDaemons/com.muse-pay-8771.plist`
- Health endpoint: `http://192.168.88.188:8771/health`
- Current local release snapshot: `remote-snapshot/current`

Never write credentials into this repository. Do not echo passwords, tokens, private keys,
banking data, or environment values in user-facing output.

## Current Architecture

The deployed application is a static React 18 build served by a small Node HTTP server.
There is no application backend or database. Authentication, RBAC, registration, password
reset, Feishu login, channel checks, approvals, and payment transitions are client-side
prototype behavior. The remote host does not contain the original Vite source project.

## Change Rules

- Read `PROJECT_CONTEXT.md` at the start of every new task to restore the agreed product,
  engineering, Git, and deployment context.
- Read `SYSTEM_AUDIT.md` before substantial changes.
- Before editing, inspect `git status` and preserve unrelated user changes.
- After editing, report changed files, behavior changes, verification, and the local commit ID.
- Keep each completed user request in a focused local commit unless the user asks not to commit.
- Track maintainable source and release metadata in Git. Keep raw remote snapshots ignored because
  the compiled bundle contains data that must not enter repository history.
- Preserve unrelated remote services and user files.
- Do not manually patch minified bundles except for an explicitly approved emergency fix.
- Prefer rebuilding a maintainable source project and producing a fresh hashed `dist`.
- Before any deployment, capture a timestamped remote backup and verify available disk space.
- Deploy via staging plus atomic directory rename. Never copy files piecemeal into live `dist`.
- Validate `node --check deploy/server.mjs` and `plutil -lint` when those files change.
- Do not restart the LaunchDaemon for a `dist`-only update; restart it only when the server
  entrypoint, plist, environment, or runtime changes.
- After deployment, verify `/health`, `/`, referenced assets, SPA fallback, 404 behavior,
  `launchctl` state, and stderr.

## Production Boundary

Do not describe the current prototype as secure or production-ready. Any real authentication,
PII, bank data, approval, or payout workflow requires a server-side backend, durable database,
server-enforced authorization, audit logging, secret management, TLS, and payment-provider
integration.
