import JSZip from 'jszip';
import Papa from 'papaparse';
import type { DailyMetric, HistogramBin, OuraInsight, OuraSummary, SectionKey } from './types';

type CsvRow = Record<string, string | undefined>;

type ParseOptions = {
  sourceName?: string;
};

const TARGET_CSVS = [
  'dailyactivity.csv',
  'dailyreadiness.csv',
  'dailyresilience.csv',
  'dailysleep.csv',
  'sleepmodel.csv',
  'dailyspo2.csv',
  'dailystress.csv',
  'daytimestress.csv',
  'heartrate.csv',
  'dailycardiovascularage.csv',
  'dailysmoothedcardiovascularage.csv',
  'vo2max.csv'
] as const;

const IGNORED_PRIVACY_FILES = [
  'rawlocation.csv',
  'Subscriptions/account.csv',
  'Subscriptions/contact.csv',
  'Subscriptions/payment-method.csv'
];

export async function parseOuraZip(input: ArrayBuffer | Uint8Array, options: ParseOptions = {}) {
  const zip = await JSZip.loadAsync(input);
  const fileIndex = new Map<string, JSZip.JSZipObject>();

  zip.forEach((path, file) => {
    if (!file.dir) {
      fileIndex.set(path.toLowerCase(), file);
    }
  });

  const rowCounts: Record<string, number> = {};
  const filesFound: string[] = [];

  async function readCsv(fileName: (typeof TARGET_CSVS)[number]): Promise<CsvRow[]> {
    const file = findFile(fileIndex, fileName);

    if (!file) {
      rowCounts[fileName] = 0;
      return [];
    }

    filesFound.push(file.name);
    const text = await file.async('string');
    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: 'greedy'
    });

    const rows = parsed.data.filter((row) =>
      Object.values(row).some((value) => typeof value === 'string' && value.trim() !== '')
    );

    rowCounts[fileName] = rows.length;
    return rows;
  }

  const csvEntries = await Promise.all(TARGET_CSVS.map(async (name) => [name, await readCsv(name)] as const));
  const data = Object.fromEntries(csvEntries) as Record<(typeof TARGET_CSVS)[number], CsvRow[]>;

  const dailyMap = new Map<string, DailyMetric>();
  const sleepHeartRates: number[] = [];
  const sleepHrvs: number[] = [];
  const daytimeStressScores: number[] = [];
  const heartRateBySource = {
    awake: [] as number[],
    workout: [] as number[],
    rest: [] as number[]
  };

  const upsertDay = (day: string) => {
    const existing = dailyMap.get(day);
    if (existing) return existing;
    const next: DailyMetric = { day };
    dailyMap.set(day, next);
    return next;
  };

  for (const row of data['dailysleep.csv']) {
    const day = row.day;
    if (!day) continue;
    upsertDay(day).sleepScore = numberOrNull(row.score);
  }

  for (const row of data['dailyreadiness.csv']) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);
    daily.readinessScore = numberOrNull(row.score);
    daily.temperatureDeviation = numberOrNull(row.temperature_deviation);
  }

  for (const row of data['dailyresilience.csv']) {
    const day = row.day;
    if (!day) continue;
    upsertDay(day).resilienceLevel = row.level ?? null;
  }

  const sleepByDay = new Map<string, CsvRow>();
  for (const row of data['sleepmodel.csv']) {
    const day = row.day;
    if (!day) continue;
    const current = sleepByDay.get(day);
    if (!current || seconds(row.total_sleep_duration) > seconds(current.total_sleep_duration)) {
      sleepByDay.set(day, row);
    }
  }

  for (const row of sleepByDay.values()) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);

    daily.totalSleepHours = hours(row.total_sleep_duration);
    daily.timeInBedHours = hours(row.time_in_bed);
    daily.deepSleepHours = hours(row.deep_sleep_duration);
    daily.remSleepHours = hours(row.rem_sleep_duration);
    daily.awakeHours = hours(row.awake_time);
    daily.latencyMinutes = minutes(row.latency);
    daily.efficiency = numberOrNull(row.efficiency);
    daily.averageHeartRate = numberOrNull(row.average_heart_rate);
    daily.lowestHeartRate = numberOrNull(row.lowest_heart_rate);
    daily.averageHrv = numberOrNull(row.average_hrv);
    daily.averageBreath = numberOrNull(row.average_breath);
    daily.bedtimeStartHour = clockHour(row.bedtime_start, true);
    daily.wakeTimeHour = clockHour(row.bedtime_end, true);

    sleepHeartRates.push(...seriesItems(row.heart_rate));
    sleepHrvs.push(...seriesItems(row.hrv));
  }

  for (const row of data['dailyactivity.csv']) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);

    daily.activityScore = numberOrNull(row.score);
    daily.steps = numberOrNull(row.steps);
    daily.activeCalories = numberOrNull(row.active_calories);
    daily.totalCalories = numberOrNull(row.total_calories);
    daily.lowActivityHours = hours(row.low_activity_time);
    daily.mediumActivityHours = hours(row.medium_activity_time);
    daily.highActivityHours = hours(row.high_activity_time);
    daily.sedentaryHours = hours(row.sedentary_time);
    daily.restingHours = hours(row.resting_time);
  }

  for (const row of data['dailystress.csv']) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);
    daily.stressHighHours = hours(row.stress_high);
    daily.recoveryHighHours = hours(row.recovery_high);
    daily.stressSummary = row.day_summary || null;
  }

  for (const row of data['daytimestress.csv']) {
    const stress = numberOrNull(row.stress_value);
    if (stress !== null) daytimeStressScores.push(stress);
  }

  for (const row of data['dailyspo2.csv']) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);
    const spo2 = parseJson<{ average?: number }>(row.spo2_percentage);
    daily.spo2 = finiteOrNull(spo2?.average);
    daily.breathingDisturbanceIndex = numberOrNull(row.breathing_disturbance_index);
  }

  for (const row of data['dailycardiovascularage.csv']) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);
    daily.vascularAge = numberOrNull(row.vascular_age);
    daily.pulseWaveVelocity = numberOrNull(row.pulse_wave_velocity);
  }

  for (const row of data['dailysmoothedcardiovascularage.csv']) {
    const day = row.day;
    if (!day) continue;
    const daily = upsertDay(day);
    const age = numberOrNull(row.cardiovascular_age);
    const pulseWaveVelocity = numberOrNull(row.pulse_wave_velocity);
    if (age !== null) daily.cardiovascularAge = age;
    if (pulseWaveVelocity !== null) daily.pulseWaveVelocity = pulseWaveVelocity;
  }

  for (const row of data['vo2max.csv']) {
    const day = row.day;
    if (!day) continue;
    upsertDay(day).vo2Max = numberOrNull(row.vo2_max);
  }

  const heartRateDaily = new Map<string, Record<'awake' | 'workout' | 'rest', { sum: number; count: number }>>();
  for (const row of data['heartrate.csv']) {
    const bpm = numberOrNull(row.bpm);
    const source = row.source as 'awake' | 'workout' | 'rest' | undefined;
    const day = row.timestamp?.slice(0, 10);
    if (bpm === null || !source || !day || !(source in heartRateBySource)) continue;

    heartRateBySource[source].push(bpm);
    const bucket = heartRateDaily.get(day) ?? {
      awake: { sum: 0, count: 0 },
      workout: { sum: 0, count: 0 },
      rest: { sum: 0, count: 0 }
    };
    bucket[source].sum += bpm;
    bucket[source].count += 1;
    heartRateDaily.set(day, bucket);
  }

  for (const [day, buckets] of heartRateDaily) {
    const daily = upsertDay(day);
    daily.awakeHeartRate = averageFromBucket(buckets.awake);
    daily.workoutHeartRate = averageFromBucket(buckets.workout);
    daily.restHeartRate = averageFromBucket(buckets.rest);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day)).map(roundDaily);
  const averages = buildAverages(daily);
  const range = {
    start: daily[0]?.day ?? null,
    end: daily.at(-1)?.day ?? null,
    days: daily.length
  };

  const summary: OuraSummary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      name: options.sourceName ?? 'Oura export',
      rowCounts
    },
    range,
    averages,
    daily,
    distributions: {
      sleepHeartRate: histogram(sleepHeartRates, 2),
      sleepHrv: histogram(sleepHrvs, 5),
      awakeHeartRate: histogram(heartRateBySource.awake, 2),
      workoutHeartRate: histogram(heartRateBySource.workout, 2),
      restHeartRate: histogram(heartRateBySource.rest, 5),
      daytimeStress: histogram(daytimeStressScores, 10, 0, 100)
    },
    insights: buildInsights(daily, averages),
    counts: {
      filesFound: filesFound.length,
      sleepNights: sleepByDay.size,
      heartRateSamples: rowCounts['heartrate.csv'] ?? 0,
      daytimeStressSamples: rowCounts['daytimestress.csv'] ?? 0,
      ignoredPrivacyFiles: IGNORED_PRIVACY_FILES
    },
    filesFound,
    privacyNotes: [
      'Dashboard analysis ignores raw location and subscription CSVs.',
      'Uploaded ZIP files are stored in R2 for the owning user path; chart data is served from a normalized summary JSON.',
      'This app is for personal trend exploration and is not medical advice.'
    ]
  };

  return summary;
}

