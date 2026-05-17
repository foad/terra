# Testing

## Backend

```bash
cd backend
uv sync --extra dev
```

```bash
uv run pytest
uv run pytest --cov=src --cov-report=term-missing   # with coverage
```

## Frontend E2E

```bash
cd frontend
npm install
npx playwright install chromium
```

```bash
npm run test:e2e
```

E2E tests run against the `preview` server by default (`dev` server skips service worker), to use a different target set `E2E_BASE_URL`.