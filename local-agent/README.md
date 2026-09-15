# ORBIT Local Agent (v0.1.0)

Independent sandboxed Windows Local Agent for ORBIT AI.

## Security Features & Architecture
- **Transport**: WebSocket client/server via `ws`
- **Pairing**: 5-minute single-use code + opaque device token rotation
- **Permission Model**:
  - **Level 1 (Auto)**: `read_file`, `list_dir`, `git_status`, `git_diff`, `git_log`, `git_branches`, `get_system_info`, `list_workspaces`, `heartbeat`, `open_app`, `open_url`
  - **Level 2 (Requires Approval)**: `run_project_command` (Whitelisted: `npm run build`, `npm run test`, `npm run lint`, `npm run typecheck`)
- **Workspace Security**: Path containment enforced via `path.resolve()` → `path.relative()` → `realpath()` against `ORBIT_ALLOWED_WORKSPACES`
- **Audit Logging**: Structured JSONL at `%APPDATA%\orbit\local-agent\logs\audit.jsonl` (Secrets, credentials, passwords & file contents are never logged)

## Running the Agent
```bash
# Build
npm run build

# Run tests
npm run test
```
