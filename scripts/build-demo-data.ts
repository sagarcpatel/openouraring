import { readFile, writeFile } from 'node:fs/promises';
import { parseOuraZip } from '../src/lib/oura/parse';

const zip = await readFile('data.zip');
const summary = await parseOuraZip(zip, { sourceName: 'data.zip demo export' });

await writeFile('src/lib/data/demo-summary.json', `${JSON.stringify(summary, null, 2)}\n`);

console.log(
  `Wrote demo summary for ${summary.range.days} days, ${summary.counts.sleepNights} sleep nights, ${summary.counts.heartRateSamples} heart-rate samples.`
);
