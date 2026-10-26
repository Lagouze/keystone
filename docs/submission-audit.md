# Submission audit — 26 October 2026

Scope: the public Lagouze/keystone repository, final navigation PR #38, judge access, documentation, dependency installation, tests and read-only Testnet checks. This is an engineering verification, not a formal security audit or a guarantee of production readiness.

## Executed checks

| Check | Result |
| --- | --- |
| Repository public, default branch main, Git connectivity | PASS |
| Tracked iCloud duplicates, tracked .env/private-key files, files above 3 MB | None found in the audited main tree |
| Existing tracked Stellar-secret/private-key literal scan | No matches before the explicitly authorized jury publication |
| npm ci, Windows Node 24.22.1 / npm 11.19.1 | PASS; npm audit reported zero known vulnerabilities |
| npm run typecheck | PASS, all workspaces |
| npm test | PASS: app 31, keeper 114, shared 16, scripts 13 — 174 total |
| npm run build -w @keystone/app and generated vault-client build | PASS |
| npm run test:browser -w @keystone/app, installed Chrome | PASS: 18 tests, desktop 1440×900 and mobile 390×844; local HTTP/SSE double, external requests blocked |
| cargo test --locked | PASS: 18 tests |
| stellar contract build, CLI 28.1.0 | PASS: six exports, 8,528 bytes, SHA-256 6ca6314db610635008d8a1a6e6b55f69306dd25bb9488a78adb18ef274195b6b, matching deployments/testnet.json |
| Hosted health/config/session/market GET routes | PASS: Testnet backend, Freighter signing, access-token authorization |
| Supplied demo recovery phrase | Derives exactly the published fund address using SEP-0005 m/44'/148'/0'; no private key printed |
| Supplied jury access code | Accepted: an intentionally invalid asset was rejected as BadRequest before sessions.start; no vault/transaction created |

The Windows test previously assumed /proc was unwritable. That is platform-specific; it now tests a path below a temporary file, which cannot be used as a directory on Windows/macOS/Linux. Production keeper behaviour is unchanged. The original failing test may have left an empty C:/proc/definitely/not/writable directory on this audit machine; no unrelated local directory was deleted.

## README requirements

Project summary, problem/user/value, Stellar architecture, public live/demo URLs, installation, environment variables, demo scenarios, real Testnet proofs, prior work/AI/third-party disclosure and limits are covered. Judge access now includes Freighter/Testnet, the deliberately shared demo wallet, expected public address, login, the single jury code shown in the supplied video, a short KBOND scenario and shared-session troubleshooting. Issuer/bank/keeper keys and other access codes are not published. Decision A12 records the explicit human exception.

PR #38 completes Home/Dashboard navigation without changing the vault or server APIs; it was independently reviewed before integration. The final source reaches main through PRs only. Production Vercel status and the public served bundle are checked after the release PR.

## Remaining limits

- The final public video URL was not yet available from the team; the README marks it pending. No URL or submission completion is invented.
- No Stellar transaction was sent during this audit. Historical end-to-end Testnet/Freighter proofs remain in README §6; browser tests here use only a local double.
- Shared Testnet balances and sessions can change while visitors test. The wallet is disposable and its public recovery phrase is not suitable for real assets.
- Build warnings about bundle size and PGlite eval remain; no new dependency vulnerability was reported by npm ci.
- GitHub's current workflow checks PR direction, not the entire test suite. The checks above were run on the audit machine; browser/contract audit guarantees are not implied.
- The contract remains unaudited, with the trustline/freeze and instance-TTL limits already documented in interfaces §3.7.
