
export enum Role {
  TOP = 'TOP',
  MID = 'MID',
  JUNGLE = 'JUNGLE',
  ADC = 'ADC',
  SUPPORT = 'SUPPORT'
}

export enum AxiomViolation {
  TEMPO_LEAK = 'TEMPO_LEAK',
  AXIOMATIC_DEFIANCE = 'AXIOMATIC_DEFIANCE',
  ECONOMIC_INERTIA = 'ECONOMIC_INERTIA',
  SPITE_FAILURE = 'SPITE_FAILURE',
  TAX_ON_STUPIDITY = 'TAX_ON_STUPIDITY'
}

export interface MetricPoint {
  label: string;
  value: string | number;
  sub: string;
  color?: string;
  description?: string;
}

export interface FrictionEvent {
  timestampSeconds: number;
  frameIndex: number;
  description: string;
  axiomViolation: AxiomViolation;
}

export interface Item {
  id: string;
  name: string;
  cost: number;
  stats: {
    ad?: number;
    ap?: number;
    armor?: number;
    mr?: number;
    hp?: number;
    ah?: number;
    mana?: number;
    as?: number;
    crit?: number;
    ms_flat?: number;
    ms_percent?: number;
    hsp?: number;
  };
  passiveValue: number;
  description: string;
  isRift: boolean;
  isARAM: boolean;
}

export interface Champion {
  name: string;
  role: Role;
  baseBuild: string[];
}

export interface VideoTelemetry {
  championName: string;
  role: Role;
  cr_observed: number;
  t_build_estimate: number;
  mu_counter: number;
  lane_leakage: number;
  spite_score: number;
  frictionEvents: FrictionEvent[];
  alternativeItems: {
    mistakenItem: string;
    superiorItem: string;
    rgeIncrease: number;
    reasoning: string;
  }[];
}

export type AxiomView = 'INITIALIZE' | 'RIOT_SYNC' | 'TREND_REPORT' | 'UPLOAD_PENDING' | 'INGESTION' | 'DEBRIEF';

export interface AxiomState {
  view: AxiomView;
  isAnalyzing: boolean;
  loadingMessage: string;
  terminalLog: string[];
}
