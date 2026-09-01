export type MeasuredExchangeLimits = Readonly<{
  maxEnvelopeBytes: number;
  maxIndividualAssetBytes: number;
  maxCombinedAssetBytes: number;
  maxAssets: number;
  maxNestingDepth: number;
  maxCollectionEntries: number;
  maxEstimatedPeakBytes: number;
}>;

export const MEASURED_EXCHANGE_LIMITS: MeasuredExchangeLimits = Object.freeze({
  maxEnvelopeBytes: 20 * 1024 * 1024,
  maxIndividualAssetBytes: 6 * 1024 * 1024,
  maxCombinedAssetBytes: 12 * 1024 * 1024,
  maxAssets: 64,
  maxNestingDepth: 32,
  maxCollectionEntries: 50_000,
  maxEstimatedPeakBytes: 128 * 1024 * 1024
});
