export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type CropKey =
  | 'apple'
  | 'grape'
  | 'coffee'
  | 'pear'
  | 'olive';

export type FuzzyRule = {
  humLo: number;
  humHi: number;
  tempLo: number;
  tempHi: number;
  rainMin: number;
  riskLevel: RiskLevel;
};

export type BioParams = {
  tBase: number;
  tLethalMin: number;
  tLethalMax: number;
  tOptimalMin: number;
  tOptimalMax: number;
  minStreak: number;
  minWetnessHoursCritical: number;
  minWetnessHoursHigh: number;
  phenoFracLo?: number;
  phenoFracHi?: number;
  phenoFractionRefGdd5?: number;
};

export type ThreatDefinition = {
  scientificName: string;
  commonName: string;
  displayNameTr: string;
  threatType: string;
  crop: CropKey;
  bio: BioParams;
  rules: FuzzyRule[];
  specializedModel?: 'grape_powdery_ucipm';
};

export const RISK_SCORES: Record<RiskLevel, number> = {
  low: 10,
  moderate: 40,
  high: 80,
  critical: 100,
};

export const RISK_LABELS_TR: Record<RiskLevel, string> = {
  low: 'Düşük',
  moderate: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};

export const CROP_ALIASES: Record<string, CropKey> = {
  apple: 'apple',
  elma: 'apple',
  grape: 'grape',
  üzüm: 'grape',
  uzum: 'grape',
  bağ: 'grape',
  bag: 'grape',
  bağcılık: 'grape',
  bagcilik: 'grape',
  coffee: 'coffee',
  kahve: 'coffee',
  pear: 'pear',
  armut: 'pear',
  olive: 'olive',
  zeytin: 'olive',
};

export const SUPPORTED_CROP_LABELS_TR = [
  'Elma',
  'Üzüm/Bağ',
  'Kahve',
  'Armut',
  'Zeytin',
] as const;

export const PERENNIAL_CROPS = new Set<CropKey>([
  'apple',
  'grape',
  'coffee',
  'pear',
  'olive',
]);

