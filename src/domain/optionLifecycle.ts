import type { FlexTrade } from "./types.js";

export const OPTION_LIFECYCLE_CODES = [
  "Ep",
  "Ex",
  "A",
  "CD",
  "AEx",
  "MEx",
  "GEA",
] as const;

export type OptionLifecycleCode = (typeof OPTION_LIFECYCLE_CODES)[number];

export interface OptionLifecycleCount {
  code: OptionLifecycleCode;
  count: number;
}

/**
 * Return whether an IBKR action code represents an option lifecycle event.
 */
export function isOptionLifecycleCode(
  code: string,
): code is OptionLifecycleCode {
  return (OPTION_LIFECYCLE_CODES as readonly string[]).includes(code);
}

/**
 * Extract normalized option lifecycle codes in a stable display order.
 */
export function optionLifecycleCodes(
  trade: Pick<FlexTrade, "actionCodes">,
): OptionLifecycleCode[] {
  return OPTION_LIFECYCLE_CODES.filter((code) =>
    trade.actionCodes.includes(code)
  );
}

/**
 * Count each lifecycle code across option trades.
 *
 * A trade can contribute to more than one code, such as exercise plus cash
 * settlement, because those codes describe distinct parts of the same event.
 */
export function summarizeOptionLifecycleCodes(
  trades: readonly Pick<FlexTrade, "actionCodes">[],
): OptionLifecycleCount[] {
  return OPTION_LIFECYCLE_CODES.flatMap((code) => {
    const count = trades.filter((trade) =>
      trade.actionCodes.includes(code)
    ).length;
    return count ? [{ code, count }] : [];
  });
}

/**
 * Count trades that contain at least one option lifecycle code.
 */
export function countOptionLifecycleTrades(
  trades: readonly Pick<FlexTrade, "actionCodes">[],
): number {
  return trades.filter((trade) => optionLifecycleCodes(trade).length > 0).length;
}
