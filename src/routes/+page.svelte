<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import {
    Activity,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    CircleQuestionMark,
    Database,
    Footprints,
    GitFork,
    HeartPulse,
    Info,
    Moon,
    Trash2,
    UploadCloud,
    Wind,
    X,
    Zap
  } from '@lucide/svelte';
  import DailyScoreRing from '$lib/components/DailyScoreRing.svelte';
  import Histogram from '$lib/components/Histogram.svelte';
  import InsightPanel from '$lib/components/InsightPanel.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import MetricCard from '$lib/components/MetricCard.svelte';
  import StateHeatmap from '$lib/components/StateHeatmap.svelte';
  import {
    clearCurrentDatasetId,
    deleteLocalDataset,
    getCurrentDatasetId,
    loadLocalDataset,
    saveLocalDataset,
    setCurrentDatasetId
  } from '$lib/oura/browser-storage';
  import { parseOuraZip } from '$lib/oura/parse';
  import type { DailyMetric, OuraSummary, SectionKey } from '$lib/oura/types';

  type ChartSeries = {
    averageCallout?: {
      label: string;
      value: string;
    };
    label: string;
    color: string;
    values: Array<{ x: string; y: number | null | undefined }>;
    opacity?: number;
    pointOpacity?: number;
    pointRadius?: number;
    showInLegend?: boolean;
    showPoints?: 'always' | 'hover' | false;
    strokeDasharray?: string;
    strokeWidth?: number;
    tooltipOnly?: boolean;
  };

  type DashboardMode = 'overtime' | 'daily';

  type DailyScoreSummary = {
    label: string;
    value: number | null | undefined;
    detail: string;
    accent: string;
  };

  type DailyDetailItem = {
    label: string;
    value: string;
    detail: string;
    accent: string;
  };

  type DailyDetailGroup = {
    title: string;
    eyebrow: string;
    items: DailyDetailItem[];
  };

  type DailyStageItem = {
    label: string;
    value: string;
    detail: string;
    accent: string;
    percent: number;
  };

  const MAX_UPLOAD_BYTES = 75 * 1024 * 1024;
  const chartDataKeys: Array<keyof DailyMetric> = [
    'totalSleepHours',
    'timeInBedHours',
    'deepSleepHours',
    'remSleepHours',
    'awakeHours',
    'sleepScore',
    'latencyMinutes',
    'bedtimeStartHour',
    'wakeTimeHour',
    'averageHeartRate',
    'lowestHeartRate',
    'averageHrv',
    'averageBreath',
    'steps',
    'activeCalories',
    'totalCalories',
    'lowActivityHours',
    'mediumActivityHours',
    'highActivityHours',
    'sedentaryHours',
    'restingHours',
    'stressHighHours',
    'recoveryHighHours',
    'spo2',
    'breathingDisturbanceIndex',
    'vascularAge',
    'awakeHeartRate',
    'workoutHeartRate',
    'restHeartRate'
  ];

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
    orange: '#f97316',
    rose: '#e11d48',
    pink: '#db2777',
    violet: '#7c3aed',
    gray: '#64748b',
    ink: '#111827'
  };

  const stressSummaryStyles = {
    restored: { label: 'Restored', color: '#2563eb' },
    normal: { label: 'Normal', color: '#0f9f6e' },
    stressful: { label: 'Stressful', color: '#b45309' },
    high: { label: 'High', color: '#e11d48' }
  };
  const stressSummaryKeys = ['restored', 'normal', 'stressful', 'high'] as const;

  let summary: OuraSummary | null = null;
  let activeSection: SectionKey = 'sleep';
  let dashboardMode: DashboardMode = 'overtime';
  let selectedDailyIndex = 0;
  let uploadState: 'idle' | 'uploading' | 'revealing' | 'done' | 'error' = 'idle';
  let uploadMessage = '';
  let storedDatasetId = '';
  let showDataHelp = false;
  let isUploadDragActive = false;
  let fileInput: HTMLInputElement;

  onMount(async () => {
    if (import.meta.env.DEV && (await loadVisualFixture())) return;

    storedDatasetId = getCurrentDatasetId();

    if (storedDatasetId) {
      await loadStoredDataset();
    }
  });

  function setActiveSummary(nextSummary: OuraSummary | null) {
    summary = nextSummary;
    selectedDailyIndex = nextSummary?.daily.length ? nextSummary.daily.length - 1 : 0;
  }

  $: hasLocalData = summary !== null;
  $: daily = summary?.daily ?? [];
  $: averages = summary?.averages ?? {};
  $: currentSection = sections.find((section) => section.key === activeSection) ?? sections[0];
  $: selectedDailyIndex = clampDailyIndex(selectedDailyIndex, daily.length);
  $: selectedDay = daily[selectedDailyIndex] ?? null;
  $: selectedDayTitle = selectedDay ? fullDate(selectedDay.day) : 'No day selected';
  $: selectedDayDate = selectedDay?.day ?? '';
  $: selectedDayPosition = daily.length ? `${selectedDailyIndex + 1} of ${daily.length}` : '0 of 0';
  $: isFirstDailyDay = selectedDailyIndex <= 0;
  $: isLastDailyDay = selectedDailyIndex >= daily.length - 1;
  $: dailyScores = selectedDay ? buildDailyScores(selectedDay, averages) : [];
  $: dailyHeroMetrics = selectedDay ? buildDailyHeroMetrics(selectedDay, averages) : [];
  $: dailySleepStages = selectedDay ? buildDailySleepStages(selectedDay) : [];
  $: dailyDetailGroups = selectedDay ? buildDailyDetailGroups(selectedDay, averages) : [];
  $: storagePath = summary?.storage
    ? `browser:indexeddb://${summary.storage.datasetId}/${summary.storage.sourceName}`
    : 'browser:indexeddb://current';

  $: sleepDurationSeries = [
    ...rawAndAverageSeries(daily, 'totalSleepHours', 'Sleep', chartColors.blue),
    ...rawAndAverageSeries(daily, 'timeInBedHours', 'In bed', chartColors.gray)
  ];
  $: sleepScoreSeries = rawAndAverageSeries(daily, 'sleepScore', 'Sleep score', chartColors.blue);
  $: latencySeries = rawAndAverageSeries(daily, 'latencyMinutes', 'Latency', chartColors.green);
  $: latencyMaxY = maxForKey(daily, 'latencyMinutes', 50, 10);
  $: sleepTimingSeries = [
    ...rawAndAverageSeries(daily, 'bedtimeStartHour', 'Bedtime', chartColors.violet),
    ...rawAndAverageSeries(daily, 'wakeTimeHour', 'Wake', chartColors.amber)
  ];
  $: sleepStageSeries = [
    rollingSeries(daily, 'deepSleepHours', 'Deep 7-day trend', chartColors.blue),
    rollingSeries(daily, 'remSleepHours', 'REM 7-day trend', chartColors.violet),
    rollingSeries(daily, 'awakeHours', 'Awake 7-day trend', chartColors.amber),
    {
      ...rollingSeries(daily, 'totalSleepHours', 'Total sleep 7-day trend', chartColors.ink),
      showInLegend: false,
      tooltipOnly: true
    }
  ];
  $: latencyBands = [
    { from: 0, to: 10, color: '#dcfce7' },
    { from: 10, to: 20, color: '#dbeafe' },
    { from: 20, to: 30, color: '#fef9c3' },
    { from: 30, to: 40, color: '#ffedd5' },
    { from: 40, to: null, color: '#fee2e2' }
  ];

  $: heartSeries = [
    ...rawMovingAverageAverageSeries(daily, 'averageHeartRate', 'Average HR', chartColors.rose, (value) => `${value.toFixed(1)} bpm`),
    ...rawMovingAverageAverageSeries(daily, 'lowestHeartRate', 'Lowest HR', chartColors.blue, (value) => `${value.toFixed(1)} bpm`)
  ];
  $: hrvSeries = rawMovingAverageAverageSeries(daily, 'averageHrv', 'HRV', chartColors.blue, (value) => `${value.toFixed(1)} ms`);
  $: daytimeHeartSeries = [
    ...rawMovingAverageAverageSeries(daily, 'awakeHeartRate', 'Awake', chartColors.orange, (value) => `${value.toFixed(1)} bpm`),
    ...rawMovingAverageAverageSeries(daily, 'restHeartRate', 'Rest', chartColors.green, (value) => `${value.toFixed(1)} bpm`),
    ...rawMovingAverageAverageSeries(daily, 'workoutHeartRate', 'Workout', chartColors.rose, (value) => `${value.toFixed(1)} bpm`)
  ];
  $: vascularAgeSeries = rawMovingAverageAverageSeries(daily, 'vascularAge', 'Vascular age', chartColors.pink, (value) => value.toFixed(1));

  $: stepSeries = rawMovingAverageAverageSeries(daily, 'steps', 'Steps', chartColors.green, wholeNumberLabel);
  $: calorieSeries = [
    ...rawMovingAverageAverageSeries(daily, 'activeCalories', 'Active calories', chartColors.rose, (value) =>
      value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    ),
    ...rawMovingAverageAverageSeries(daily, 'totalCalories', 'Total calories', chartColors.amber, (value) =>
      value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    )
  ];
  $: activityTimeSeries = [
    ...rawMovingAverageAverageSeries(daily, 'highActivityHours', 'High', chartColors.rose, (value) => `${value.toFixed(1)}h`),
    ...rawMovingAverageAverageSeries(daily, 'mediumActivityHours', 'Medium', chartColors.amber, (value) => `${value.toFixed(1)}h`),
    ...rawMovingAverageAverageSeries(daily, 'lowActivityHours', 'Low', chartColors.blue, (value) => `${value.toFixed(1)}h`),
    ...rawMovingAverageAverageSeries(daily, 'sedentaryHours', 'Sedentary', chartColors.violet, (value) => `${value.toFixed(1)}h`),
    ...rawMovingAverageAverageSeries(daily, 'restingHours', 'Resting', chartColors.gray, (value) => `${value.toFixed(1)}h`)
  ];

  $: stressSeries = [
    ...rawMovingAverageAverageSeries(daily, 'stressHighHours', 'Stress', chartColors.rose, (value) => `${value.toFixed(1)}h`),
    ...rawMovingAverageAverageSeries(daily, 'recoveryHighHours', 'Recovery', chartColors.green, (value) => `${value.toFixed(1)}h`)
  ];
  $: stressSummaryPoints = daily.map((day) => ({
    x: day.day,
    state: day.stressSummary
  }));
  $: stressSummaryTrendSeries = rollingStressSummarySeries(daily);

  $: spo2Series = rawMovingAverageAverageSeries(daily, 'spo2', 'SpO2', chartColors.cyan, (value) => `${value.toFixed(1)}%`);
  $: breathingDisturbanceSeries = rawMovingAverageAverageSeries(daily, 'breathingDisturbanceIndex', 'BDI', chartColors.cyan, (value) =>
    value.toFixed(1)
  );
  $: breathSeries = rawMovingAverageAverageSeries(daily, 'averageBreath', 'Breath rate', chartColors.cyan, (value) => `${value.toFixed(1)}/min`);
  $: spo2Bands = [
    { from: 85, to: 90, color: '#fee2e2' },
    { from: 90, to: 95, color: '#fef3c7' },
    { from: 95, to: 100, color: '#dcfce7' }
  ];
  $: breathingDisturbanceBands = [
    { from: 0, to: 5, color: '#dcfce7' },
    { from: 5, to: 10, color: '#fef3c7' }
  ];

  async function loadStoredDataset() {
    if (!storedDatasetId) return;

    try {
      uploadState = 'uploading';
      uploadMessage = 'Loading local export';
      const dataset = await loadLocalDataset(storedDatasetId);
      if (!dataset) throw new Error('Saved export was not found in this browser.');
      if (!hasGraphableMetrics(dataset.summary)) {
        await deleteLocalDataset(storedDatasetId);
        throw new Error('Saved export has no chart metrics. Re-upload data.zip to reprocess it.');
      }
      setActiveSummary(dataset.summary);
      uploadState = 'done';
      uploadMessage = 'Local export loaded';
    } catch (error) {
      setActiveSummary(null);
      storedDatasetId = '';
      if (browser) clearCurrentDatasetId();
      uploadState = 'error';
      uploadMessage = error instanceof Error ? error.message : 'Local export could not be loaded.';
    }
  }

  async function uploadFile(file: File | null | undefined) {
    if (!file) return;
    uploadState = 'uploading';
    uploadMessage = 'Processing export locally';

    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Only .zip Oura exports are supported.');
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('Upload is too large. Keep Oura exports under 75 MB.');
      }

      const bytes = await file.arrayBuffer();
      const parsedSummary = await parseOuraZip(bytes, { sourceName: file.name });
      if (!parsedSummary.daily.length) {
        throw new Error('No daily Oura records were found in this export.');
      }
      if (!hasGraphableMetrics(parsedSummary)) {
        throw new Error('No numeric chart metrics were found in this export.');
      }

      const datasetId = crypto.randomUUID();
      const savedAt = new Date().toISOString();

      parsedSummary.storage = {
        kind: 'browser',
        datasetId,
        sourceName: file.name,
        sizeBytes: file.size,
        savedAt
      };

      await saveLocalDataset({
        id: datasetId,
        savedAt,
        sourceName: file.name,
        sizeBytes: file.size,
        summary: parsedSummary
      });

      if (browser) {
        setCurrentDatasetId(datasetId);
      }

      setActiveSummary(parsedSummary);
      storedDatasetId = datasetId;
      uploadMessage = 'Export processed and saved locally';
      uploadState = 'revealing';
      window.setTimeout(() => {
        uploadState = 'done';
      }, 720);
    } catch (error) {
      uploadState = 'error';
      uploadMessage = error instanceof Error ? error.message : 'Local processing failed.';
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  async function deleteCurrentDataset() {
    const datasetId = storedDatasetId || summary?.storage?.datasetId;
    if (datasetId) {
      await deleteLocalDataset(datasetId);
    }
    setActiveSummary(null);
    storedDatasetId = '';
    if (browser) clearCurrentDatasetId();
    uploadState = 'idle';
    uploadMessage = '';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    resetUploadDragState();
    if (uploadState === 'uploading') return;
    void uploadFile(event.dataTransfer?.files?.[0]);
  }

  function handleUploadDragEnter(event: DragEvent) {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    if (uploadState === 'uploading') return;
    isUploadDragActive = true;
  }

  function handleUploadDragOver(event: DragEvent) {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = uploadState === 'uploading' ? 'none' : 'copy';
    }
    if (uploadState !== 'uploading') {
      isUploadDragActive = true;
    }
  }

  function handleUploadDragLeave(event: DragEvent) {
    if (!hasDraggedFiles(event)) return;

    const uploadShell = event.currentTarget as HTMLElement;
    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
    if (hoveredElement && uploadShell.contains(hoveredElement)) return;

    resetUploadDragState();
  }

  function hasDraggedFiles(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  function resetUploadDragState() {
    isUploadDragActive = false;
  }

  function seriesFor(sourceDaily: DailyMetric[], key: keyof DailyMetric, label: string, color: string): ChartSeries {
    return {
      label,
      color,
      values: sourceDaily.map((day) => ({
        x: day.day,
        y: numeric(day[key])
      }))
    };
  }

  function rollingSeries(sourceDaily: DailyMetric[], key: keyof DailyMetric, label: string, color: string, windowSize = 7): ChartSeries {
    return {
      label,
      color,
      showPoints: 'hover',
      strokeWidth: 3.4,
      values: sourceDaily.map((day, index) => ({
        x: day.day,
        y: average(
          sourceDaily
            .slice(Math.max(0, index - windowSize + 1), index + 1)
            .map((entry) => numeric(entry[key]))
        )
      }))
    };
  }

  function rawAndAverageSeries(sourceDaily: DailyMetric[], key: keyof DailyMetric, label: string, color: string): ChartSeries[] {
    return [
      {
        ...seriesFor(sourceDaily, key, `${label} raw`, color),
        opacity: 0.32,
        pointOpacity: 0.42,
        pointRadius: 2.4,
        showPoints: 'always',
        strokeWidth: 1.35
      },
      {
        ...rollingSeries(sourceDaily, key, `${label} 7-day trend`, color),
        strokeWidth: 3.6
      }
    ];
  }

  function rawMovingAverageAverageSeries(
    sourceDaily: DailyMetric[],
    key: keyof DailyMetric,
    label: string,
    color: string,
    labelFormatter: (value: number) => string = (value) => value.toFixed(1)
  ): ChartSeries[] {
    const avg = averageForKey(sourceDaily, key);
    return [
      {
        ...seriesFor(sourceDaily, key, `${label} (raw)`, color),
        opacity: 0.3,
        pointOpacity: 0.45,
        pointRadius: 2,
        showPoints: 'always',
        strokeWidth: 1.2
      },
      {
        ...rollingSeries(sourceDaily, key, `${label} (7-day trend)`, color),
        strokeWidth: 3.7
      },
      averageLineSeries(sourceDaily, key, label, color, avg === null ? null : labelFormatter(avg))
    ];
  }

  function averageLineSeries(
    sourceDaily: DailyMetric[],
    key: keyof DailyMetric,
    label: string,
    color: string,
    formattedAverage: string | null
  ): ChartSeries {
    const y = averageForKey(sourceDaily, key);
    const averageLabel = label.replace(/^Average\s+/i, '');
    const seriesLabel = `Avg ${averageLabel}`;
    return {
      averageCallout: formattedAverage ? { label: averageLabel, value: formattedAverage } : undefined,
      label: formattedAverage ? `${seriesLabel}: ${formattedAverage}` : seriesLabel,
      color,
      opacity: 0.72,
      showInLegend: false,
      showPoints: false,
      strokeDasharray: '6 4',
      strokeWidth: 1.6,
      values: sourceDaily.map((day) => ({
        x: day.day,
        y
      }))
    };
  }

  function averageForKey(sourceDaily: DailyMetric[], key: keyof DailyMetric) {
    return average(sourceDaily.map((day) => numeric(day[key])));
  }

  function rollingStressSummarySeries(sourceDaily: DailyMetric[]): ChartSeries[] {
    return stressSummaryKeys.map((key) => ({
      label: stressSummaryStyles[key].label,
      color: stressSummaryStyles[key].color,
      showPoints: 'hover',
      strokeWidth: 2.6,
      values: sourceDaily.map((day, index) => {
        const window = sourceDaily.slice(Math.max(0, index - 6), index + 1);
        const count = window.filter((entry) => entry.stressSummary === key).length;
        return {
          x: day.day,
          y: window.length ? (count / window.length) * 100 : null
        };
      })
    }));
  }

  function maxForKey(sourceDaily: DailyMetric[], key: keyof DailyMetric, minimum: number, interval: number) {
    const values = sourceDaily.map((day) => numeric(day[key])).filter((value): value is number => value !== null);
    if (!values.length) return minimum;
    return Math.max(minimum, Math.ceil(Math.max(...values) / interval) * interval);
  }

  function numeric(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function hasGraphableMetrics(candidate: OuraSummary) {
    return candidate.daily.some(
      (day) => chartDataKeys.some((key) => numeric(day[key]) !== null) || Boolean(day.stressSummary)
    );
  }

  async function loadVisualFixture() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('visualFixture') !== 'dev-summary') return false;

    try {
      const response = await fetch('/__openoura_visual_summary');
      if (!response.ok) throw new Error('Visual fixture summary could not be loaded.');
      const parsedSummary = (await response.json()) as OuraSummary;
      if (!parsedSummary.daily?.length || !hasGraphableMetrics(parsedSummary)) {
        throw new Error('Visual fixture has no graphable Oura records.');
      }

      setActiveSummary(parsedSummary);
      uploadState = 'done';
      uploadMessage = 'Visual fixture loaded';
      return true;
    } catch (error) {
      setActiveSummary(null);
      uploadState = 'error';
      uploadMessage = error instanceof Error ? error.message : 'Visual fixture could not be loaded.';
      return true;
    }
  }

  function average(values: Array<number | null>) {
    const valid = values.filter((value): value is number => value !== null);
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function clampDailyIndex(index: number, length: number) {
    if (!length) return 0;
    if (!Number.isFinite(index)) return length - 1;
    return Math.min(Math.max(Math.trunc(index), 0), length - 1);
  }

  function goToPreviousDay() {
    selectedDailyIndex = clampDailyIndex(selectedDailyIndex - 1, daily.length);
  }

  function goToNextDay() {
    selectedDailyIndex = clampDailyIndex(selectedDailyIndex + 1, daily.length);
  }

  function toggleDailyDashboard() {
    if (dashboardMode === 'daily') {
      dashboardMode = 'overtime';
      return;
    }

    const currentDay = daily[clampDailyIndex(selectedDailyIndex, daily.length)];
    if (!currentDay || !hasDailyData(currentDay)) {
      const firstDataIndex = daily.findIndex(hasDailyData);
      if (firstDataIndex !== -1) selectedDailyIndex = firstDataIndex;
    }

    dashboardMode = 'daily';
  }

  function hasDailyData(day: DailyMetric) {
    return Object.entries(day).some(([key, value]) => key !== 'day' && value !== null && value !== undefined && value !== '');
  }

  function handleDailySelect(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    const index = daily.findIndex((day) => day.day === value);
    if (index !== -1) selectedDailyIndex = index;
  }

  function buildDailyScores(day: DailyMetric, sourceAverages: OuraSummary['averages']): DailyScoreSummary[] {
    return [
      {
        label: 'Sleep score',
        value: day.sleepScore,
        detail: scoreComparison(day.sleepScore, sourceAverages.sleepScore),
        accent: chartColors.blue
      },
      {
        label: 'Readiness score',
        value: day.readinessScore,
        detail: scoreComparison(day.readinessScore, sourceAverages.readinessScore),
        accent: chartColors.green
      },
      {
        label: 'Activity score',
        value: day.activityScore,
        detail: scoreComparison(day.activityScore, sourceAverages.activityScore),
        accent: chartColors.rose
      }
    ];
  }

  function buildDailyHeroMetrics(day: DailyMetric, sourceAverages: OuraSummary['averages']): DailyDetailItem[] {
    return [
      detailItem('Sleep', durationLabel(day.totalSleepHours), `${durationLabel(day.timeInBedHours)} in bed`, chartColors.blue),
      detailItem('HRV', millisecondsValue(day.averageHrv), comparisonLabel(day.averageHrv, sourceAverages.averageHrv, (value) => `${numberLabel(value, 0)} ms`, 0.5), chartColors.violet),
      detailItem('Night HR', bpmValue(day.averageHeartRate, 1), `${bpmValue(day.lowestHeartRate, 1)} lowest`, chartColors.rose),
      detailItem('Steps', numberLabel(day.steps, 0), comparisonLabel(day.steps, sourceAverages.steps, (value) => numberLabel(value, 0), 1), chartColors.green),
      detailItem('Stress high', durationLabel(day.stressHighHours), `${durationLabel(day.recoveryHighHours)} high recovery`, chartColors.amber),
      detailItem('SpO2', percentValue(day.spo2, 1), comparisonLabel(day.spo2, sourceAverages.spo2, (value) => `${numberLabel(value, 1)}%`, 0.05), chartColors.cyan)
    ];
  }

  function buildDailySleepStages(day: DailyMetric): DailyStageItem[] {
    const denominator = numeric(day.timeInBedHours) ?? numeric(day.totalSleepHours);
    const stages = [
      { label: 'Deep sleep', value: numeric(day.deepSleepHours), accent: chartColors.blue },
      { label: 'REM sleep', value: numeric(day.remSleepHours), accent: chartColors.violet },
      { label: 'Awake', value: numeric(day.awakeHours), accent: chartColors.amber }
    ];

    return stages
      .filter((stage) => stage.value !== null)
      .map((stage) => {
        const percent = denominator ? Math.min(Math.max(((stage.value ?? 0) / denominator) * 100, 0), 100) : 0;
        return {
          label: stage.label,
          value: durationLabel(stage.value),
          detail: denominator ? `${numberLabel(percent, 0)}% of time in bed` : 'No time-in-bed baseline',
          accent: stage.accent,
          percent
        };
      });
  }

  function buildDailyDetailGroups(day: DailyMetric, sourceAverages: OuraSummary['averages']): DailyDetailGroup[] {
    const sleepItems = [
      detailItem('Total sleep', durationLabel(day.totalSleepHours), durationComparison(day.totalSleepHours, sourceAverages.totalSleepHours), chartColors.blue),
      detailItem('Time in bed', durationLabel(day.timeInBedHours), durationComparison(day.timeInBedHours, sourceAverages.timeInBedHours), chartColors.gray),
      detailItem('Sleep efficiency', percentValue(day.efficiency, 0), comparisonLabel(day.efficiency, sourceAverages.efficiency, (value) => `${numberLabel(value, 0)}%`, 0.5), chartColors.green),
      detailItem('Sleep latency', minutesValue(day.latencyMinutes), comparisonLabel(day.latencyMinutes, sourceAverages.latencyMinutes, (value) => `${numberLabel(value, 0)}m`, 0.5), chartColors.amber),
      detailItem('Bedtime', clockValue(day.bedtimeStartHour), 'Start of main sleep period', chartColors.violet),
      detailItem('Wake time', clockValue(day.wakeTimeHour), 'End of main sleep period', chartColors.amber)
    ];

    const heartItems = [
      detailItem('Readiness', numberLabel(day.readinessScore, 0), scoreComparison(day.readinessScore, sourceAverages.readinessScore), chartColors.green),
      detailItem('Average HRV', millisecondsValue(day.averageHrv), comparisonLabel(day.averageHrv, sourceAverages.averageHrv, (value) => `${numberLabel(value, 0)} ms`, 0.5), chartColors.blue),
      detailItem('Average sleep HR', bpmValue(day.averageHeartRate, 1), comparisonLabel(day.averageHeartRate, sourceAverages.averageHeartRate, (value) => `${numberLabel(value, 1)} bpm`, 0.05), chartColors.rose),
      detailItem('Lowest sleep HR', bpmValue(day.lowestHeartRate, 1), comparisonLabel(day.lowestHeartRate, sourceAverages.lowestHeartRate, (value) => `${numberLabel(value, 1)} bpm`, 0.05), chartColors.blue),
      detailItem('Breathing rate', breathValue(day.averageBreath), comparisonLabel(day.averageBreath, sourceAverages.averageBreath, (value) => `${numberLabel(value, 1)}/min`, 0.05), chartColors.cyan),
      detailItem('Awake HR', bpmValue(day.awakeHeartRate, 1), comparisonLabel(day.awakeHeartRate, sourceAverages.awakeHeartRate, (value) => `${numberLabel(value, 1)} bpm`, 0.05), chartColors.orange),
      detailItem('Rest HR', bpmValue(day.restHeartRate, 1), comparisonLabel(day.restHeartRate, sourceAverages.restHeartRate, (value) => `${numberLabel(value, 1)} bpm`, 0.05), chartColors.green),
      detailItem('Workout HR', bpmValue(day.workoutHeartRate, 1), comparisonLabel(day.workoutHeartRate, sourceAverages.workoutHeartRate, (value) => `${numberLabel(value, 1)} bpm`, 0.05), chartColors.rose)
    ];
    addOptionalDetail(heartItems, day.temperatureDeviation, 'Temperature', signedNumberValue(day.temperatureDeviation, 2, ' C'), 'Deviation from baseline', chartColors.amber);
    addOptionalDetail(heartItems, day.resilienceLevel, 'Resilience', titleLabel(day.resilienceLevel), 'Oura resilience level', chartColors.violet);
    addOptionalDetail(heartItems, day.vascularAge, 'Vascular age', numberLabel(day.vascularAge, 0), comparisonLabel(day.vascularAge, sourceAverages.vascularAge, (value) => numberLabel(value, 0), 0.5), chartColors.pink);
    addOptionalDetail(heartItems, day.cardiovascularAge, 'Cardiovascular age', numberLabel(day.cardiovascularAge, 0), 'Smoothed cardiovascular age', chartColors.pink);
    addOptionalDetail(heartItems, day.pulseWaveVelocity, 'Pulse wave velocity', `${numberLabel(day.pulseWaveVelocity, 1)} m/s`, comparisonLabel(day.pulseWaveVelocity, sourceAverages.pulseWaveVelocity, (value) => `${numberLabel(value, 1)} m/s`, 0.05), chartColors.pink);

    const activityItems = [
      detailItem('Activity score', numberLabel(day.activityScore, 0), scoreComparison(day.activityScore, sourceAverages.activityScore), chartColors.green),
      detailItem('Steps', numberLabel(day.steps, 0), comparisonLabel(day.steps, sourceAverages.steps, (value) => numberLabel(value, 0), 1), chartColors.green),
      detailItem('Active calories', caloriesValue(day.activeCalories), comparisonLabel(day.activeCalories, sourceAverages.activeCalories, (value) => `${numberLabel(value, 0)} kcal`, 1), chartColors.rose),
      detailItem('Total calories', caloriesValue(day.totalCalories), comparisonLabel(day.totalCalories, sourceAverages.totalCalories, (value) => `${numberLabel(value, 0)} kcal`, 1), chartColors.amber),
      detailItem('High activity', durationLabel(day.highActivityHours), 'High-intensity movement time', chartColors.rose),
      detailItem('Medium activity', durationLabel(day.mediumActivityHours), 'Medium-intensity movement time', chartColors.amber),
      detailItem('Low activity', durationLabel(day.lowActivityHours), 'Low-intensity movement time', chartColors.blue),
      detailItem('Sedentary', durationLabel(day.sedentaryHours), 'Sedentary time', chartColors.violet),
      detailItem('Resting', durationLabel(day.restingHours), durationComparison(day.restingHours, sourceAverages.restingHours), chartColors.gray)
    ];
    addOptionalDetail(activityItems, day.vo2Max, 'VO2 max', `${numberLabel(day.vo2Max, 1)} ml/kg/min`, comparisonLabel(day.vo2Max, sourceAverages.vo2Max, (value) => `${numberLabel(value, 1)} ml/kg/min`, 0.05), chartColors.cyan);

    const stressOxygenItems = [
      detailItem('High stress', durationLabel(day.stressHighHours), durationComparison(day.stressHighHours, sourceAverages.stressHighHours), chartColors.rose),
      detailItem('High recovery', durationLabel(day.recoveryHighHours), durationComparison(day.recoveryHighHours, sourceAverages.recoveryHighHours), chartColors.green),
      detailItem('Stress summary', titleLabel(day.stressSummary), 'Daily stress classification', chartColors.amber),
      detailItem('Average SpO2', percentValue(day.spo2, 1), comparisonLabel(day.spo2, sourceAverages.spo2, (value) => `${numberLabel(value, 1)}%`, 0.05), chartColors.cyan),
      detailItem('Breathing disturbance', numberLabel(day.breathingDisturbanceIndex, 1), comparisonLabel(day.breathingDisturbanceIndex, sourceAverages.breathingDisturbanceIndex, (value) => numberLabel(value, 1), 0.05), chartColors.cyan)
    ];

    return [
      { title: 'Sleep details', eyebrow: 'Night', items: sleepItems },
      { title: 'Heart and readiness', eyebrow: 'Recovery', items: heartItems },
      { title: 'Activity', eyebrow: 'Movement', items: activityItems },
      { title: 'Stress and oxygen', eyebrow: 'Daytime', items: stressOxygenItems }
    ];
  }

  function detailItem(label: string, value: string, detail: string, accent: string): DailyDetailItem {
    return { label, value, detail, accent };
  }

  function addOptionalDetail(
    items: DailyDetailItem[],
    rawValue: number | string | null | undefined,
    label: string,
    value: string,
    detail: string,
    accent: string
  ) {
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    items.push(detailItem(label, value, detail, accent));
  }

  function comparisonLabel(
    value: number | null | undefined,
    averageValue: number | null | undefined,
    formatter: (value: number) => string,
    threshold = 0.05
  ) {
    if (value === null || value === undefined || averageValue === null || averageValue === undefined) return 'No average comparison';
    const delta = value - averageValue;
    if (Math.abs(delta) <= threshold) return 'Matches avg';
    return `${formatter(Math.abs(delta))} ${delta > 0 ? 'above' : 'below'} avg`;
  }

  function scoreComparison(value: number | null | undefined, averageValue: number | null | undefined) {
    return comparisonLabel(value, averageValue, (delta) => numberLabel(delta, 0), 0.5);
  }

  function durationComparison(value: number | null | undefined, averageValue: number | null | undefined) {
    return comparisonLabel(value, averageValue, (delta) => durationLabel(delta), 1 / 60);
  }

  function fullDate(day: string) {
    const date = new Date(`${day}T00:00:00`);
    if (Number.isNaN(date.getTime())) return day;
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
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

  function percentValue(value: number | null | undefined, digits = 0) {
    return value === null || value === undefined ? 'n/a' : `${numberLabel(value, digits)}%`;
  }

  function bpmValue(value: number | null | undefined, digits = 0) {
    return value === null || value === undefined ? 'n/a' : `${numberLabel(value, digits)} bpm`;
  }

  function millisecondsValue(value: number | null | undefined) {
    return value === null || value === undefined ? 'n/a' : `${numberLabel(value, 0)} ms`;
  }

  function minutesValue(value: number | null | undefined) {
    return value === null || value === undefined ? 'n/a' : `${numberLabel(value, 0)}m`;
  }

  function caloriesValue(value: number | null | undefined) {
    return value === null || value === undefined ? 'n/a' : `${numberLabel(value, 0)} kcal`;
  }

  function breathValue(value: number | null | undefined) {
    return value === null || value === undefined ? 'n/a' : `${numberLabel(value, 1)}/min`;
  }

  function signedNumberValue(value: number | null | undefined, digits = 1, suffix = '') {
    if (value === null || value === undefined) return 'n/a';
    const sign = value > 0 ? '+' : '';
    return `${sign}${numberLabel(value, digits)}${suffix}`;
  }

  function wholeNumberLabel(value: number) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function durationLabel(value: number | null | undefined) {
    if (value === null || value === undefined) return 'n/a';
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  function minutesLabel(value: number) {
    return `${value.toFixed(0)}m`;
  }

  function clockValue(value: number | null | undefined) {
    return value === null || value === undefined ? 'n/a' : clockLabel(value);
  }

  function titleLabel(value: string | null | undefined) {
    if (!value) return 'n/a';
    return value
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function toggleDataHelp() {
    showDataHelp = !showDataHelp;
  }
</script>

<svelte:head>
  <title>OpenOura</title>
</svelte:head>

<input
  bind:this={fileInput}
  class="visually-hidden"
  type="file"
  accept=".zip,application/zip"
  on:change={(event) => uploadFile((event.currentTarget as HTMLInputElement).files?.[0])}
/>

{#if !summary}
  <main
    class="upload-shell"
    class:processing={uploadState === 'uploading'}
    class:dragging={isUploadDragActive}
    aria-busy={uploadState === 'uploading'}
    on:dragenter={handleUploadDragEnter}
    on:dragover={handleUploadDragOver}
    on:dragleave={handleUploadDragLeave}
    on:drop={handleDrop}
  >
    <div class="upload-aura" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>

    <a class="about-floating-link" href="/about">
      <Info size={17} strokeWidth={2.4} />
      <span>About</span>
    </a>

    <section class="upload-stage" aria-label="Choose Oura export">
      <div class="upload-mark"><Activity size={24} strokeWidth={2.5} /></div>
      <h1>OpenOura</h1>
      <div class="upload-action-row">
        <button type="button" class="choose-button" on:click={() => fileInput?.click()} disabled={uploadState === 'uploading'}>
          <UploadCloud size={20} />
          <span>{uploadState === 'uploading' ? 'Processing data.zip' : 'Choose data.zip export'}</span>
        </button>
        <button
          type="button"
          class="data-help-button"
          title="Need your Oura data?"
          aria-label="How to get your Oura data"
          aria-controls="data-help-panel"
          aria-expanded={showDataHelp}
          on:click={toggleDataHelp}
        >
          <CircleQuestionMark size={18} strokeWidth={2.4} />
        </button>
      </div>
      {#if showDataHelp}
        <div id="data-help-panel" class="data-help-panel" role="region" aria-label="How to get your Oura data">
          <div>
            <strong>Need your Oura data?</strong>
            <p>
              Visit
              <a href="https://membership.ouraring.com/data-export" target="_blank" rel="noreferrer">Oura's data export page</a>
              and log into your account to request a ZIP of CSV data from your ring. You can export even without a paid subscription;
              requests can take over 48 hours to complete.
            </p>
          </div>
          <button type="button" class="data-help-close" aria-label="Close data help" on:click={() => (showDataHelp = false)}>
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
      {/if}
      {#if uploadState === 'error'}
        <p class="upload-error">{uploadMessage}</p>
      {/if}
    </section>

    <p class="upload-privacy-footer">Private by design: all processing happens in your browser using local storage.</p>
  </main>
{:else}
{#key summary.storage?.datasetId ?? summary.generatedAt}
<main class="app-shell" class:dashboard-revealing={uploadState === 'revealing'}>
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
      <a href="/about">
        <Info size={18} strokeWidth={2.4} />
        <span>About</span>
      </a>
      <a href="https://github.com/exosai/openouraring" target="_blank" rel="noreferrer">
        <GitFork size={18} strokeWidth={2.4} />
        <span>GitHub</span>
      </a>
    </div>
  </aside>

  <section class="workspace">
    <header class="topbar">
      <div>
        <p class="eyebrow">Oura Ring CSV export</p>
        <h1>{dashboardMode === 'daily' ? 'Daily dashboard' : `${currentSection.label} dashboard`}</h1>
        <div class="range-row">
          <p class="range">
            {#if dashboardMode === 'daily'}
              {selectedDayTitle} · {selectedDayPosition}
            {:else}
              {summary.range.start ? compactDate(summary.range.start) : 'n/a'} to {summary.range.end ? compactDate(summary.range.end) : 'n/a'}
            {/if}
          </p>
          <button
            type="button"
            class="daily-data-button"
            on:click={toggleDailyDashboard}
          >
            <CalendarDays size={15} strokeWidth={2.4} />
            <span>{dashboardMode === 'daily' ? 'View over time' : 'View daily data'}</span>
          </button>
        </div>
      </div>

      <div class="topbar-controls">
        <div class="actions">
          {#if hasLocalData}
            <button type="button" class="icon-button danger" title="Delete local data" on:click={deleteCurrentDataset} disabled={uploadState === 'uploading'}>
              <Trash2 size={18} />
            </button>
          {/if}
          <button type="button" class="upload-button" on:click={() => fileInput?.click()} disabled={uploadState === 'uploading'}>
            <UploadCloud size={18} />
            <span>{uploadState === 'uploading' ? 'Processing' : 'Upload data.zip'}</span>
          </button>
        </div>
      </div>
    </header>

    <button
      class="status-band"
      type="button"
      aria-label="Drop or choose Oura data zip"
      on:click={() => fileInput?.click()}
      on:dragover|preventDefault
      on:drop={handleDrop}
    >
      <span class="status-copy">
        <Database size={18} />
        <span>{storagePath}</span>
      </span>
      <strong class:error={uploadState === 'error'}>{uploadMessage}</strong>
    </button>

    {#if dashboardMode === 'overtime'}
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
          <div class="panel">
            <LineChart title="Sleep duration and time in bed" series={sleepDurationSeries} yFormatter={(value) => `${value.toFixed(1)}h`} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <LineChart
              title="Deep, REM, awake, and total sleep averages"
              series={sleepStageSeries}
              yFormatter={(value) => `${value.toFixed(1)}h`}
              xFormatter={compactDate}
              minY={0}
              tickInterval={0.5}
            />
          </div>
          <div class="panel">
            <LineChart
              title="Sleep latency"
              series={latencySeries}
              yFormatter={minutesLabel}
              xFormatter={compactDate}
              minY={0}
              maxY={latencyMaxY}
              tickInterval={10}
              backgroundBands={latencyBands}
            />
          </div>
          <div class="panel">
            <LineChart title="Oura sleep score" series={sleepScoreSeries} yFormatter={(value) => value.toFixed(0)} xFormatter={compactDate} minY={0} maxY={100} />
          </div>
          <div class="panel">
            <LineChart title="Bedtime and wake time" series={sleepTimingSeries} yFormatter={clockLabel} xFormatter={compactDate} />
          </div>
          <InsightPanel title="Sleep readout" insights={summary.insights.sleep} />
        </div>
      {:else if activeSection === 'heart'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Vascular age over time" series={vascularAgeSeries} yFormatter={(value) => value.toFixed(0)} xFormatter={compactDate} minY={15} maxY={35} />
          </div>
          <div class="panel wide">
            <LineChart title="Heart rate during sleep" series={heartSeries} yFormatter={(value) => `${value.toFixed(0)} bpm`} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <LineChart title="Average HRV during sleep" series={hrvSeries} yFormatter={(value) => `${value.toFixed(0)} ms`} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <Histogram title="Sleep HR distribution" bins={summary.distributions.sleepHeartRate} color={chartColors.rose} unit=" bpm" />
          </div>
          <div class="panel">
            <Histogram title="Sleep HRV distribution" bins={summary.distributions.sleepHrv} color={chartColors.blue} unit=" ms" />
          </div>
          <div class="panel wide">
            <LineChart title="Heart rate over time (daily averages)" series={daytimeHeartSeries} yFormatter={(value) => `${value.toFixed(0)} bpm`} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <Histogram title="Awake HR distribution" bins={summary.distributions.awakeHeartRate} color={chartColors.orange} unit=" bpm" />
          </div>
          <div class="panel">
            <Histogram title="Workout HR distribution" bins={summary.distributions.workoutHeartRate} color={chartColors.rose} unit=" bpm" />
          </div>
          <InsightPanel title="Heart readout" insights={summary.insights.heart} />
        </div>
      {:else if activeSection === 'activity'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Daily steps" series={stepSeries} yFormatter={wholeNumberLabel} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <LineChart title="Calories (active vs total, 7-day trend)" series={calorieSeries} yFormatter={(value) => value.toFixed(0)} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel wide">
            <LineChart title="Activity time breakdown (hours, 7-day trend)" series={activityTimeSeries} yFormatter={(value) => `${value.toFixed(1)}h`} xFormatter={compactDate} minY={0} />
          </div>
          <InsightPanel title="Activity readout" insights={summary.insights.activity} />
        </div>
      {:else if activeSection === 'stress'}
        <div class="content-grid">
          <div class="panel wide">
            <LineChart title="Stress and recovery time" series={stressSeries} yFormatter={(value) => `${value.toFixed(1)}h`} xFormatter={compactDate} minY={0} />
          </div>
          <div class="panel">
            <StateHeatmap title="Daily stress summary" points={stressSummaryPoints} styles={stressSummaryStyles} xFormatter={compactDate} />
          </div>
          <div class="panel">
            <LineChart
              title="Rolling 7-day stress distribution"
              series={stressSummaryTrendSeries}
              yFormatter={(value) => `${value.toFixed(0)}%`}
              xFormatter={compactDate}
              minY={0}
              maxY={100}
            />
          </div>
          <InsightPanel title="Stress readout" insights={summary.insights.stress} />
        </div>
      {:else}
        <div class="content-grid">
          <div class="panel">
            <LineChart
              title="Average SpO2 %"
              series={spo2Series}
              yFormatter={(value) => `${value.toFixed(1)}%`}
              xFormatter={compactDate}
              minY={85}
              maxY={100}
              backgroundBands={spo2Bands}
            />
          </div>
          <div class="panel">
            <LineChart
              title="Breathing disturbance index"
              series={breathingDisturbanceSeries}
              yFormatter={(value) => value.toFixed(1)}
              xFormatter={compactDate}
              minY={0}
              maxY={10}
              backgroundBands={breathingDisturbanceBands}
            />
          </div>
          <div class="panel">
            <LineChart title="Breathing rate during sleep" series={breathSeries} yFormatter={(value) => `${value.toFixed(1)}/min`} xFormatter={compactDate} />
          </div>
          <InsightPanel title="Oxygen readout" insights={summary.insights.oxygen} />
        </div>
      {/if}
    </section>
    {:else if selectedDay}
    <section class="daily-dashboard" aria-label="Daily health dashboard">
      <div class="daily-toolbar">
        <div>
          <p class="eyebrow">Daily detail</p>
          <h2>{selectedDayTitle}</h2>
        </div>

        <div class="day-controls" aria-label="Move between days">
          <button type="button" class="day-nav-button" title="Previous day" aria-label="Previous day" on:click={goToPreviousDay} disabled={isFirstDailyDay}>
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <label class="day-select">
            <CalendarDays size={17} strokeWidth={2.3} aria-hidden="true" />
            <span class="visually-hidden">Select day</span>
            <select value={selectedDayDate} on:change={handleDailySelect}>
              {#each daily as day}
                <option value={day.day}>{fullDate(day.day)}</option>
              {/each}
            </select>
          </label>
          <button type="button" class="day-nav-button" title="Next day" aria-label="Next day" on:click={goToNextDay} disabled={isLastDailyDay}>
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <section class="daily-score-grid" aria-label="Daily scores">
        {#each dailyScores as score}
          <DailyScoreRing label={score.label} value={score.value} detail={score.detail} accent={score.accent} />
        {/each}
      </section>

      <section class="metric-grid daily-metric-grid" aria-label="Daily key metrics">
        {#each dailyHeroMetrics as metric}
          <MetricCard label={metric.label} value={metric.value} detail={metric.detail} accent={metric.accent} />
        {/each}
      </section>

      {#if dailySleepStages.length}
        <section class="daily-panel sleep-stage-panel" aria-label="Sleep stage breakdown">
          <div class="daily-panel-heading">
            <div>
              <p class="eyebrow">Sleep contributors</p>
              <h3>Sleep stage balance</h3>
            </div>
            <span>{durationLabel(selectedDay.totalSleepHours)} total sleep</span>
          </div>
          <div class="sleep-stage-list">
            {#each dailySleepStages as stage}
              <div class="sleep-stage-row" style={`--stage-color: ${stage.accent}; --stage-percent: ${stage.percent}%`}>
                <div>
                  <strong>{stage.label}</strong>
                  <span>{stage.detail}</span>
                </div>
                <b>{stage.value}</b>
                <div class="stage-track" aria-hidden="true"><span></span></div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <section class="daily-detail-grid" aria-label="Daily detail metrics">
        {#each dailyDetailGroups as group}
          <article class="daily-panel">
            <div class="daily-panel-heading">
              <div>
                <p class="eyebrow">{group.eyebrow}</p>
                <h3>{group.title}</h3>
              </div>
            </div>
            <div class="daily-detail-list">
              {#each group.items as item}
                <div class="daily-detail-item" style={`--item-accent: ${item.accent}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              {/each}
            </div>
          </article>
        {/each}
      </section>
    </section>
    {:else}
    <section class="daily-dashboard" aria-label="Daily health dashboard">
      <div class="empty-daily-panel">
        <h2>No daily records</h2>
        <p>This export loaded, but it does not include daily rows to inspect.</p>
      </div>
    </section>
    {/if}

    <footer class="footnotes">
      <span>{summary.privacyNotes[2]}</span>
    </footer>
  </section>
</main>
{/key}
{/if}

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

  .app-shell.dashboard-revealing {
    animation: dashboardReveal 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .upload-shell {
    align-items: center;
    background:
      radial-gradient(circle at 18% 22%, rgba(37, 99, 235, 0.18), transparent 30%),
      radial-gradient(circle at 82% 18%, rgba(15, 159, 110, 0.18), transparent 26%),
      linear-gradient(135deg, #f8fafc 0%, #eef4f8 48%, #f9fafb 100%);
    display: grid;
    isolation: isolate;
    justify-items: center;
    min-height: 100vh;
    overflow: hidden;
    padding: 24px 24px 82px;
    position: relative;
  }

  .upload-shell::before,
  .upload-shell::after {
    content: "";
    inset: 0;
    position: absolute;
  }

  .upload-shell::before {
    background-image:
      linear-gradient(rgba(17, 24, 39, 0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(17, 24, 39, 0.055) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: radial-gradient(circle at center, #000 0%, transparent 68%);
    z-index: -2;
  }

  .upload-shell::after {
    background: rgba(37, 99, 235, 0.07);
    border: 2px dashed rgba(37, 99, 235, 0.58);
    border-radius: 24px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.72),
      0 24px 80px rgba(37, 99, 235, 0.14);
    inset: 18px;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.985);
    transition:
      opacity 160ms ease,
      transform 160ms ease;
    z-index: 0;
  }

  .upload-shell.dragging {
    cursor: copy;
  }

  .upload-shell.dragging::after {
    opacity: 1;
    transform: scale(1);
  }

  .upload-aura {
    aspect-ratio: 1;
    display: grid;
    max-width: 620px;
    position: absolute;
    width: min(72vw, 620px);
    z-index: -1;
  }

  .upload-aura span {
    border: 1px solid rgba(31, 41, 55, 0.12);
    border-radius: 50%;
    grid-area: 1 / 1;
    transform: scale(var(--scale, 1));
  }

  .upload-aura span:nth-child(1) {
    --scale: 0.64;
    animation: orbitPulse 4.2s ease-in-out infinite;
    background: rgba(255, 255, 255, 0.54);
  }

  .upload-aura span:nth-child(2) {
    --scale: 0.88;
    animation: orbitPulse 5.8s ease-in-out infinite reverse;
  }

  .upload-aura span:nth-child(3) {
    --scale: 1.12;
    animation: orbitPulse 7.4s ease-in-out infinite;
  }

  .about-floating-link {
    align-items: center;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid rgba(203, 213, 225, 0.86);
    border-radius: 8px;
    color: #263241;
    display: inline-flex;
    font-size: 0.86rem;
    font-weight: 760;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    position: absolute;
    right: 22px;
    text-decoration: none;
    top: 22px;
    z-index: 1;
  }

  .about-floating-link:hover,
  .about-floating-link:focus-visible {
    background: #111827;
    border-color: #111827;
    color: #ffffff;
    outline: none;
  }

  .upload-shell.processing .upload-aura span {
    animation-duration: 1.35s;
  }

  .upload-stage {
    align-items: center;
    display: grid;
    gap: 18px;
    justify-items: center;
    position: relative;
    transition: transform 160ms ease;
    z-index: 1;
  }

  .upload-shell.dragging .upload-stage {
    transform: translateY(-3px);
  }

  .upload-stage h1 {
    font-size: clamp(2.5rem, 8vw, 6rem);
    line-height: 0.92;
  }

  .upload-mark {
    align-items: center;
    background: #111827;
    border-radius: 8px;
    color: #ffffff;
    display: grid;
    height: 48px;
    justify-items: center;
    width: 48px;
  }

  .choose-button {
    align-items: center;
    background: #111827;
    border: 1px solid #111827;
    border-radius: 8px;
    box-shadow: 0 18px 48px rgba(17, 24, 39, 0.24);
    color: #ffffff;
    cursor: pointer;
    display: inline-flex;
    font-weight: 800;
    gap: 10px;
    min-height: 54px;
    padding: 0 20px;
    transition:
      box-shadow 180ms ease,
      background 180ms ease,
      border-color 180ms ease,
      transform 180ms ease;
  }

  .choose-button:hover:not(:disabled) {
    box-shadow: 0 22px 56px rgba(17, 24, 39, 0.28);
    transform: translateY(-2px);
  }

  .upload-shell.dragging .choose-button:not(:disabled) {
    background: #1d4ed8;
    border-color: #1d4ed8;
    box-shadow: 0 24px 62px rgba(37, 99, 235, 0.34);
  }

  .choose-button:disabled {
    cursor: wait;
    opacity: 0.82;
  }

  .upload-action-row {
    align-items: center;
    display: inline-grid;
    justify-items: center;
    position: relative;
  }

  .data-help-button {
    align-items: center;
    aspect-ratio: 1;
    background: transparent;
    border: 0;
    color: #2563eb;
    cursor: pointer;
    display: grid;
    height: 28px;
    justify-items: center;
    padding: 0;
    position: absolute;
    left: calc(100% + 4px);
    top: 50%;
    transform: translateY(-50%);
    transition:
      color 180ms ease,
      transform 180ms ease;
  }

  .data-help-button:hover,
  .data-help-button:focus-visible {
    color: #1d4ed8;
    transform: translateY(calc(-50% - 2px));
  }

  .data-help-panel {
    animation: dataHelpReveal 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
    align-items: start;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(191, 219, 254, 0.96);
    border-radius: 8px;
    box-shadow:
      0 24px 70px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    max-width: min(500px, calc(100vw - 48px));
    padding: 16px;
    text-align: left;
    transform-origin: top center;
  }

  .data-help-panel strong {
    color: #111827;
    display: block;
    font-size: 0.94rem;
    line-height: 1.2;
  }

  .data-help-panel p {
    color: #4b5563;
    font-size: 0.86rem;
    line-height: 1.45;
    margin: 4px 0 0;
  }

  .data-help-panel a {
    color: #1d4ed8;
    font-weight: 740;
    text-decoration: none;
  }

  .data-help-panel a:hover {
    text-decoration: underline;
  }

  .data-help-close {
    align-items: center;
    aspect-ratio: 1;
    background: rgba(248, 250, 252, 0.9);
    border: 1px solid rgba(203, 213, 225, 0.9);
    border-radius: 999px;
    color: #64748b;
    cursor: pointer;
    display: grid;
    height: 30px;
    justify-items: center;
    transition:
      background 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .data-help-close:hover,
  .data-help-close:focus-visible {
    background: #111827;
    color: #ffffff;
    transform: translateY(-1px);
  }

  .upload-privacy-footer {
    bottom: 22px;
    color: #596171;
    font-size: 0.82rem;
    line-height: 1.4;
    margin: 0;
    max-width: min(520px, calc(100vw - 48px));
    position: absolute;
    text-align: center;
    z-index: 1;
  }

  .upload-error {
    color: #be123c;
    font-size: 0.9rem;
    font-weight: 720;
    margin: 0;
    max-width: min(460px, 90vw);
    text-align: center;
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
    align-items: stretch;
    border-top: 1px solid #2b2d32;
    color: #a8b0bd;
    display: grid;
    font-size: 0.82rem;
    gap: 8px;
    line-height: 1.35;
    padding-top: 18px;
  }

  .rail-meta a {
    align-items: center;
    border: 1px solid transparent;
    border-radius: 8px;
    color: inherit;
    display: grid;
    gap: 10px;
    grid-template-columns: 22px 1fr;
    min-height: 38px;
    padding: 8px 10px;
    text-decoration: none;
  }

  .rail-meta a:hover,
  .rail-meta a:focus-visible {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    outline: none;
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
    margin: 0;
  }

  .range-row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
  }

  .daily-data-button {
    align-items: center;
    background: #ffffff;
    border: 1px solid #d5dbe5;
    border-radius: 8px;
    color: #1f2937;
    cursor: pointer;
    display: inline-flex;
    font-size: 0.8rem;
    font-weight: 780;
    gap: 6px;
    min-height: 30px;
    padding: 0 9px;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
  }

  .daily-data-button:hover,
  .daily-data-button:focus-visible {
    background: #f2f5f8;
    border-color: #cbd3df;
    color: #111827;
    outline: none;
  }

  .actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }

  .topbar-controls {
    align-items: end;
    display: grid;
    gap: 10px;
    justify-items: end;
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

  .icon-button.danger {
    color: #be123c;
  }

  .icon-button.danger:hover {
    background: #fff1f2;
    border-color: #fecdd3;
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

  .daily-dashboard {
    display: grid;
    gap: 16px;
    margin: 18px auto 0;
    max-width: 1420px;
  }

  .daily-toolbar,
  .daily-panel,
  .empty-daily-panel {
    background: #ffffff;
    border: 1px solid #dfe5ee;
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(22, 26, 33, 0.04);
  }

  .daily-toolbar {
    align-items: center;
    display: flex;
    gap: 16px;
    justify-content: space-between;
    padding: 18px;
  }

  .daily-toolbar h2,
  .daily-panel h3,
  .empty-daily-panel h2 {
    color: #161a21;
    font-size: 1.35rem;
    line-height: 1.15;
    margin: 0;
  }

  .day-controls {
    align-items: center;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
  }

  .day-nav-button {
    align-items: center;
    aspect-ratio: 1;
    background: #ffffff;
    border: 1px solid #d5dbe5;
    border-radius: 8px;
    color: #1f2937;
    cursor: pointer;
    display: grid;
    height: 42px;
    justify-items: center;
  }

  .day-nav-button:hover:not(:disabled),
  .day-nav-button:focus-visible:not(:disabled) {
    background: #111827;
    border-color: #111827;
    color: #ffffff;
    outline: none;
  }

  .day-nav-button:disabled {
    color: #a8b0bd;
    cursor: not-allowed;
  }

  .day-select {
    align-items: center;
    background: #f8fafc;
    border: 1px solid #d5dbe5;
    border-radius: 8px;
    color: #4c5665;
    display: grid;
    gap: 8px;
    grid-template-columns: auto minmax(0, 1fr);
    min-height: 42px;
    min-width: min(300px, 48vw);
    padding: 0 10px;
  }

  .day-select select {
    background: transparent;
    border: 0;
    color: #1f2937;
    font-weight: 760;
    min-height: 40px;
    min-width: 0;
    width: 100%;
  }

  .day-select select:focus-visible {
    outline: none;
  }

  .daily-score-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .daily-metric-grid {
    margin: 0;
    max-width: none;
  }

  .daily-panel {
    min-width: 0;
    padding: 16px;
  }

  .daily-panel-heading {
    align-items: start;
    border-bottom: 1px solid #e6ebf2;
    display: flex;
    gap: 14px;
    justify-content: space-between;
    padding-bottom: 13px;
  }

  .daily-panel-heading > span {
    background: #f2f5f8;
    border: 1px solid #e2e7ee;
    border-radius: 999px;
    color: #4c5665;
    flex: 0 0 auto;
    font-size: 0.78rem;
    font-weight: 720;
    padding: 7px 10px;
  }

  .sleep-stage-list {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }

  .sleep-stage-row {
    align-items: center;
    display: grid;
    gap: 7px 14px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .sleep-stage-row strong,
  .sleep-stage-row span,
  .sleep-stage-row b {
    display: block;
  }

  .sleep-stage-row strong {
    color: #1f2937;
    font-size: 0.93rem;
  }

  .sleep-stage-row span {
    color: #687386;
    font-size: 0.82rem;
    margin-top: 2px;
  }

  .sleep-stage-row b {
    color: #161a21;
    font-size: 0.98rem;
    white-space: nowrap;
  }

  .stage-track {
    background: #edf1f6;
    border-radius: 999px;
    grid-column: 1 / -1;
    height: 9px;
    overflow: hidden;
  }

  .stage-track span {
    background: var(--stage-color);
    border-radius: inherit;
    display: block;
    height: 100%;
    min-width: 3px;
    width: var(--stage-percent);
  }

  .daily-detail-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .daily-detail-list {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 14px;
  }

  .daily-detail-item {
    background: #fbfcfe;
    border: 1px solid #e4e9f1;
    border-left: 4px solid var(--item-accent);
    border-radius: 8px;
    min-width: 0;
    padding: 10px 11px;
  }

  .daily-detail-item span,
  .daily-detail-item strong,
  .daily-detail-item small {
    display: block;
    min-width: 0;
  }

  .daily-detail-item span {
    color: #687386;
    font-size: 0.73rem;
    font-weight: 780;
    text-transform: uppercase;
  }

  .daily-detail-item strong {
    color: #161a21;
    font-size: 1.05rem;
    line-height: 1.18;
    margin-top: 6px;
    overflow-wrap: anywhere;
  }

  .daily-detail-item small {
    color: #596171;
    font-size: 0.78rem;
    line-height: 1.35;
    margin-top: 5px;
  }

  .empty-daily-panel {
    padding: 22px;
  }

  .empty-daily-panel p {
    color: #596171;
    margin: 8px 0 0;
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

  @keyframes orbitPulse {
    0%,
    100% {
      opacity: 0.72;
      transform: scale(var(--scale)) rotate(0deg);
    }

    50% {
      opacity: 1;
      transform: scale(calc(var(--scale) + 0.045)) rotate(14deg);
    }
  }

  @keyframes dashboardReveal {
    0% {
      filter: blur(16px);
      opacity: 0;
      transform: translateY(22px) scale(0.985);
    }

    100% {
      filter: blur(0);
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes dataHelpReveal {
    0% {
      filter: blur(8px);
      opacity: 0;
      transform: translateY(-10px) scale(0.94);
    }

    70% {
      filter: blur(0);
      opacity: 1;
      transform: translateY(2px) scale(1.01);
    }

    100% {
      filter: blur(0);
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .data-help-panel,
    .app-shell.dashboard-revealing,
    .upload-aura span {
      animation: none;
    }

    .choose-button,
    .data-help-button,
    .data-help-close,
    .upload-shell::after,
    .upload-stage {
      transition: none;
    }
  }

  @media (max-width: 1180px) {
    .metric-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .daily-detail-grid {
      grid-template-columns: 1fr;
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
    .daily-toolbar,
    .section-heading,
    .status-band {
      align-items: stretch;
      flex-direction: column;
    }

    .topbar-controls {
      justify-items: start;
    }

    .actions,
    .day-controls,
    .pill-row {
      justify-content: flex-start;
    }

    .daily-score-grid {
      grid-template-columns: 1fr;
    }

    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .upload-stage {
      gap: 14px;
    }

    .choose-button {
      flex: 1 1 auto;
      justify-content: center;
      min-width: 0;
      width: min(100%, 300px);
    }

    .upload-action-row {
      width: min(calc(100vw - 88px), 300px);
    }

    .metric-grid {
      grid-template-columns: 1fr;
    }

    .topbar-controls,
    .actions,
    .day-controls {
      width: 100%;
    }

    .upload-button {
      flex: 1 1 0;
      justify-content: center;
    }

    .day-select {
      flex: 1 1 auto;
      min-width: 0;
    }

    .daily-panel-heading {
      flex-direction: column;
    }

    .daily-detail-list {
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
