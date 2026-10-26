import type { AdvisorCriterion, AdvisorWeights, MarketAdvice, MarketMetric, MarketMetricId } from '@keystone/shared';

export const DEFAULT_WEIGHTS: AdvisorWeights = { duration: 35, stability: 20, liquidity: 10, yield: 25, valuation: 10 };
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 100) / 100;
export const ADVISOR_LIMITS = [
  'Indicative class comparison, not investment advice or a forecast. Weights and thresholds are demo heuristics, not calibrated risk estimates.',
  'Assumes a short-duration EUR money market fund and a two-year EUR sovereign bond held as collateral. Holdings, credit quality, fees, redemption gates and market depth are unknown; liquidity is scored neutral.',
  'The euro sovereign reference is a fitted AAA spot yield with continuous compounding, not a traded bond price or coupon. Comparing it with monthly Euribor and overnight €STR is an approximate yield environment comparison, not a total return estimate.',
  'Realized yield volatility looks backward over 20 daily changes. It is neither implied volatility nor the ICE MOVE index. VIX is only a secondary US equity stress flag, never a direct bond risk measure.',
  'KMMF and KBOND are fictitious Testnet tokens with identical simulated prices and haircuts. No token-specific NAV, liquidity, custody, legal or collateral risk is measured. No Etherfuse integration.',
];

export function scoreMarket(metrics: MarketMetric[], weights: AdvisorWeights = DEFAULT_WEIGHTS): MarketAdvice {
  const keys = Object.keys(DEFAULT_WEIGHTS) as AdvisorCriterion[];
  const totalWeight = keys.reduce((s, k) => s + weights[k], 0);
  if (keys.some((k) => !Number.isFinite(weights[k]) || weights[k] < 0) || !Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error('Advisor weights must be finite, nonnegative and have a positive total');
  }
  const usable = (id: MarketMetricId) => metrics.find((m) => m.id === id && m.freshness === 'current'
    && (m.delivery === 'source' || m.delivery === 'cache') && m.value !== null && m.value.trim() !== '' && Number.isFinite(Number(m.value)));
  const required: MarketMetricId[] = ['sovereignVol', 'euribor3m', 'sovereign2y', 'estr'];
  const missing = required.filter((id) => !usable(id));
  if (missing.length) return { outcome: 'Insufficient market data', explanation: `Fresh core indicators are missing: ${missing.join(', ')}. Stale values are shown for context but excluded from scoring.`, scores: null, weights: { ...weights }, criteria: [], limits: [...ADVISOR_LIMITS] };
  const value = (id: MarketMetricId) => Number(usable(id)!.value);
  // 3 bp/day or less: calm; 12 bp/day or more: high realized rate volatility.
  const stress = clamp((value('sovereignVol') - 3) / 9);
  const spread = value('sovereign2y') - (value('euribor3m') + value('estr')) / 2;
  const yieldTilt = clamp(spread / 0.75, -1, 1);
  const vix = usable('vix');
  const equityStress = vix ? clamp((Number(vix.value) - 20) / 20) : 0;
  const criteria: MarketAdvice['criteria'] = [
    { id: 'duration', label: 'Rate / duration sensitivity', weight: weights.duration, KMMF: 80, KBOND: round(80 - 60 * stress), explanation: 'Short duration is less sensitive to rate repricing. Two-year bond sensitivity is penalized only as realized yield volatility rises from 3 to 12 bp/day.', metrics: ['sovereignVol'] },
    { id: 'stability', label: 'Indicative valuation stability', weight: weights.stability, KMMF: 75, KBOND: round(75 - 50 * stress), explanation: 'The same backward-looking rate proxy informs indicative mark-to-market stability; this overlaps with duration and is not an independent observation. Fund NAV and credit risks are unmeasured.', metrics: ['sovereignVol'] },
    { id: 'liquidity', label: 'Liquidity (unmeasured)', weight: weights.liquidity, KMMF: 50, KBOND: 50, explanation: 'No order-book or redemption data. Both classes receive a neutral score; no claim that either is more liquid.', metrics: [] },
    { id: 'yield', label: 'Yield environment', weight: weights.yield, KMMF: round(50 - 50 * yieldTilt), KBOND: round(50 + 50 * yieldTilt), explanation: `AAA two-year yield minus the mean of Euribor 3M and €STR: ${spread.toFixed(3)} percentage points. The tilt saturates at ±0.75 pp; it is not a token yield.`, metrics: ['sovereign2y', 'euribor3m', 'estr'] },
    { id: 'valuation', label: 'Collateral valuation uncertainty', weight: weights.valuation, KMMF: round(50 - 5 * equityStress), KBOND: round(50 - 20 * stress - 10 * equityStress), explanation: vix ? 'Rate volatility and a small secondary equity stress penalty; VIX can change the final score gap by at most 0.5 points at default weights.' : 'Only the sovereign rate proxy is used. VIX is unavailable and has no contribution; legal, custody and token-specific risks remain unknown.', metrics: vix ? ['sovereignVol', 'vix'] : ['sovereignVol'] },
  ];
  const scores = { KMMF: round(criteria.reduce((s, c) => s + c.KMMF * (c.weight / totalWeight), 0)), KBOND: round(criteria.reduce((s, c) => s + c.KBOND * (c.weight / totalWeight), 0)) };
  const gap = scores.KMMF - scores.KBOND;
  const outcome = Math.abs(gap) < 8 ? 'No clear preference' : gap > 0 ? 'KMMF potentially preferable' : 'KBOND potentially preferable';
  return { outcome, explanation: outcome === 'No clear preference' ? 'The weighted score gap is below 8 points. Available evidence does not support a clear class preference.'
    : gap > 0 ? 'Under these assumptions, shorter duration outweighs the indicative sovereign yield advantage.' : 'Under these assumptions, the indicative sovereign yield advantage outweighs the observed rate sensitivity penalty.', scores, weights: { ...weights }, criteria, limits: [...ADVISOR_LIMITS] };
}
