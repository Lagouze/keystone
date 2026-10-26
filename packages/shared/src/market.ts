/** Read-only advisor, independent of sessions and simulated token prices. */
export type MarketMetricId = 'vix' | 'sovereignVol' | 'euribor3m' | 'sovereign2y' | 'estr';
export interface MarketMetric {
  id: MarketMetricId;
  name: string;
  value: string | null;
  unit: string;
  observedAt: string | null;
  retrievedAt: string | null;
  source: { name: string; url: string; series: string };
  frequency: 'daily close' | 'daily' | 'monthly average';
  delivery: 'source' | 'cache' | 'unavailable' | 'restricted';
  freshness: 'current' | 'stale' | 'unknown';
  note: string;
  calculation?: { method: string; start: string; end: string; observations: number };
}
export type AdvisorCriterion = 'duration' | 'stability' | 'liquidity' | 'yield' | 'valuation';
export type AdvisorWeights = Record<AdvisorCriterion, number>;
export interface MarketAdvice {
  outcome: 'KMMF potentially preferable' | 'KBOND potentially preferable' | 'No clear preference' | 'Insufficient market data';
  explanation: string;
  scores: { KMMF: number; KBOND: number } | null;
  weights: AdvisorWeights;
  criteria: { id: AdvisorCriterion; label: string; weight: number; KMMF: number; KBOND: number; explanation: string; metrics: MarketMetricId[] }[];
  limits: string[];
}
export interface MarketSnapshot {
  asOf: string;
  metrics: MarketMetric[];
  advice: MarketAdvice;
}
