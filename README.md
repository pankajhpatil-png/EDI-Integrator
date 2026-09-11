# XML / JSON / EDI Mapping Tool

A visual mapping workbench for building and running XML → JSON → EDI transformations, plus a lightweight orchestration layer (FTP in/out, trading-partner envelope resolution) to run those maps end-to-end.

## Features

- **Mapping canvas** — drag-and-drop field mapping between an XML source, an intermediate JSON structure, and an X12/EDIFACT target, with a chained transform ("ƒx") panel per field.
- **Extended Rules DSL** — string, arithmetic, conditional (`IF..THEN..ELSE..END`), and lookup expressions for field-level transforms, with a full parser/interpreter and validation (not `eval`-based).
- **XML → JSON and JSON → EDI**, both stages on the same canvas component, sharing one mapping model.
- **Named maps** — save/load full mapping sessions against Postgres (Neon), with autosave to `localStorage` in between.
- **Trading Partners module** — manage partners, relationships, and document-type routing; resolve an inbound ISA/UNB envelope to a known relationship.
- **Orchestration Canvas** — build a Start → Input → Map → TradingPartner → Output → End process graph and run it for real (live FTP transfer, live file I/O, live DB lookups — not a dry-run preview).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · `@xyflow/react` (canvas/flow UI) · Neon Postgres (`@neondatabase/serverless`) · `basic-ftp` · `@xmldom/xmldom` (server-side XML parsing)

## Getting started

### Prerequisites
- Node.js 20+
- A Neon Postgres database (or any Postgres instance)

### Setup

```bash
npm install
```

Create a `.env.local` file in the project root with:

```
DATABASE_URL=postgres://...
```

### Run the dev server

```bash
npm run dev
```

> On machines behind a corporate TLS-intercepting proxy, Node's `fetch` can fail against Neon's API with `fetch failed`. The `dev`/`start` scripts already set `NODE_OPTIONS=--use-system-ca` to work around this — no action needed unless you're on a different OS shell.

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

| Command | Purpose |
|---|---|
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the unit test suite (`node --test`, via `tsx`) |

## Project structure

```
src/app/                  Routes: mapping pages, orchestration, partners, API routes
src/components/mapping/   Mapping canvas + transform panel (shared by both stages)
src/lib/rules/            Extended Rules DSL — AST, parser, interpreter
src/lib/mapping/          Mapping types, JSON/EDI value resolution
src/lib/xml/              XML → payload-object conversion (browser + server variants)
src/lib/orchestration/    Process types + execution engine
src/lib/server/           Postgres access (maps, trading partners, processes)
data/inbound/, data/outbound/   Sample folders used by the Orchestration engine's Input/Output nodes
```

## Known limitations

- The Orchestration engine's folder-based Input/Output nodes read/write real files on the local filesystem (`data/inbound`, `data/outbound`, plus `os.tmpdir()` for FTP round-trips). This works when self-hosted or run locally, but **will not persist correctly on serverless platforms like Vercel**, whose functions run on an ephemeral, mostly read-only filesystem. FTP-to-FTP process flows are unaffected; folder-based nodes are not.
- No encryption at rest for stored credentials (e.g. FTP passwords in a process definition, `DATABASE_URL`) — the UI masks password fields, but this is not a security boundary.
- The Orchestration engine currently supports only a single linear Start → End chain (no branching/parallel routing).