function findFile(fileIndex: Map<string, JSZip.JSZipObject>, fileName: string) {
  const normalized = fileName.toLowerCase();
  return (
    fileIndex.get(`app data/${normalized}`) ??
    Array.from(fileIndex.entries()).find(([path]) => path.endsWith(`/${normalized}`) || path === normalized)?.[1]
  );
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function seconds(value: unknown) {
  return numberOrNull(value) ?? 0;
}

function hours(value: unknown) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : parsed / 3600;
}

function minutes(value: unknown) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : parsed / 60;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function averageFromBucket(bucket: { sum: number; count: number }) {
  return bucket.count > 0 ? bucket.sum / bucket.count : null;
}

function parseJson<T>(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function seriesItems(raw: string | undefined) {
  const parsed = parseJson<{ items?: Array<number | null> }>(raw);
  if (!Array.isArray(parsed?.items)) return [];
  return parsed.items.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function clockHour(raw: string | undefined, afterMidnightIsNextDay: boolean) {
  const match = raw?.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  let hour = Number(match[1]) + Number(match[2]) / 60;
  if (afterMidnightIsNextDay && hour < 12) hour += 24;
  return hour;
}

function histogram(values: number[], step: number, fixedMin?: number, fixedMax?: number): HistogramBin[] {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return [];

  const min = fixedMin ?? Math.floor(Math.min(...valid) / step) * step;
  const max = fixedMax ?? Math.ceil(Math.max(...valid) / step) * step;
  const bins: HistogramBin[] = [];

  for (let x0 = min; x0 < max; x0 += step) {
    bins.push({ x0, x1: x0 + step, count: 0 });
  }

  for (const value of valid) {
    const index = Math.min(Math.floor((value - min) / step), bins.length - 1);
    if (index >= 0) bins[index].count += 1;
  }

  return bins;
}

function buildAverages(daily: DailyMetric[]) {
  const averages = {
    sleepScore: average(daily.map((day) => day.sleepScore)),
    readinessScore: average(daily.map((day) => day.readinessScore)),
    activityScore: average(daily.map((day) => day.activityScore)),
    totalSleepHours: average(daily.map((day) => day.totalSleepHours)),
    timeInBedHours: average(daily.map((day) => day.timeInBedHours)),
    deepSleepHours: average(daily.map((day) => day.deepSleepHours)),
    remSleepHours: average(daily.map((day) => day.remSleepHours)),
    latencyMinutes: average(daily.map((day) => day.latencyMinutes)),
    efficiency: average(daily.map((day) => day.efficiency)),
    averageHeartRate: average(daily.map((day) => day.averageHeartRate)),
    lowestHeartRate: average(daily.map((day) => day.lowestHeartRate)),
    averageHrv: average(daily.map((day) => day.averageHrv)),
    averageBreath: average(daily.map((day) => day.averageBreath)),
    steps: average(daily.map((day) => day.steps)),
    activeCalories: average(daily.map((day) => day.activeCalories)),
    totalCalories: average(daily.map((day) => day.totalCalories)),
    restingHours: average(daily.map((day) => day.restingHours)),
    stressHighHours: average(daily.map((day) => day.stressHighHours)),
    recoveryHighHours: average(daily.map((day) => day.recoveryHighHours)),
    spo2: average(daily.map((day) => day.spo2)),
    breathingDisturbanceIndex: average(daily.map((day) => day.breathingDisturbanceIndex)),
    vascularAge: average(daily.map((day) => day.vascularAge)),
    pulseWaveVelocity: average(daily.map((day) => day.pulseWaveVelocity)),
    vo2Max: average(daily.map((day) => day.vo2Max)),
    awakeHeartRate: average(daily.map((day) => day.awakeHeartRate)),
    workoutHeartRate: average(daily.map((day) => day.workoutHeartRate)),
    restHeartRate: average(daily.map((day) => day.restHeartRate))
  };

  return Object.fromEntries(
    Object.entries(averages).map(([key, value]) => [key, roundNumber(value)])
  ) as OuraSummary['averages'];
}

function buildInsights(daily: DailyMetric[], averages: OuraSummary['averages']) {
  const stressCounts = countBy(daily.map((day) => day.stressSummary).filter(Boolean) as string[]);
  const hrvDelta = trendDelta(daily, 'averageHrv');
  const heartRateDelta = trendDelta(daily, 'averageHeartRate');
  const sleepDelta = trendDelta(daily, 'totalSleepHours');
  const stepsDelta = trendDelta(daily, 'steps');

  const insights: Record<SectionKey, OuraInsight[]> = {
    sleep: [
      {
        title: 'Sleep window',
        body: `Average sleep is ${format(averages.totalSleepHours, 1)}h inside ${format(
          averages.timeInBedHours,
          1
        )}h in bed, so about ${format(
          (averages.timeInBedHours ?? 0) - (averages.totalSleepHours ?? 0),
          1
        )}h is latency, waking, or low-confidence time.`
      },
      {
        title: 'Stage balance',
        body: `Deep sleep averages ${format(averages.deepSleepHours, 1)}h and REM averages ${format(
          averages.remSleepHours,
          1
        )}h. The referenced analysis treats 1.5h for each as a useful personal target rather than relying only on a composite score.`
      },
      {
        title: 'Recent direction',
        body: `Total sleep is ${direction(sleepDelta, 'up', 'down')} by ${format(Math.abs(sleepDelta ?? 0), 1)}h comparing the first and last two-week windows.`
      }
    ],
    heart: [
      {
        title: 'Night physiology',
        body: `Nightly heart rate averages ${format(averages.averageHeartRate, 1)} bpm with HRV around ${format(
          averages.averageHrv,
          0
        )} ms. The distribution view makes outliers and recovery nights easier to see than a single daily score.`
      },
      {
        title: 'Training signal',
        body: `HRV is ${direction(hrvDelta, 'higher', 'lower')} by ${format(Math.abs(hrvDelta ?? 0), 1)} ms while sleeping heart rate is ${direction(
          heartRateDelta,
          'higher',
          'lower'
        )} by ${format(Math.abs(heartRateDelta ?? 0), 1)} bpm across the same window.`
      },
      {
        title: 'Cardio context',
        body: `VO2 max averages ${format(averages.vo2Max, 1)} and pulse-wave velocity averages ${format(
          averages.pulseWaveVelocity,
          2
        )} m/s where present. Treat these as trend anchors, not diagnostic labels.`
      }
    ],
    activity: [
      {
        title: 'Baseline movement',
        body: `Daily steps average ${format(averages.steps, 0)} with ${format(
          averages.activeCalories,
          0
        )} active calories. A 7-day average is shown because day-to-day activity is spiky.`
      },
      {
        title: 'Recent direction',
        body: `Steps are ${direction(stepsDelta, 'up', 'down')} by ${format(Math.abs(stepsDelta ?? 0), 0)} comparing the first and last two-week windows.`
      },
      {
        title: 'Energy balance',
        body: `Total calories average ${format(averages.totalCalories, 0)} per day; active calories are only one slice of total daily expenditure.`
      }
    ],
    stress: [
      {
        title: 'Stress load',
        body: `High-stress time averages ${format(averages.stressHighHours, 1)}h per day and high-recovery time averages ${format(
          averages.recoveryHighHours,
          1
        )}h. This mirrors the source dashboard's focus on time in state rather than a black-box score.`
      },
      {
        title: 'Day labels',
        body: `The export labels ${stressCounts.normal ?? 0} normal days, ${stressCounts.stressful ?? 0} stressful days, and ${stressCounts.restored ?? 0} restored days.`
      },
      {
        title: 'Interpretation',
        body: 'Oura stress is best read as a pattern detector. Cross-check spikes against sleep, workouts, travel, and subjective context before changing behavior.'
      }
    ],
    oxygen: [
      {
        title: 'Oxygen saturation',
        body: `Average SpO2 is ${format(averages.spo2, 1)}%, which is shown alongside breathing disturbance rather than in isolation.`
      },
      {
        title: 'Breathing disturbance',
        body: `Breathing disturbance index averages ${format(
          averages.breathingDisturbanceIndex,
          1
        )}; the source analysis uses 5 as a practical threshold worth investigating.`
      },
      {
        title: 'Breath rate',
        body: `Night breathing rate averages ${format(averages.averageBreath, 1)} breaths/min, useful for spotting illness, altitude, or recovery changes.`
      }
    ]
  };

  return insights;
}

function trendDelta(daily: DailyMetric[], key: keyof DailyMetric) {
  const valid = daily.filter((day) => typeof day[key] === 'number');
  if (valid.length < 14) return null;
  const first = average(valid.slice(0, 14).map((day) => day[key] as number));
  const last = average(valid.slice(-14).map((day) => day[key] as number));
  if (first === null || last === null) return null;
  return last - first;
}

function direction(delta: number | null, positive: string, negative: string) {
  if (delta === null || Math.abs(delta) < 0.05) return 'flat';
  return delta > 0 ? positive : negative;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function roundDaily(day: DailyMetric): DailyMetric {
  return Object.fromEntries(
    Object.entries(day).map(([key, value]) => [key, typeof value === 'number' ? roundNumber(value) : value])
  ) as DailyMetric;
}

function roundNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function format(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}
