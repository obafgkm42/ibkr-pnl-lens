import type { AdviceSignalId } from "../advice.js";

export type Locale = "zh-Hant" | "zh-Hans" | "en" | "ja" | "ko" | "es" | "de" | "fr" | "ru" | "fi";

export interface LocaleOption {
  code: Locale;
  label: string;
}

export const localeOptions: LocaleOption[] = [
  { code: "zh-Hant", label: "繁中" },
  { code: "zh-Hans", label: "简中" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "ru", label: "Русский" },
  { code: "fi", label: "Suomi" },
];

export const baseTranslationKeys = [
  "eyebrow",
  "title",
  "uploadMark",
  "uploadTitle",
  "uploadBody",
  "nfaDisclaimer",
  "chooseFile",
  "account",
  "name",
  "neutralName",
  "period",
  "baseCurrency",
  "closed",
  "executions",
  "netRealized",
  "profitFactor",
  "winRate",
  "payoffRatio",
  "expectancy",
  "executionRecords",
  "canceledOrders",
  "medianHoldingDays",
  "commissionDrag",
  "closedTradeSum",
  "grossProfitLoss",
  "averageWinLoss",
  "perClosedTrade",
  "flexTradeRecords",
  "flexCanceledRecords",
  "noCanceledRecords",
  "holdingReview",
  "holdingReviewTitle",
  "holdingReviewHint",
  "holdingPeriod",
  "holdingIntraday",
  "holdingSwing",
  "holdingPosition",
  "holdingLongTerm",
  "directionReview",
  "directionReviewTitle",
  "directionReviewHint",
  "longPosition",
  "shortPosition",
  "neutralPosition",
  "equityCurve",
  "dailyRealized",
  "payoff",
  "winLossDistribution",
  "periodPerformance",
  "periodHint",
  "weekly",
  "monthly",
  "periodColumn",
  "monthColumn",
  "realized",
  "pf",
  "payoffShort",
  "trades",
  "assetBreakdown",
  "assetBreakdownTitle",
  "asset",
  "medianPnl",
  "average",
  "optionReview",
  "optionReviewTitle",
  "underlying",
  "date",
  "dateCount",
  "daysShort",
  "hoursShort",
  "minutesShort",
  "weakestSession",
  "intradaySessionNoData",
  "intradaySessionTitle",
  "intradaySessionHint",
  "weekdayReviewTitle",
  "weekdayReviewHint",
  "weekday",
  "weekdaySunday",
  "weekdayMonday",
  "weekdayTuesday",
  "weekdayWednesday",
  "weekdayThursday",
  "weekdayFriday",
  "weekdaySaturday",
  "bestDay",
  "worstDay",
  "session",
  "sessionMorning",
  "sessionMidday",
  "sessionLate",
  "autoExpiry",
  "optionLifecycle",
  "optionLifecycleRegularClose",
  "optionLifecycleEp",
  "optionLifecycleEx",
  "optionLifecycleA",
  "optionLifecycleCD",
  "optionLifecycleAEx",
  "optionLifecycleMEx",
  "optionLifecycleGEA",
  "discipline",
  "disciplineRisk",
  "largeLossAlert",
  "largeLossDiscipline",
  "largeLossRule",
  "worstLossDay",
  "symbols",
  "symbolPerformance",
  "page",
  "previousPage",
  "nextPage",
  "offlineCoach",
  "offlineAdvice",
  "bestLoserWins",
  "theme",
  "language",
  "dark",
  "light",
  "stock",
  "option",
  "other",
  "cash",
  "future",
  "unknown",
  "lossBucketSmall",
  "lossBucketMedium",
  "lossBucketLarge",
  "winBucketSmall",
  "winBucketMedium",
  "winBucketLarge",
  "chartEmpty",
  "dailyChartLegend",
  "periodChartLegend",
  "importFailed",
  "profitStatus",
  "lossStatus",
  "flatStatus",
  "costStatus",
  "toggleDetails",
  "error.invalid_flex_xml",
] as const;

export const adviceSignalIds = [
  "profit_factor_below_one",
  "profit_factor_thin_edge",
  "profit_factor_healthy",
  "winrate_and_payoff_weak",
  "high_winrate_weak_payoff",
  "overtrade_loss_days",
  "auto_expiry_losses",
  "good_loser_base",
  "detach_outcome_from_ego",
  "large_tail_losses",
  "asset_group_relative_edge",
  "option_sample_dominant",
  "stock_sample_dominant",
  "weak_option_underlying_days",
  "clean_sample",
] as const satisfies readonly AdviceSignalId[];

export type BaseTranslationKey = (typeof baseTranslationKeys)[number];
export type AdviceTranslationKey = `advice.${AdviceSignalId}.${"title" | "body"}`;
export type TranslationKey = BaseTranslationKey | AdviceTranslationKey;
export type Translations = Record<TranslationKey, string>;

export const adviceTranslationKeys = adviceSignalIds.flatMap((id) => [
  `advice.${id}.title`,
  `advice.${id}.body`,
] as const) satisfies readonly AdviceTranslationKey[];

export const translationKeys = [
  ...baseTranslationKeys,
  ...adviceTranslationKeys,
] as const satisfies readonly TranslationKey[];

export const messageFunctionKeys = [
  "tradeCountSummary",
  "accountOptionLabel",
  "pageStatus",
  "periodTitle",
  "datePlusCount",
  "holdingSampleSummary",
  "importError",
  "adviceWeakOptionRows",
] as const;

export type MessageFunctionKey = (typeof messageFunctionKeys)[number];

export interface MessageParams {
  tradeCountSummary: { closed: number; executions: number };
  accountOptionLabel: { account: string; trades: number };
  pageStatus: { page: number; pageCount: number };
  periodTitle: { period: "weekly" | "monthly" };
  datePlusCount: { date: string; count: number };
  holdingSampleSummary: { count: number };
  importError: { message: string };
  adviceWeakOptionRows: { rows: Array<{ underlying: string; day: string; profitFactor: number }> };
}
