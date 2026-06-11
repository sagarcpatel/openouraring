# OpenOura

OpenOura is a SvelteKit dashboard for Oura Ring export ZIPs. It runs on Cloudflare Workers, stores uploaded exports in R2, and serves a normalized summary JSON for the dashboard.

## What It Visualizes

- Sleep duration, time in bed, bedtime/wake timing, deep sleep, REM, latency, and sleep score.
- Night heart rate, nightly low heart rate, HRV, awake/workout/rest heart-rate distributions, vascular age, pulse-wave velocity, and VO2 max.
- Steps, calories, and activity-time breakdowns.
- Daily stress/recovery time and daytime stress-score distribution.
- SpO2, breathing disturbance index, and sleep breathing rate.

The default dashboard uses `src/lib/data/demo-summary.json`, generated from the provided `data.zip`. The parser ignores raw location and subscription CSVs for chart analysis.

## Cloudflare Storage Model

Uploads are stored in R2 under a per-user path:

```text
users/{userId}/exports/{uploadId}/data.zip
users/{userId}/exports/{uploadId}/summary.json
users/{userId}/index.json
```

The browser remembers `userId` and `uploadId` in local storage. There is no authentication layer in this prototype, so add auth before using it for production health data.

## Local Development

```bash
npm install
npm run dev
```

The dev server defaults to [http://localhost:5173](http://localhost:5173).

## Cloudflare Setup

Create the R2 bucket named in `wrangler.jsonc`:

```bash
wrangler r2 bucket create openoura-data
```

Generate binding types when your local Wrangler environment has permission to write its logs:

```bash
npm run types
```

Build and deploy:

```bash
npm run build
npm run deploy
```

## Regenerate Demo Data

If you replace `data.zip`, regenerate the bundled demo summary:

```bash
npm run data:build
```
