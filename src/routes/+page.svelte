<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import {
    Activity,
    Database,
    Footprints,
    HeartPulse,
    Moon,
    RefreshCw,
    ShieldCheck,
    UploadCloud,
    Wind,
    Zap
  } from '@lucide/svelte';
  import Histogram from '$lib/components/Histogram.svelte';
  import InsightPanel from '$lib/components/InsightPanel.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import StackedBars from '$lib/components/StackedBars.svelte';
  import demoSummary from '$lib/data/demo-summary.json';
  import type { DailyMetric, OuraSummary, SectionKey } from '$lib/oura/types';

  type ChartSeries = {
    label: string;
    color: string;
    values: Array<{ x: string; y: number | null | undefined }>;
  };

  type ErrorPayload = {
    error?: string;
  };

  type UploadPayload = ErrorPayload & {
    userId?: string;
    uploadId?: string;
    summary?: OuraSummary;
  };

  const sections: Array<{ key: SectionKey; label: string; icon: typeof Moon; color: string }> = [
    { key: 'sleep', label: 'Sleep', icon: Moon, color: '#2563eb' },
    { key: 'heart', label: 'Heart', icon: HeartPulse, color: '#e11d48' },
    { key: 'activity', label: 'Activity', icon: Footprints, color: '#0f9f6e' },
    { key: 'stress', label: 'Stress', icon: Zap, color: '#b45309' },
    { key: 'oxygen', label: 'Oxygen', icon: Wind, color: '#0891b2' }
  ];

  const chartColors = {
    blue: '#2563eb',
    cyan: '#0891b2',
    green: '#0f9f6e',
    amber: '#b45309',
    rose: '#e11d48',
    violet: '#7c3aed',
    gray: '#64748b',
    ink: '#111827'
  };

  let summary: OuraSummary = demoSummary as OuraSummary;
  let activeSection: SectionKey = 'sleep';
  let uploadState: 'idle' | 'uploading' | 'done' | 'error' = 'idle';
  let uploadMessage = 'Demo export loaded';
  let storedUserId = '';
  let storedUploadId = '';
  let fileInput: HTMLInputElement;

  onMount(async () => {
    storedUserId = localStorage.getItem('openoura:userId') ?? '';
    storedUploadId = localStorage.getItem('openoura:uploadId') ?? '';

    if (storedUserId && storedUploadId) {
      await loadStoredDataset();
    }
  });

  $: daily = summary.daily;
  $: averages = summary.averages;
  $: currentSection = sections.find((section) => section.key === activeSection) ?? sections[0];
  $: storagePath = summary.storage
    ? `r2://${summary.storage.rawZipKey.replace('/data.zip', '/')}`
    : 'demo:data.zip summary';

  $: sleepDurationSeries = [
    seriesFor('totalSleepHours', 'Sleep', chartColors.blue),
    seriesFor('timeInBedHours', 'In bed', chartColors.gray)
  ];
  $: sleepTimingSeries = [
    seriesFor('bedtimeStartHour', 'Bedtime', chartColors.violet),
    seriesFor('wakeTimeHour', 'Wake', chartColors.amber)
  ];
  $: sleepStageRows = daily.map((day) => ({
    x: shortDate(day.day),
    parts: [
      { label: 'Deep', value: day.deepSleepHours, color: chartColors.blue },
      { label: 'REM', value: day.remSleepHours, color: chartColors.violet },
      { label: 'Awake', value: day.awakeHours, color: chartColors.amber }
    ]
  }));

  $: heartSeries = [
    seriesFor('averageHeartRate', 'Night avg HR', chartColors.rose),
    seriesFor('lowestHeartRate', 'Night low HR', chartColors.gray)
  ];
  $: hrvSeries = [seriesFor('averageHrv', 'HRV', chartColors.blue)];
  $: daytimeHeartSeries = [
    seriesFor('awakeHeartRate', 'Awake HR', chartColors.cyan),
    seriesFor('workoutHeartRate', 'Workout HR', chartColors.rose),
    seriesFor('restHeartRate', 'Rest HR', chartColors.green)
  ];
  $: cardioSeries = [
    seriesFor('vascularAge', 'Vascular age', chartColors.amber),
    seriesFor('vo2Max', 'VO2 max', chartColors.green)
  ];

  $: stepSeries = [
    seriesFor('steps', 'Steps', chartColors.green),
    rollingSeries('steps', '7-day avg', chartColors.ink)
  ];
  $: calorieSeries = [
    seriesFor('activeCalories', 'Active calories', chartColors.green),
    seriesFor('totalCalories', 'Total calories', chartColors.amber)
  ];
  $: activityRows = daily.map((day) => ({
    x: shortDate(day.day),
    parts: [
      { label: 'Low', value: day.lowActivityHours, color: '#9ac6a4' },
      { label: 'Medium', value: day.mediumActivityHours, color: chartColors.green },
      { label: 'High', value: day.highActivityHours, color: chartColors.rose },
      { label: 'Sedentary', value: day.sedentaryHours, color: '#cbd5e1' }
    ]
  }));

  $: stressSeries = [
    seriesFor('stressHighHours', 'Stress', chartColors.rose),
    seriesFor('recoveryHighHours', 'Recovery', chartColors.green)
  ];
  $: stressRows = daily.map((day) => ({
    x: shortDate(day.day),
    parts: [
      { label: 'Stress', value: day.stressHighHours, color: chartColors.rose },
      { label: 'Recovery', value: day.recoveryHighHours, color: chartColors.green }
    ]
  }));

  $: oxygenSeries = [
    seriesFor('spo2', 'SpO2', chartColors.cyan),
    seriesFor('breathingDisturbanceIndex', 'BDI', chartColors.amber)
  ];
  $: breathSeries = [seriesFor('averageBreath', 'Breath rate', chartColors.cyan)];

  async function loadStoredDataset() {
    if (!storedUserId || !storedUploadId) return;

    try {
      uploadState = 'uploading';
      uploadMessage = 'Loading stored export';
      const response = await fetch(`/api/dataset?userId=${storedUserId}&uploadId=${storedUploadId}`);
      const payload = (await response.json()) as ErrorPayload & Partial<OuraSummary>;
      if (!response.ok) throw new Error(payload.error ?? 'Dataset could not be loaded.');
      summary = payload as OuraSummary;
      uploadState = 'done';
      uploadMessage = 'Stored export loaded';
    } catch (error) {
      uploadState = 'error';
      uploadMessage = error instanceof Error ? error.message : 'Stored export could not be loaded.';
    }
  }

  async function uploadFile(file: File | null | undefined) {
    if (!file) return;
    uploadState = 'uploading';
    uploadMessage = 'Parsing export';

    const form = new FormData();
    form.append('file', file);
    if (storedUserId) form.append('userId', storedUserId);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: form });
      const payload = (await response.json()) as UploadPayload;
      if (!response.ok) throw new Error(payload.error ?? 'Upload failed.');
      if (!payload.summary || !payload.userId || !payload.uploadId) {
        throw new Error('Upload response was incomplete.');
      }

      summary = payload.summary;
      storedUserId = payload.userId;
      storedUploadId = payload.uploadId;

      if (browser) {
        localStorage.setItem('openoura:userId', storedUserId);
        localStorage.setItem('openoura:uploadId', storedUploadId);
      }

      uploadState = 'done';
      uploadMessage = 'Export stored in R2';
    } catch (error) {
      uploadState = 'error';
      uploadMessage = error instanceof Error ? error.message : 'Upload failed.';
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  function resetDemo() {
    summary = demoSummary as OuraSummary;
    uploadState = 'idle';
    uploadMessage = 'Demo export loaded';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    void uploadFile(event.dataTransfer?.files?.[0]);
  }

  function seriesFor(key: keyof DailyMetric, label: string, color: string): ChartSeries {
    return {
      label,
      color,
      values: daily.map((day) => ({
        x: day.day,
        y: numeric(day[key])
      }))
    };
  }

  function rollingSeries(key: keyof DailyMetric, label: string, color: string, windowSize = 7): ChartSeries {
    return {
      label,
      color,
      values: daily.map((day, index) => ({
        x: day.day,
        y: average(
          daily
            .slice(Math.max(0, index - windowSize + 1), index + 1)
            .map((entry) => numeric(entry[key]))
        )
      }))
    };
  }

  function numeric(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function average(values: Array<number | null>) {
    const valid = values.filter((value): value is number => value !== null);
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function shortDate(day: string) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${day}T00:00:00`));
  }

  function compactDate(day: string) {
    return shortDate(day);
  }

  function clockLabel(value: number) {
    const normalized = ((value % 24) + 24) % 24;
    const hour = Math.floor(normalized);
    const minute = Math.round((normalized - hour) * 60);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
  }

  function numberLabel(value: number | null | undefined, digits = 0) {
    if (value === null || value === undefined) return 'n/a';
    return value.toLocaleString('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function durationLabel(value: number | null | undefined) {
    if (value === null || value === undefined) return 'n/a';
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
</script>

<svelte:head>
  <title>OpenOura</title>
</svelte:head>

<main class="app-shell">
  <aside class="rail">
    <div class="brand">
      <div class="mark"><Activity size={20} strokeWidth={2.4} /></div>
      <div>
        <strong>OpenOura</strong>
        <span>{summary.range.days} days</span>
      </div>
    </div>

    <nav aria-label="Health sections">
      {#each sections as section}
        <button
          type="button"
          class:active={activeSection === section.key}
          style={`--section-color: ${section.color}`}
          title={section.label}
          on:click={() => (activeSection = section.key)}
        >
          <svelte:component this={section.icon} size={18} strokeWidth={2.2} />
          <span>{section.label}</span>
        </button>
      {/each}
    </nav>

    <div class="rail-meta">
      <ShieldCheck size={18} />
      <span>Location CSV ignored for charts</span>
    </div>
  </aside>

  <section class="workspace">
    <header class="topbar">
      <div>
        <p class="eyebrow">Oura Ring CSV export</p>
        <h1>{currentSection.label} dashboard</h1>
        <p class="range">{summary.range.start ? compactDate(summary.range.start) : 'n/a'} to {summary.range.end ? compactDate(summary.range.end) : 'n/a'}</p>
      </div>

      <div class="actions">
        <button type="button" class="icon-button" title="Reset to demo data" on:click={resetDemo}>
          <RefreshCw size={18} />
        </button>
        <button type="button" class="upload-button" on:click={() => fileInput.click()} disabled={uploadState === 'uploading'}>
          <UploadCloud size={18} />
          <span>{uploadState === 'uploading' ? 'Uploading' : 'Upload data.zip'}</span>
        </button>
        <input
          bind:this={fileInput}
          class="visually-hidden"
          type="file"
          accept=".zip,application/zip"
          on:change={(event) => uploadFile((event.currentTarget as HTMLInputElement).files?.[0])}
        />
      </div>
    </header>

    <button
      class="status-band"
      type="button"
      aria-label="Drop or choose Oura data zip"
      on:click={() => fileInput.click()}
      on:dragover|preventDefault
      on:drop={handleDrop}
    >
      <span class="status-copy">
        <Database size={18} />
        <span>{storagePath}</span>
      </span>
      <strong class:error={uploadState === 'error'}>{uploadMessage}</strong>
    </button>

    <section class="metric-grid" aria-label="Summary metrics">
      <MetricCard label="Sleep score" value={numberLabel(averages.sleepScore, 0)} detail={`${durationLabel(averages.totalSleepHours)} avg sleep`} accent={chartColors.blue} />
      <MetricCard label="Readiness" value={numberLabel(averages.readinessScore, 0)} detail={`${numberLabel(averages.averageHrv, 0)} ms avg HRV`} accent={chartColors.violet} />
      <MetricCard label="Night HR" value={`${numberLabel(averages.averageHeartRate, 1)} bpm`} detail={`${numberLabel(averages.lowestHeartRate, 1)} bpm avg nightly low`} accent={chartColors.rose} />
      <MetricCard label="Steps" value={numberLabel(averages.steps, 0)} detail={`${numberLabel(averages.activeCalories, 0)} active kcal/day`} accent={chartColors.green} />
      <MetricCard label="Stress high" value={durationLabel(averages.stressHighHours)} detail={`${durationLabel(averages.recoveryHighHours)} high recovery`} accent={chartColors.amber} />
      <MetricCard label="SpO2" value={`${numberLabel(averages.spo2, 1)}%`} detail={`${numberLabel(averages.breathingDisturbanceIndex, 1)} disturbance index`} accent={chartColors.cyan} />
    </section>

    <section class="section-shell" style={`--active-color: ${currentSection.color}`}>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Five-lens quantified self view</p>
          <h2>{currentSection.label}</h2>
        </div>
        <div class="pill-row">
          <span>{summary.counts.sleepNights} nights</span>
          <span>{summary.counts.heartRateSamples.toLocaleString()} HR samples</span>
          <span>{summary.counts.daytimeStressSamples.toLocaleString()} stress samples</span>
        </div>
      </div>

      {#if activeSection === 'sleep'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Sleep duration and time in bed" series={sleepDurationSeries} yFormatter={(value) => `${value.toFixed(1)}h`} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <LineChart title="Bedtime and wake time" series={sleepTimingSeries} yFormatter={clockLabel} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <StackedBars title="Deep, REM, and awake time" rows={sleepStageRows} unit="h" />
          </div>
          <InsightPanel title="Sleep readout" insights={summary.insights.sleep} />
        </div>
      {:else if activeSection === 'heart'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Sleeping heart rate" series={heartSeries} yFormatter={(value) => `${value.toFixed(0)} bpm`} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <LineChart title="Nightly HRV" series={hrvSeries} yFormatter={(value) => `${value.toFixed(0)} ms`} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <Histogram title="Sleep HR distribution" bins={summary.distributions.sleepHeartRate} color={chartColors.rose} unit=" bpm" />
          </div>
          <div class="panel">
            <Histogram title="Sleep HRV distribution" bins={summary.distributions.sleepHrv} color={chartColors.blue} unit=" ms" />
          </div>
          <div class="panel wide">
            <LineChart title="Awake, workout, and rest HR" series={daytimeHeartSeries} yFormatter={(value) => `${value.toFixed(0)} bpm`} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <LineChart title="Cardio anchors" series={cardioSeries} yFormatter={(value) => value.toFixed(0)} xFormatter={compactDate} />
          </div>
          <InsightPanel title="Heart readout" insights={summary.insights.heart} />
        </div>
      {:else if activeSection === 'activity'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Steps with 7-day average" series={stepSeries} yFormatter={(value) => value.toLocaleString()} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <LineChart title="Calories" series={calorieSeries} yFormatter={(value) => value.toFixed(0)} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel wide">
            <StackedBars title="Activity time breakdown" rows={activityRows} unit="h" />
          </div>
          <InsightPanel title="Activity readout" insights={summary.insights.activity} />
        </div>
      {:else if activeSection === 'stress'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Stress and recovery time" series={stressSeries} yFormatter={(value) => `${value.toFixed(1)}h`} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <StackedBars title="Daily time in state" rows={stressRows} unit="h" />
          </div>
          <div class="panel">
            <Histogram title="Daytime stress score distribution" bins={summary.distributions.daytimeStress} color={chartColors.amber} />
          </div>
          <InsightPanel title="Stress readout" insights={summary.insights.stress} />
        </div>
      {:else}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="SpO2 and breathing disturbance" series={oxygenSeries} yFormatter={(value) => value.toFixed(1)} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <LineChart title="Breathing rate during sleep" series={breathSeries} yFormatter={(value) => `${value.toFixed(1)}/min`} xFormatter={compactDate} />
          </div>
          <InsightPanel title="Oxygen readout" insights={summary.insights.oxygen} />
        </div>
      {/if}
    </section>

    <footer class="footnotes">
      <span>Inspired by Aleksa Gordic's Oura analysis categories and live dashboard structure.</span>
      <span>{summary.privacyNotes[2]}</span>
    </footer>
  </section>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    background: #f4f6f8;
    color: #161a21;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    margin: 0;
  }

  :global(button),
  :global(input) {
    font: inherit;
  }

  .app-shell {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    min-height: 100vh;
  }

  .rail {
    background: #11110f;
    color: #f9fafb;
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
    padding: 20px 16px;
    position: sticky;
    top: 0;
  }

  .brand {
    align-items: center;
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  .brand strong,
  .brand span {
    display: block;
  }

  .brand strong {
    font-size: 1rem;
  }

  .brand span {
    color: #a8b0bd;
    font-size: 0.82rem;
    margin-top: 2px;
  }

  .mark {
    align-items: center;
    background: #f9fafb;
    border-radius: 8px;
    color: #11110f;
    display: grid;
    flex: 0 0 auto;
    height: 38px;
    justify-items: center;
    width: 38px;
  }

  nav {
    align-content: start;
    display: grid;
    gap: 8px;
    margin-top: 30px;
  }

  nav button {
    align-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #cbd3df;
    cursor: pointer;
    display: grid;
    gap: 10px;
    grid-template-columns: 22px 1fr;
    min-height: 42px;
    padding: 9px 10px;
    text-align: left;
  }

  nav button:hover,
  nav button.active {
    background: color-mix(in srgb, var(--section-color), #11110f 78%);
    border-color: color-mix(in srgb, var(--section-color), #ffffff 30%);
    color: #ffffff;
  }

  .rail-meta {
    align-items: center;
    border-top: 1px solid #2b2d32;
    color: #a8b0bd;
    display: flex;
    font-size: 0.82rem;
    gap: 10px;
    line-height: 1.35;
    padding-top: 18px;
  }

  .workspace {
    min-width: 0;
    padding: 22px;
  }

  .topbar {
    align-items: start;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 1420px;
  }

  .eyebrow {
    color: #697386;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0;
    margin: 0 0 7px;
    text-transform: uppercase;
  }

  h1,
  h2 {
    letter-spacing: 0;
    margin: 0;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 4.2rem);
    line-height: 0.96;
  }

  h2 {
    font-size: clamp(1.45rem, 2.6vw, 2.4rem);
  }

  .range {
    color: #596171;
    font-size: 0.95rem;
    margin: 10px 0 0;
  }

  .actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }

  .icon-button,
  .upload-button {
    align-items: center;
    border: 1px solid #d5dbe5;
    border-radius: 8px;
    cursor: pointer;
    display: inline-flex;
    font-weight: 760;
    gap: 8px;
    min-height: 42px;
  }

  .icon-button {
    background: #ffffff;
    color: #1f2937;
    justify-content: center;
    width: 42px;
  }

  .upload-button {
    background: #111827;
    color: #ffffff;
    padding: 0 14px;
  }

  .upload-button:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  .visually-hidden {
    height: 1px;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    position: absolute;
    width: 1px;
  }

  .status-band {
    align-items: center;
    background: #ffffff;
    border: 1px dashed #cbd3df;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin: 18px auto 0;
    max-width: 1420px;
    min-height: 48px;
    padding: 10px 13px;
    text-align: left;
    width: 100%;
  }

  .status-band:focus-visible {
    outline: 3px solid #93c5fd;
    outline-offset: 2px;
  }

  .status-copy {
    align-items: center;
    color: #3f4755;
    display: flex;
    font-size: 0.86rem;
    gap: 8px;
    min-width: 0;
  }

  .status-band span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-band strong {
    color: #0f766e;
    flex: 0 0 auto;
    font-size: 0.86rem;
  }

  .status-band strong.error {
    color: #be123c;
  }

  .metric-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    margin: 18px auto 0;
    max-width: 1420px;
  }

  .section-shell {
    background: #ffffff;
    border: 1px solid #dfe5ee;
    border-radius: 8px;
    margin: 18px auto 0;
    max-width: 1420px;
    padding: 18px;
  }

  .section-heading {
    align-items: end;
    border-bottom: 1px solid #e6ebf2;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    padding-bottom: 16px;
  }

  .section-heading h2 {
    color: var(--active-color);
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .pill-row span {
    background: #f2f5f8;
    border: 1px solid #e2e7ee;
    border-radius: 999px;
    color: #4c5665;
    font-size: 0.78rem;
    font-weight: 720;
    padding: 7px 10px;
  }

  .content-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
    margin-top: 16px;
  }

  .panel,
  .content-grid :global(.insight-panel) {
    min-width: 0;
  }

  .panel {
    border: 1px solid #e4e9f1;
    border-radius: 8px;
    padding: 14px;
  }

  .wide {
    grid-column: span 1;
  }

  .content-grid > :global(.insight-panel) {
    grid-row: span 3;
  }

  .footnotes {
    color: #6b7280;
    display: flex;
    flex-wrap: wrap;
    font-size: 0.82rem;
    gap: 8px 18px;
    justify-content: space-between;
    margin: 14px auto 0;
    max-width: 1420px;
  }

  @media (max-width: 1180px) {
    .metric-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .content-grid {
      grid-template-columns: 1fr;
    }

    .content-grid > :global(.insight-panel) {
      grid-row: auto;
    }
  }

  @media (max-width: 860px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    .rail {
      min-height: auto;
      position: static;
    }

    nav {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin-top: 18px;
    }

    nav button {
      gap: 6px;
      grid-template-columns: 1fr;
      justify-items: center;
      min-height: 58px;
      padding: 8px 5px;
      text-align: center;
    }

    nav button span {
      font-size: 0.72rem;
    }

    .rail-meta {
      margin-top: 16px;
    }

    .workspace {
      padding: 16px;
    }

    .topbar,
    .section-heading,
    .status-band {
      align-items: stretch;
      flex-direction: column;
    }

    .actions,
    .pill-row {
      justify-content: flex-start;
    }

    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .metric-grid {
      grid-template-columns: 1fr;
    }

    h1 {
      font-size: 2.15rem;
    }

    .section-shell {
      padding: 14px;
    }
  }
</style>
