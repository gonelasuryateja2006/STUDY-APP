# SESSION-SCHEDULAR Smart Study Planner

SESSION-SCHEDULAR is a responsive React + TypeScript study planner prototype for a CSE portfolio project. It includes a dashboard, session logbook, subject breakdowns, goal progress, Pomodoro timer, statistics, calendar, suggestions, achievements, profile, light/dark mode, local persistence, and CSV export.

## Run

```bash
npm install
npm run dev
```

The API can be started in a second terminal with `npm run api`; it listens on `http://localhost:4000`. The API supports authentication, profile, session, subject, and AI agent routes. Copy `.env.example` to `.env` and set `JWT_SECRET` plus `AI_API_KEY` to enable real AI responses. Without an AI key, the browser keeps its local study guidance fallback.

For a production check:

```bash
npm run build
npm run preview
```

## Project Structure

- `src/App.tsx`: application state, domain types, navigation, views, and workflows.
- `backend/server.ts`: authenticated Express API with hashed passwords and persisted user data.
- `.env.example`: backend and OpenAI-compatible AI provider configuration.
- `src/App.css`: responsive visual system and light/dark themes.
- `public/manifest.webmanifest`: install metadata for supported browsers.

The browser demo persists locally in `localStorage`. Authenticated accounts persist users, profiles, goals, sessions, and subjects in `backend/session-schedular.sqlite`; the API enforces ownership with JWT middleware and user-scoped SQL queries. The starter data is intentionally removable through the session delete controls.

## OOP Mapping

The TypeScript domain types represent the original C++ concepts: `Session` stores study information, `Subject` groups related work, and the page components act as focused services around those objects. Encapsulation is represented by component state and event handlers; persistence is isolated behind `localStorage`; collections are represented by typed arrays and derived aggregates such as subject totals. A production backend can lift these same types into `User`, `Student`, `StudySession`, and polymorphic `Suggestion` service classes backed by SQLite.

## Scope Note

The application includes a local Express/SQLite service for development. Before public deployment, set a strong `JWT_SECRET`, configure HTTPS, add rate limiting, and provide a real AI provider key through the server environment only.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
