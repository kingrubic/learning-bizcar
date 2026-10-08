# Agent notes (Cursor Cloud / Background Agents)

This repo ships **project** Cursor helpers under `.cursor/` so Cloud Agents (which do **not** see your Mac Mini `~/.cursor`) still get useful context.

## What is committed vs local-only

| Artifact | Commit? | Why |
|----------|---------|-----|
| `.cursor/rules/graphify.mdc` | yes | Soft graph-first guidance |
| `.cursor/rules/ponytail.mdc` | yes | Simplest-diff coding style (rule-only; no hooks) |
| `.cursor/skills/defuddle/` | yes | Token-saving web→markdown |
| `.cursor/mcp.json` (CodeGraph) | yes (optional) | Project MCP hint; **Cloud Agents still need the same server enabled in [cursor.com/agents](https://cursor.com/agents) MCP dropdown** — project `mcp.json` is not a reliable cloud-only config surface |
| `.codegraph/` | **no** (gitignored) | Rebuild per VM; LVT-scale indexes are tens of MB |
| `graphify-out/` | **no** (gitignored) | Rebuild with `graphify update .` when needed |

## CodeGraph (preferred structural navigation when MCP is live)

1. Ensure index exists (idempotent):

```bash
npx -y @colbymchenry/codegraph init -y
```

2. Prefer MCP tools `codegraph_explore` / related once the server is connected.
3. If MCP is **not** available in this Cloud Agent session (common until dashboard MCP is enabled), fall back to CLI:

```bash
npx -y @colbymchenry/codegraph explore "<question>"
npx -y @colbymchenry/codegraph context "<task>"
```

Do **not** commit `.codegraph/`.

## Graphify (file-based graph; no MCP required)

When `graphify-out/graph.json` exists, prefer `graphify query|path|explain` (see `.cursor/rules/graphify.mdc`).
Otherwise build once if the CLI is present:

```bash
# install once per VM if needed
uv tool install graphifyy   # or: pipx install graphifyy
graphify update .
```

If install is too heavy for the task, skip and use normal search — do not block.

## Ponytail

Always-on via `.cursor/rules/ponytail.mdc`. Cloud does not get Mac Mini `hooks.json` mode switching; the rule text is enough.

## Defuddle

For reading web docs, prefer `/defuddle` skill or `npx -y defuddle parse <url> --md` over dumping raw HTML.

## Quy trình thay đổi code → deploy

Áp dụng cho mọi thay đổi code (agent làm theo, không cần hỏi lại từng bước; chỉ báo user khi cần duyệt quyền).

1. **Nhánh:** không commit thẳng vào `main`. Tạo nhánh `feat/…`, `fix/…`, `chore/…` hoặc `docs/…`.
2. **Kiểm tra trước khi commit:** `npx tsc --noEmit -p .`; chạy các `*.check.ts` liên quan (`node lib/<tên>.check.ts`). Đổi trong `convex/` thì chạy lại codegen và commit cả `convex/_generated/`.
3. **Commit + PR:** commit message và PR viết tiếng Việt, ngắn gọn. `git push -u origin <nhánh>` rồi `gh pr create --base main`.
4. **CI:** bật Auto-fix cho PR (CI hỏng / xung đột / review → sửa, kiểm tra, push lại).
5. **Merge:** khi CI pass, `gh pr merge <số> --squash --delete-branch`. User đã cho phép merge.
6. **Deploy** (production chạy trên máy này, Mac Mini):
   ```bash
   git switch main && git pull --ff-only
   npx convex deploy            # chỉ khi PR đổi thư mục convex/ (Convex cloud, dùng CONVEX_DEPLOY_KEY trong .env.local)
   npm run build
   launchctl kickstart -k gui/$(id -u)/ai.vabix.bizcar.learning.web
   ```
   Web là launchd `ai.vabix.bizcar.learning.web` → `scripts/start.sh` → `next start` tại `127.0.0.1:3014`. Log: `~/ops/logs/ai.vabix.bizcar.learning.web{,.err}.log`.
7. **Xác minh:** `curl -sI http://127.0.0.1:3014/learn/login` trả 200, log lỗi không có dòng mới. Hỏng thì quay lại commit trước trên `main`, build và kickstart lại.
