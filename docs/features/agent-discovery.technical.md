# Agent / AI Discovery Endpoints — Technical

Excaliterm advertises itself to AI agents and crawlers through a small set of static files served by the frontend (with help from the Nginx configuration in `apps/frontend/nginx.conf` and `apps/frontend/public/_headers`).

## Endpoints

| Path | Source | Purpose |
|---|---|---|
| `/sitemap.xml` | `apps/frontend/public/sitemap.xml` | Canonical URL list |
| `/robots.txt` | `apps/frontend/public/robots.txt` | Crawl policy; references the sitemap |
| `/.well-known/api-catalog` | Served with `application/linkset+json` | RFC 9727 API catalog pointing at `/docs/api-reference.md` and the REST base URL |
| `/.well-known/mcp/server-card.json` | `apps/frontend/public/.well-known/mcp/server-card.json` | Model Context Protocol server metadata |
| `/.well-known/agent-skills/index.json` | `apps/frontend/public/.well-known/agent-skills/index.json` | Agent skills v0.2.0 index |
| Homepage markdown | `apps/frontend/public/index.md` | Served when `Accept: text/markdown` is negotiated — provides a plain-markdown product description for agents |
| `Link:` headers | `apps/frontend/public/_headers` + `nginx.conf` | RFC 8288 link relations pointing at the discovery endpoints |
| WebMCP | `apps/frontend/src/App.tsx` (navigator.modelContext setup) | Browser-exposed tool surface via `navigator.modelContext` |

## Content negotiation

The homepage is served as HTML by default and as markdown (`index.md`) when the request includes `Accept: text/markdown`. The negotiation is driven by Nginx rules in the production container and matched in development by Vite middleware.

## WebMCP

`App.tsx` registers tools on `navigator.modelContext` when the browser supports WebMCP. Registered tools mirror key product actions (create terminal, list terminals, send chat message, etc.), giving in-browser AI agents direct programmatic access that the user is already authenticated for.

## Editing / adding endpoints

When adding or editing a discovery file:

1. Drop the static file into `apps/frontend/public/...` — Vite and Nginx both serve `public/` as-is.
2. If the file must be served with a specific `Content-Type` or `Link` header, update `apps/frontend/nginx.conf` and `apps/frontend/public/_headers`.
3. Register WebMCP tools from `apps/frontend/src/App.tsx`.
4. Keep the feature list in the README's *Agent Discovery* table in sync.

## Key files

- `apps/frontend/public/sitemap.xml`
- `apps/frontend/public/robots.txt`
- `apps/frontend/public/index.md`
- `apps/frontend/public/.well-known/mcp/server-card.json`
- `apps/frontend/public/.well-known/agent-skills/index.json`
- `apps/frontend/public/_headers`
- `apps/frontend/nginx.conf`
- `apps/frontend/src/App.tsx` (WebMCP registration)
