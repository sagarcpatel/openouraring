# OpenOura

OpenOura is a SvelteKit dashboard for Oura Ring export ZIPs. It parses exports in the browser and stores the normalized dashboard summary in local browser storage.

## What It Visualizes

- Sleep duration, time in bed, bedtime/wake timing, deep sleep, REM, latency, and sleep score.
- Night heart rate, nightly low heart rate, HRV, awake/workout/rest heart-rate distributions, vascular age, pulse-wave velocity, and VO2 max.
- Steps, calories, and activity-time breakdowns.
- Daily stress/recovery time and daytime stress-score distribution.
- SpO2, breathing disturbance index, and sleep breathing rate.

The dashboard stays empty until a local Oura export is selected. The parser ignores raw location and subscription CSVs for chart analysis.

## Browser Storage Model

Uploaded ZIP files are read with browser APIs and parsed locally with `jszip` and `papaparse`. The raw ZIP is not sent to the server and is not persisted by the app. The normalized `OuraSummary` used by the charts is saved in IndexedDB, and localStorage keeps only the id of the current dataset.

## Local Development

```bash
npm install
npm run dev
```

The dev server defaults to [http://localhost:5173](http://localhost:5173).

## Cloudflare Setup

Generate binding types when your local Wrangler environment has permission to write its logs:

```bash
npm run types
```

Build and deploy:

```bash
npm run build
npm run deploy
```

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/exosai/openouraring)
