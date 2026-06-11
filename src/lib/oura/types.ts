export type SectionKey = 'sleep' | 'heart' | 'activity' | 'stress' | 'oxygen';

export type DailyMetric = {
  day: string;
  sleepScore?: number | null;
  readinessScore?: number | null;
  activityScore?: number | null;
  resilienceLevel?: string | null;
  totalSleepHours?: number | null;
  timeInBedHours?: number | null;
  deepSleepHours?: number | null;
  remSleepHours?: number | null;
  awakeHours?: number | null;
  latencyMinutes?: number | null;
  efficiency?: number | null;
  averageHeartRate?: number | null;
  lowestHeartRate?: number | null;
  averageHrv?: number | null;
  averageBreath?: number | null;
  bedtimeStartHour?: number | null;
  wakeTimeHour?: number | null;
  steps?: number | null;
  activeCalories?: number | null;
  totalCalories?: number | null;
  lowActivityHours?: number | null;
  mediumActivityHours?: number | null;
  highActivityHours?: number | null;
  sedentaryHours?: number | null;
  stressHighHours?: number | null;
  recoveryHighHours?: number | null;
  stressSummary?: string | null;
  spo2?: number | null;
  breathingDisturbanceIndex?: number | null;
  vascularAge?: number | null;
  cardiovascularAge?: number | null;
  pulseWaveVelocity?: number | null;
  vo2Max?: number | null;
  temperatureDeviation?: number | null;
  awakeHeartRate?: number | null;
  workoutHeartRate?: number | null;
  restHeartRate?: number | null;
};

export type HistogramBin = {
  x0: number;
  x1: number;
  count: number;
};

export type OuraInsight = {
  title: string;
  body: string;
};

export type OuraAverages = {
  sleepScore?: number | null;
  readinessScore?: number | null;
  activityScore?: number | null;
  totalSleepHours?: number | null;
  timeInBedHours?: number | null;
  deepSleepHours?: number | null;
  remSleepHours?: number | null;
  latencyMinutes?: number | null;
  efficiency?: number | null;
  averageHeartRate?: number | null;
  lowestHeartRate?: number | null;
  averageHrv?: number | null;
  averageBreath?: number | null;
  steps?: number | null;
  activeCalories?: number | null;
  totalCalories?: number | null;
  stressHighHours?: number | null;
  recoveryHighHours?: number | null;
  spo2?: number | null;
  breathingDisturbanceIndex?: number | null;
  vascularAge?: number | null;
  pulseWaveVelocity?: number | null;
  vo2Max?: number | null;
  awakeHeartRate?: number | null;
  workoutHeartRate?: number | null;
  restHeartRate?: number | null;
};

export type OuraSummary = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    name: string;
    rowCounts: Record<string, number>;
  };
  range: {
    start: string | null;
    end: string | null;
    days: number;
  };
  averages: OuraAverages;
  daily: DailyMetric[];
  distributions: {
    sleepHeartRate: HistogramBin[];
    sleepHrv: HistogramBin[];
    awakeHeartRate: HistogramBin[];
    workoutHeartRate: HistogramBin[];
    restHeartRate: HistogramBin[];
    daytimeStress: HistogramBin[];
  };
  insights: Record<SectionKey, OuraInsight[]>;
  counts: {
    filesFound: number;
    sleepNights: number;
    heartRateSamples: number;
    daytimeStressSamples: number;
    ignoredPrivacyFiles: string[];
  };
  filesFound: string[];
  storage?: {
    userId: string;
    uploadId: string;
    rawZipKey: string;
    summaryKey: string;
    uploadedAt: string;
  };
  privacyNotes: string[];
};
