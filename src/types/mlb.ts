export type Locale = 'ja' | 'en';

export type LocalizedName = {
  en: string;
  ja: string;
};

export type MetricKey =
  // WAR family
  | 'fWAR' | 'bWAR' | 'rWAR'
  // Hitting
  | 'wRC+' | 'wOBA' | 'xwOBA' | 'Barrel%' | 'HardHit%' | 'OPS+' | 'OPS'
  // Pitching
  | 'FIP' | 'xFIP' | 'SIERA' | 'Stuff+' | 'Location+' | 'K-BB%'
  // Defense / Baserunning
  | 'OAA' | 'DRS' | 'UZR' | 'BsR' | 'SprintSpeed'
  // Clutch (high-leverage performance)
  | 'Clutch' | 'WPA';

export type Stats = Partial<Record<MetricKey, number | null>>;

export type Player = {
  id: string;
  name: LocalizedName;
  team: string;
  position: string;
  stats: Stats;
};

export type Team = {
  id: string;
  name: LocalizedName;
  abbr: string;
  league: 'AL' | 'NL';
  division: 'East' | 'Central' | 'West';
  wins?: number | null;
  losses?: number | null;
  runDiff?: number | null;
  stats: Stats;
};

export type SourceRef = {
  url: string;
  fetchedAt: string;
};

export type Meta = {
  updatedAt: string;
  sources: Partial<Record<MetricKey, SourceRef>>;
  notes?: string;
};

export type RankingFile<T> = {
  season: number;
  updatedAt: string;
  players?: T[];
  teams?: T[];
};
