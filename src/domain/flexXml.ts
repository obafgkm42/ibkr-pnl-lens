import type { DomainErrorCode, FlexOrder, FlexTrade, StatementAccountSummary, StatementProfile } from "./types.js";

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode) {
    super(code);
    this.name = "DomainError";
  }
}

export interface FlexXmlParseResult {
  profile: StatementProfile;
  accounts: StatementAccountSummary[];
  selectedAccountIndex: number;
  trades: FlexTrade[];
  executionCount: number;
  orders: FlexOrder[];
}

export function parseFlexXml(text: string, selectedAccountIndex = 0): FlexXmlParseResult {
  if (!looksLikeXml(text)) throw new DomainError("invalid_flex_xml");

  const statements = extractStatementBlocks(text);
  const selected = statements[Math.min(Math.max(selectedAccountIndex, 0), statements.length - 1)] || statements[0] || buildGlobalStatement(text);
  const tradeRows = extractTagAttrs(selected.content, "Trade");
  const optionEventRows = extractTagAttrs(selected.content, "OptionEAE")
    .filter(isOptionLifecycleRow);
  const orders = extractTagAttrs(selected.content, "Order") as FlexOrder[];
  const reconciledTrades = reconcileOptionEvents(
    tradeRows.map(normalizeFlexTrade),
    optionEventRows.map(normalizeOptionEvent),
  );
  const trades = applyMatchedRealizedPnl(
    reconciledTrades.trades,
    reconciledTrades.reportedPnlTrades,
  );
  const accountId = selected.attrs.accountId || "";
  const currency = tradeRows.find((row) => row.currency)?.currency
    || optionEventRows.find((row) => row.currency)?.currency
    || "USD";

  return {
    profile: {
      accountId,
      maskedAccountId: maskAccount(accountId),
      period: formatFlexPeriod(selected.attrs.fromDate, selected.attrs.toDate),
      baseCurrency: currency,
    },
    accounts: statements.map(statementSummary),
    selectedAccountIndex: selected.index,
    trades,
    executionCount: tradeRows.length,
    orders,
  };
}

interface StatementBlock {
  index: number;
  attrs: Record<string, string>;
  content: string;
}

function extractStatementBlocks(text: string): StatementBlock[] {
  const pattern = /<FlexStatement\b([^>]*)>([\s\S]*?)<\/FlexStatement>/g;
  const statements: StatementBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    statements.push({
      index: statements.length,
      attrs: parseXmlAttrs(match[1] || ""),
      content: match[2] || "",
    });
  }
  return statements.length ? statements : [buildGlobalStatement(text)];
}

function buildGlobalStatement(text: string): StatementBlock {
  return {
    index: 0,
    attrs: parseFirstTagAttrs(text, "FlexStatement"),
    content: text,
  };
}

function statementSummary(statement: StatementBlock): StatementAccountSummary {
  const tradeRows = extractTagAttrs(statement.content, "Trade");
  const optionEventRows = extractTagAttrs(statement.content, "OptionEAE")
    .filter(isOptionLifecycleRow);
  const orders = extractTagAttrs(statement.content, "Order");
  const accountId = statement.attrs.accountId || "";
  return {
    index: statement.index,
    accountId,
    maskedAccountId: maskAccount(accountId),
    period: formatFlexPeriod(statement.attrs.fromDate, statement.attrs.toDate),
    baseCurrency: tradeRows.find((row) => row.currency)?.currency
      || optionEventRows.find((row) => row.currency)?.currency
      || "USD",
    tradeCount: tradeRows.length,
    orderCount: orders.length,
  };
}

