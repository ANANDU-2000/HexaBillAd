# Render + GitHub MCP (Cursor) – setup & benefits

Use **Render MCP** and **GitHub MCP** from Cursor so the AI can manage deployments and repos from the editor.

---

## Saved config (project)

**`.cursor/mcp.json`** in the repo root holds the MCP config with placeholders. Replace the placeholders with your real keys (never commit real keys).

---

## 1. Render MCP

### Config (in `.cursor/mcp.json`)

```json
"render": {
  "url": "https://mcp.render.com/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_RENDER_API_KEY"
  }
}
```

Replace **`YOUR_RENDER_API_KEY`** with the value from **`backend/HexaBill.Api/.env`** → `RENDER_API_KEY`.

### Benefits

- **Debug builds** – Ask the AI to “check Render build logs” or “why did my deploy fail?”; it can use the API to read logs and status.
- **Manage services** – List services, trigger deploys, check health without leaving Cursor.
- **Faster fixes** – AI gets context from Render (errors, logs) and can suggest or apply code changes.
- **No extra cost** – Uses your existing Render API key (free tier has API access).

### After adding

In Cursor, say: **“Set my Render workspace to [your workspace name]”** so the AI knows which account to use.

---

## 2. GitHub MCP (free)

### Setup (free)

1. **Create a GitHub Personal Access Token (PAT)**  
   GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → Generate.  
   Scopes: **`repo`** (and **`workflow`** if you want the AI to manage GitHub Actions).

2. **Config in `.cursor/mcp.json`** (already added with placeholder):

   ```json
   "github": {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-github"],
     "env": {
       "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GITHUB_PAT"
     }
   }
   ```

   Replace **`YOUR_GITHUB_PAT`** with your PAT.  
   (Alternatively you can configure the GitHub MCP in **Cursor Settings → MCP** and paste the same JSON there.)

3. **Restart Cursor** or reload MCP so it picks up the new server.

### Benefits

- **Repo from the editor** – Create repos, push branches, open PRs via chat (“push this to a new branch”, “open a PR”).
- **Issues & PRs** – “List open issues”, “create an issue for this bug”, “summarize this PR”.
- **Code search** – “Search my GitHub for …” without leaving Cursor.
- **Free** – GitHub PAT is free; GitHub MCP server is open source / free to use with Cursor.

---

## 3. Summary

| MCP    | What you need        | Main benefit                          |
|--------|----------------------|----------------------------------------|
| Render | Render API key       | Debug builds, logs, deploy from Cursor |
| GitHub | GitHub PAT (classic) | Repos, issues, PRs, search from Cursor |

Both configs are saved in **`.cursor/mcp.json`** with placeholders. Replace **`YOUR_RENDER_API_KEY`** and **`YOUR_GITHUB_PAT`** with your real values (from `.env` and GitHub). Do not commit real keys; keep them in local env or in Cursor’s MCP settings if you configure there instead.

---

## 4. Test

- **Render:** “List my Render services” or “Show latest deploy logs for HexaBill.”
- **GitHub:** “List my repositories” or “Create a branch from main called fix/docs.”

If Cursor doesn’t pick up `.cursor/mcp.json`, add the same JSON in **Cursor Settings → MCP** and paste your keys there (they stay local).
