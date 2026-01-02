
export enum Role {
  TOP = 'TOP',
  MID = 'MID',
  JUNGLE = 'JUNGLE',
  ADC = 'ADC',
  SUPPORT = 'SUPPORT'
}

export enum EnemyThreshold {
  SQUISHY = 'SQUISHY', 
  BRUISER = 'BRUISER', 
  TANK = 'TANK'       
}

export interface ItemStat {
  ad?: number;
  ap?: number;
  hp?: number;
  armor?: number;
  mr?: number;
  ah?: number;
  mana?: number;
  as?: number;
  crit?: number;
  ms_flat?: number;
  ms_percent?: number;
  hsp?: number;
}

export interface Item {
  id: string;
  name: string;
  cost: number;
  stats: ItemStat;
  passiveValue?: number;
  description: string;
  isRift: boolean;
  isARAM: boolean;
}

export interface Champion {
  name: string;
  role: Role;
  baseBuild: string[];
}

export interface FrictionEvent {
  timestampSeconds: number; 
  frameIndex?: number;      
  gameClock?: string;       
  description: string;
  axiomViolation: string;
  screenshot?: string;      
}

export interface VideoTelemetry {
  championName: string;
  role: Role;
  cr_observed: number; // Coefficient of Realized Gold (0.0 - 1.0)
  t_build_estimate: number; // Minute mark for current item completion
  mu_counter: number; // Spite/Counter Multiplier observed
  frictionEvents: FrictionEvent[];
  mathMetrics: {
    rgeEstimate: number;
    velocityHz: number;
    frictionCoefficient: number;
    goldHoarded: number;
    spiteScore: number;
    laneLeakage: number; // Gold lost to travel velocity (22s/32s rule)
  };
  alternativeItems: {
    mistakenItem: string;
    superiorItem: string;
    rgeIncrease: number;
    reasoning: string;
  }[];
}

export interface AxiomState {
  currentGold: number;
  cr: number;
  laneVelocity: number;
  enemyDefensiveState: EnemyThreshold;
  selectedChampion: Champion | null;
  isAnalyzing: boolean;
  view: 'UPLOAD' | 'AUDIT';
}