function normalizeFlexTrade(row: Record<string, string>): FlexTrade {
  const rawDate = row.dateTime || row.tradeDate || row.date || "";
  const date = parseFlexDate(rawDate);
  const tradeDay = formatFlexDay(row.tradeDate || row.date);
  const notes = uniqueCodes([
    ...splitCodes(row.notes),
    ...splitCodes(row.code),
  ]);
  const openCloseIndicator = row.openCloseIndicator || "";
  const actionCodes = [openCloseIndicator, ...notes].filter(Boolean);
  const displaySymbol = row.description || row.symbol || "";

  return {
    assetClass: flexAssetClass(row.assetCategory),
    currency: row.currency || "",
    symbol: displaySymbol,
    rawSymbol: row.symbol || "",
    displaySymbol,
    underlyingSymbol: row.underlyingSymbol || "",
    description: row.description || "",
    date,
    day: tradeDay || formatLocalDate(date),
    quantity: num(row.quantity),
    tradePrice: num(row.tradePrice),
    proceeds: num(row.proceeds),
    commission: num(row.ibCommission),
    netCash: cashFlow(row),
    basis: num(row.cost),
    fifoRealizedPnl: num(row.fifoPnlRealized),
    realizedPnl: num(row.fifoPnlRealized),
    mtmPnl: num(row.mtmPnl),
    code: actionCodes.join(";"),
    actionCodes,
    close: openCloseIndicator === "C",
    expired: notes.includes("Ep") || notes.includes("Ex"),
    autoExpiry: notes.includes("Ep"),
    closeReason: notes.includes("Ep") ? "expired" : notes.includes("Ex") ? "exercise_or_assignment" : "",
    transactionType: row.transactionType || "",
    strategyGroupId: strategyGroupId(row),
    expiry: compactFlexDate(row.expiry),
    putCall: row.putCall || "",
    strike: row.strike || "",
    multiplier: num(row.multiplier || 1),
  };
}

interface NormalizedOptionEvent {
  trade: FlexTrade;
  hasReportedRealizedPnl: boolean;
}

/**
 * Normalize an IBKR option exercise, assignment, expiration, or cash-settlement
 * event into the same closing-event shape used by downstream analytics.
 */
function normalizeOptionEvent(row: Record<string, string>): NormalizedOptionEvent {
  const transactionType = row.transactionType || "";
  const rawDate = row.dateTime || row.tradeDate || row.date || "";
  const date = parseFlexDate(rawDate);
  const day = formatFlexDay(row.tradeDate || row.date) || formatLocalDate(date);
  const sourceCodes = uniqueCodes([
    ...splitCodes(row.notes),
    ...splitCodes(row.code),
  ]);
  const eventCode = optionEventCode(transactionType, sourceCodes);
  const actionCodes = uniqueCodes(["C", ...sourceCodes, eventCode]);
  const displaySymbol = row.description || row.symbol || "";
  const isExpiration = /expir/i.test(transactionType) || actionCodes.includes("Ep");
  const isExerciseOrAssignment = /exerc|assign/i.test(transactionType)
    || actionCodes.includes("Ex")
    || actionCodes.includes("A");
  const isCashSettlement = /cash.*sett/i.test(transactionType)
    || actionCodes.includes("CD");
  const hasReportedRealizedPnl = hasNumericValue(row.realizedPnl);
  const realizedPnl = hasReportedRealizedPnl ? num(row.realizedPnl) : 0;
  const commission = num(
    row.ibCommission
      || row.commission
      || row.commissions
      || row.commTax,
  );

  return {
    hasReportedRealizedPnl,
    trade: {
      assetClass: flexAssetClass(row.assetCategory || "OPT"),
      currency: row.currency || "",
      symbol: displaySymbol,
      rawSymbol: row.symbol || "",
      displaySymbol,
      underlyingSymbol: row.underlyingSymbol || "",
      description: row.description || "",
      date,
      day,
      quantity: num(row.quantity),
      tradePrice: num(row.tradePrice),
      proceeds: num(row.proceeds),
      commission,
      netCash: num(row.proceeds) + commission,
      basis: num(row.basis || row.cost),
      fifoRealizedPnl: realizedPnl,
      realizedPnl,
      mtmPnl: num(row.mtmPnl),
      code: actionCodes.join(";"),
      actionCodes,
      close: true,
      expired: isExpiration || isExerciseOrAssignment || isCashSettlement,
      autoExpiry: isExpiration,
      closeReason: isExpiration || isCashSettlement ? "expired" : "exercise_or_assignment",
      transactionType,
      strategyGroupId: strategyGroupId(row),
      expiry: compactFlexDate(row.expiry),
      putCall: row.putCall || "",
      strike: row.strike || "",
      multiplier: num(row.multiplier || 1),
    },
  };
}

interface ReconciledTrades {
  trades: FlexTrade[];
  reportedPnlTrades: Set<FlexTrade>;
}