export const THREATS: ThreatDefinition[] = [
  {
    scientificName: 'Venturia inaequalis',
    commonName: 'Apple scab',
    displayNameTr: 'Elma karalekesi',
    threatType: 'fungus',
    crop: 'apple',
    bio: {
      tBase: 0,
      tLethalMin: -5,
      tLethalMax: 40,
      tOptimalMin: 15,
      tOptimalMax: 24,
      minStreak: 3,
      minWetnessHoursCritical: 20,
      minWetnessHoursHigh: 14,
      phenoFracLo: 0.05,
      phenoFracHi: 0.65,
      phenoFractionRefGdd5: 2200,
    },
    rules: [
      { humLo: 90, humHi: 100, tempLo: 15, tempHi: 24, rainMin: 2, riskLevel: 'critical' },
      { humLo: 80, humHi: 100, tempLo: 10, tempHi: 28, rainMin: 1, riskLevel: 'high' },
      { humLo: 70, humHi: 90, tempLo: 6, tempHi: 30, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 70, tempLo: 0, tempHi: 35, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Cydia pomonella',
    commonName: 'Codling moth',
    displayNameTr: 'Elma içkurdu',
    threatType: 'insect',
    crop: 'apple',
    bio: {
      tBase: 10,
      tLethalMin: -10,
      tLethalMax: 40,
      tOptimalMin: 20,
      tOptimalMax: 31,
      minStreak: 2,
      minWetnessHoursCritical: 24,
      minWetnessHoursHigh: 24,
    },
    rules: [
      { humLo: 50, humHi: 100, tempLo: 20, tempHi: 31, rainMin: 0, riskLevel: 'critical' },
      { humLo: 40, humHi: 100, tempLo: 15, tempHi: 33, rainMin: 0, riskLevel: 'high' },
      { humLo: 30, humHi: 100, tempLo: 10, tempHi: 35, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 100, tempLo: 0, tempHi: 40, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Plasmopora viticola',
    commonName: 'Downy mildew',
    displayNameTr: 'Bağ mildiyösü',
    threatType: 'oomycete',
    crop: 'grape',
    bio: {
      tBase: 10,
      tLethalMin: -3,
      tLethalMax: 38,
      tOptimalMin: 18,
      tOptimalMax: 25,
      minStreak: 3,
      minWetnessHoursCritical: 16,
      minWetnessHoursHigh: 10,
      phenoFracLo: 0.1,
      phenoFracHi: 0.75,
      phenoFractionRefGdd5: 2200,
    },
    rules: [
      { humLo: 90, humHi: 100, tempLo: 18, tempHi: 25, rainMin: 10, riskLevel: 'critical' },
      { humLo: 80, humHi: 100, tempLo: 13, tempHi: 30, rainMin: 5, riskLevel: 'high' },
      { humLo: 65, humHi: 90, tempLo: 10, tempHi: 32, rainMin: 1, riskLevel: 'moderate' },
      { humLo: 0, humHi: 65, tempLo: 0, tempHi: 38, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Uncinula necator',
    commonName: 'Powdery mildew',
    displayNameTr: 'Bağ küllemesi',
    threatType: 'fungus',
    crop: 'grape',
    specializedModel: 'grape_powdery_ucipm',
    bio: {
      tBase: 6,
      tLethalMin: -3,
      tLethalMax: 40,
      tOptimalMin: 20,
      tOptimalMax: 28,
      minStreak: 3,
      minWetnessHoursCritical: 24,
      minWetnessHoursHigh: 24,
      phenoFracLo: 0.1,
      phenoFracHi: 0.8,
      phenoFractionRefGdd5: 2200,
    },
    rules: [
      { humLo: 40, humHi: 85, tempLo: 20, tempHi: 28, rainMin: 0, riskLevel: 'critical' },
      { humLo: 30, humHi: 90, tempLo: 15, tempHi: 32, rainMin: 0, riskLevel: 'high' },
      { humLo: 20, humHi: 95, tempLo: 10, tempHi: 35, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 100, tempLo: 0, tempHi: 40, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Botrytis cinerea',
    commonName: 'Grey mold',
    displayNameTr: 'Kurşuni küf',
    threatType: 'fungus',
    crop: 'grape',
    bio: {
      tBase: 0,
      tLethalMin: -5,
      tLethalMax: 35,
      tOptimalMin: 15,
      tOptimalMax: 25,
      minStreak: 3,
      minWetnessHoursCritical: 15,
      minWetnessHoursHigh: 10,
      phenoFracLo: 0.4,
      phenoFracHi: 0.95,
      phenoFractionRefGdd5: 2200,
    },
    rules: [
      { humLo: 90, humHi: 100, tempLo: 15, tempHi: 25, rainMin: 5, riskLevel: 'critical' },
      { humLo: 80, humHi: 100, tempLo: 10, tempHi: 28, rainMin: 2, riskLevel: 'high' },
      { humLo: 65, humHi: 90, tempLo: 5, tempHi: 30, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 65, tempLo: 0, tempHi: 35, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Hemileia vastatrix',
    commonName: 'Coffee leaf rust',
    displayNameTr: 'Kahve yaprak pası',
    threatType: 'fungus',
    crop: 'coffee',
    bio: {
      tBase: 10,
      tLethalMin: 0,
      tLethalMax: 35,
      tOptimalMin: 20,
      tOptimalMax: 28,
      minStreak: 5,
      minWetnessHoursCritical: 24,
      minWetnessHoursHigh: 18,
      phenoFracLo: 0.15,
      phenoFracHi: 0.85,
      phenoFractionRefGdd5: 2400,
    },
    rules: [
      { humLo: 90, humHi: 100, tempLo: 20, tempHi: 28, rainMin: 5, riskLevel: 'critical' },
      { humLo: 80, humHi: 100, tempLo: 16, tempHi: 30, rainMin: 2, riskLevel: 'high' },
      { humLo: 65, humHi: 90, tempLo: 12, tempHi: 32, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 65, tempLo: 0, tempHi: 35, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Erwinia amylovora',
    commonName: 'Fire blight',
    displayNameTr: 'Ateş yanıklığı',
    threatType: 'bacterium',
    crop: 'pear',
    bio: {
      tBase: 12.7,
      tLethalMin: -5,
      tLethalMax: 40,
      tOptimalMin: 24,
      tOptimalMax: 29,
      minStreak: 2,
      minWetnessHoursCritical: 12,
      minWetnessHoursHigh: 8,
      phenoFracLo: 0.08,
      phenoFracHi: 0.35,
      phenoFractionRefGdd5: 2200,
    },
    rules: [
      { humLo: 85, humHi: 100, tempLo: 24, tempHi: 29, rainMin: 2, riskLevel: 'critical' },
      { humLo: 75, humHi: 100, tempLo: 18, tempHi: 33, rainMin: 0.5, riskLevel: 'high' },
      { humLo: 60, humHi: 85, tempLo: 13, tempHi: 35, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 60, tempLo: 0, tempHi: 40, rainMin: 0, riskLevel: 'low' },
    ],
  },
  {
    scientificName: 'Bactrocera oleae',
    commonName: 'Olive fly',
    displayNameTr: 'Zeytin sineği',
    threatType: 'insect',
    crop: 'olive',
    bio: {
      tBase: 9,
      tLethalMin: -5,
      tLethalMax: 42,
      tOptimalMin: 20,
      tOptimalMax: 30,
      minStreak: 2,
      minWetnessHoursCritical: 24,
      minWetnessHoursHigh: 24,
      phenoFracLo: 0.3,
      phenoFracHi: 0.9,
      phenoFractionRefGdd5: 2400,
    },
    rules: [
      { humLo: 60, humHi: 100, tempLo: 20, tempHi: 30, rainMin: 0, riskLevel: 'critical' },
      { humLo: 50, humHi: 100, tempLo: 15, tempHi: 33, rainMin: 0, riskLevel: 'high' },
      { humLo: 35, humHi: 100, tempLo: 10, tempHi: 36, rainMin: 0, riskLevel: 'moderate' },
      { humLo: 0, humHi: 100, tempLo: 0, tempHi: 42, rainMin: 0, riskLevel: 'low' },
    ],
  },
];

export const PATHOGEN_GENERA = [
  'venturia',
  'plasmopora',
  'plasmopara',
  'uncinula',
  'erysiphe',
  'botrytis',
  'monilia',
  'monilinia',
  'taphrina',
  'erwinia',
  'guignardia',
  'phomopsis',
  'colletotrichum',
  'pseudomonas',
  'pseudocercospora',
  'alternaria',
  'hemileia',
  'phytophthora',
  'moniliophthora',
  'oidium',
] as const;