/**
 * Prefer OptionEAE lifecycle data when the same close also appears in Trades.
 * OptionEAE carries the authoritative cash-settlement proceeds and realized P/L.
 */
function reconcileOptionEvents(
  trades: FlexTrade[],
  optionEvents: NormalizedOptionEvent[],
): ReconciledTrades {
  const reconciled = [...trades];
  const reportedPnlTrades = new Set<FlexTrade>();
  const matchedTradeIndexes = new Set<number>();

  for (const optionEvent of optionEvents) {
    const matchIndex = trades.findIndex((trade, index) =>
      !matchedTradeIndexes.has(index)
      && isMatchingLifecycleTrade(trade, optionEvent.trade));
    const reconciledEvent = matchIndex >= 0
      ? mergeLifecycleTrade(trades[matchIndex] as FlexTrade, optionEvent.trade)
      : optionEvent.trade;

    if (matchIndex >= 0) {
      reconciled[matchIndex] = reconciledEvent;
      matchedTradeIndexes.add(matchIndex);
    } else {
      reconciled.push(reconciledEvent);
    }

    if (optionEvent.hasReportedRealizedPnl) {
      reportedPnlTrades.add(reconciledEvent);
    }
  }

  return { trades: reconciled, reportedPnlTrades };
}

function isMatchingLifecycleTrade(trade: FlexTrade, optionEvent: FlexTrade): boolean {
  if (!trade.close || !isLifecycleEvent(trade)) return false;
  if (optionContractKey(trade) !== optionContractKey(optionEvent)) return false;
  if (trade.day && optionEvent.day && trade.day !== optionEvent.day) return false;
  return quantitiesMatch(trade.quantity, optionEvent.quantity);
}

function isLifecycleEvent(trade: FlexTrade): boolean {
  return trade.expired
    || trade.autoExpiry
    || trade.closeReason !== ""
    || /expir|exerc|assign|cash.*sett/i.test(trade.transactionType);
}

function quantitiesMatch(left: number, right: number): boolean {
  if (!left || !right) return true;
  return Math.abs(Math.abs(left) - Math.abs(right)) <= 1e-8;
}

function mergeLifecycleTrade(trade: FlexTrade, optionEvent: FlexTrade): FlexTrade {
  const actionCodes = uniqueCodes([
    ...trade.actionCodes,
    ...optionEvent.actionCodes,
  ]);

  return {
    ...trade,
    ...optionEvent,
    strategyGroupId: optionEvent.strategyGroupId || trade.strategyGroupId,
    actionCodes,
    code: actionCodes.join(";"),
  };
}

interface OpenExecutionLot {
  remaining: number;
  cashPerUnit: number;
}

function applyMatchedRealizedPnl(
  trades: FlexTrade[],
  reportedPnlTrades = new Set<FlexTrade>(),
): FlexTrade[] {
  const stacks = new Map<string, OpenExecutionLot[]>();
  const matchedTrades = [...trades];

  for (const { trade, index } of trades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => tradeTime(a.trade) - tradeTime(b.trade))) {
      const quantity = Math.abs(trade.quantity);
      if (!quantity) continue;

      const key = positionKey(trade);
      const cashPerUnit = trade.netCash / quantity;

      if (!trade.close) {
        const stack = stacks.get(key) || [];
        stack.push({ remaining: quantity, cashPerUnit });
        stacks.set(key, stack);
        continue;
      }

      const stack = stacks.get(key) || [];
      let remaining = quantity;
      let matchedOpenCash = 0;

      while (remaining > 0 && stack.length) {
        const lot = stack[stack.length - 1];
        if (!lot) break;
        const matched = Math.min(remaining, lot.remaining);
        matchedOpenCash += lot.cashPerUnit * matched;
        lot.remaining -= matched;
        remaining -= matched;
        if (lot.remaining <= 1e-8) stack.pop();
      }

      if (remaining > 1e-8) continue;

      stacks.set(key, stack);
      if (reportedPnlTrades.has(trade)) continue;
      matchedTrades[index] = {
        ...trade,
        realizedPnl: trade.netCash + matchedOpenCash,
      };
    }

  return matchedTrades;
}

function positionKey(trade: FlexTrade): string {
  return [
    trade.currency.toUpperCase(),
    canonicalSymbol(trade.rawSymbol || trade.displaySymbol),
    compactFlexDate(trade.expiry),
    trade.putCall.toUpperCase(),
    canonicalNumber(trade.strike),
  ].join("|");
}

function optionContractKey(trade: FlexTrade): string {
  return positionKey(trade);
}

function tradeTime(trade: FlexTrade): number {
  return trade.date?.getTime() ?? 0;
}

function cashFlow(row: Record<string, string>): number {
  if (row.netCash) return num(row.netCash);
  return num(row.proceeds) + num(row.ibCommission);
}

function isOptionLifecycleRow(row: Record<string, string>): boolean {
  const assetCategory = row.assetCategory?.trim().toUpperCase() || "";
  return assetCategory === "OPT"
    || assetCategory === "FOP"
    || Boolean(row.putCall || (row.expiry && row.strike));
}

function optionEventCode(transactionType: string, sourceCodes: string[]): string {
  if (sourceCodes.includes("Ep") || /expir/i.test(transactionType)) return "Ep";
  if (sourceCodes.includes("Ex") || /exerc/i.test(transactionType)) return "Ex";
  if (sourceCodes.includes("A") || /assign/i.test(transactionType)) return "A";
  if (sourceCodes.includes("CD") || /cash.*sett/i.test(transactionType)) return "CD";
  return "";
}

function strategyGroupId(row: Record<string, string>): string {
  const source = [
    row.comboId,
    row.comboID,
    row.comboTradeId,
    row.comboTradeID,
    row.strategyId,
    row.strategyID,
    row.spreadId,
    row.spreadID,
    row.parentOrderId,
    row.parentOrderID,
    row.ibOrderId,
    row.ibOrderID,
    row.orderId,
    row.orderID,
  ].find((value) => value && value.trim());

  return source?.trim() || "";
}

function looksLikeXml(text: string): boolean {
  return /^\s*</.test(text);
}

function parseFirstTagAttrs(text: string, tagName: string): Record<string, string> {
  return extractTagAttrs(text, tagName)[0] || {};
}

function extractTagAttrs(text: string, tagName: string): Record<string, string>[] {
  const pattern = new RegExp(`<${tagName}\\s+([^>]*?)(?:/?>)`, "g");
  const rows: Record<string, string>[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    rows.push(parseXmlAttrs(match[1] || ""));
  }
  return rows;
}

function parseXmlAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    attrs[match[1] || ""] = decodeXml(match[2] || "");
  }
  return attrs;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseFlexDate(value: string): Date | null {
  if (!value) return null;
  const [rawDatePart, rawTimePart = "000000"] = value.split(";");
  const datePart = compactFlexDate(rawDatePart);
  const timePart = rawTimePart.replace(/:/g, "").padEnd(6, "0");
  if (!datePart || !/^\d{8}$/.test(datePart)) return null;
  const iso = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2) || "00"}:${timePart.slice(2, 4) || "00"}:${timePart.slice(4, 6) || "00"}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatFlexDay(value = ""): string {
  const compact = compactFlexDate(value);
  if (!/^\d{8}$/.test(compact)) return "";
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function formatLocalDate(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFlexPeriod(fromDate = "", toDate = ""): string {
  const from = formatFlexDay(fromDate);
  const to = formatFlexDay(toDate);
  return from && to ? `${from} - ${to}` : "";
}

function splitCodes(value = ""): string[] {
  return value
    .split(";")
    .map((code) => code.trim())
    .filter(Boolean);
}

function uniqueCodes(codes: string[]): string[] {
  return [...new Set(codes.filter(Boolean))];
}

function compactFlexDate(value = ""): string {
  return value.trim().replace(/-/g, "");
}

function canonicalSymbol(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function canonicalNumber(value: string): string {
  if (!value.trim()) return "";
  return String(num(value));
}

function hasNumericValue(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "" && value.trim() !== "--";
}

function flexAssetClass(value = ""): string {
  const map: Record<string, string> = {
    STK: "stock",
    OPT: "option",
    CASH: "cash",
    FUT: "future",
  };
  return map[value] || value;
}

function num(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/,/g, "").replace(/%$/, "").trim();
  if (!cleaned || cleaned === "--") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function maskAccount(value = ""): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 1)}${"*".repeat(Math.max(4, value.length - 3))}${value.slice(-2)}`;
}
