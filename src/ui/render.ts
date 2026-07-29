import { escapeHtml, money, percent, ratio } from "../domain/format.js";
import {
  countOptionLifecycleTrades,
  optionLifecycleCodes,
  summarizeOptionLifecycleCodes,
  type OptionLifecycleCode,
  type OptionLifecycleCount,
} from "../domain/optionLifecycle.js";
import type {
  AssetGroup,
  AssetGroupSummary,
  ClosedTrade,
  DirectionSummary,
  HoldingBucket,
  HoldingPeriodSummary,
  IntradaySession,
  IntradaySessionSummary,
  ParsedStatement,
  PeriodPerformance,
  PositionDirection,
  SymbolSummary,
  WeekdayPerformance,
} from "../domain/types.js";
import { buildAdviceSignals } from "./advice.js";
import {
  drawDailyChart,
  drawDistributionChart,
  drawPeriodPerformanceChart,
} from "./chart.js";
import type { Locale, TranslationKey } from "./i18n/index.js";
import { formatMessage, renderAdvice, t } from "./i18n/index.js";

export interface Insight {
  title: string;
  body: string;
}

export type PeriodMode = "weekly" | "monthly";
export type ThemeMode = "light" | "dark";
export type SortDirection = "asc" | "desc";
export type SortTable = "period" | "option" | "symbol";

export interface SortState {
  table: SortTable;
  key: string;
  direction: SortDirection;
}

export interface RenderOptions {
  locale: Locale;
  periodMode: PeriodMode;
  theme: ThemeMode;
  sorts: Partial<Record<SortTable, SortState>>;
  symbolPage: number;
}

export interface AppElements {
  privacyStrip: HTMLElement;
  maskedAccount: HTMLElement;
  accountSelect: HTMLSelectElement;
  maskedName: HTMLElement;
  period: HTMLElement;
  baseCurrency: HTMLElement;
  metricsGrid: HTMLElement;
  workspace: HTMLElement;
  tradeCount: HTMLElement;
  dailyChart: HTMLCanvasElement;
  distributionChart: HTMLCanvasElement;
  periodChart: HTMLCanvasElement;
  periodTitle: HTMLElement;
  periodColumnLabel: HTMLElement;
  periodWeekly: HTMLButtonElement;
  periodMonthly: HTMLButtonElement;
  intradaySessionRows: HTMLElement;
  weekdayRows: HTMLElement;
  disciplineBanner: HTMLElement;
  disciplineList: HTMLElement;
  bestLoserList: HTMLElement;
  periodRows: HTMLElement;
  holdingRows: HTMLElement;
  directionRows: HTMLElement;
  assetRows: HTMLElement;
  optionRows: HTMLElement;
  symbolRows: HTMLElement;
  symbolPager: HTMLElement;
  offlineAdvice: HTMLElement;
}

export function renderReport(
  els: AppElements,
  report: ParsedStatement,
  options: RenderOptions,
): void {
  const { profile, metrics } = report;
  els.privacyStrip.hidden = false;
  els.metricsGrid.hidden = false;
  els.workspace.hidden = false;

  els.maskedAccount.textContent = profile.maskedAccountId || "--";
  renderAccountPicker(els, report, options.locale);
  els.maskedName.textContent = t(options.locale, "neutralName");
  els.period.textContent = profile.period || "--";
  els.baseCurrency.textContent = profile.baseCurrency || "USD";
  els.tradeCount.textContent = formatMessage(
    options.locale,
    "tradeCountSummary",
    {
      closed: metrics.closedCount,
      executions: metrics.executionCount,
    },
  );

  els.metricsGrid.innerHTML = metricCards([
    [
      t(options.locale, "netRealized"),
      money(metrics.net),
      t(options.locale, "closedTradeSum"),
      pnlTone(metrics.net),
      statusLabel(options.locale, metrics.net),
    ],
    [
      t(options.locale, "profitFactor"),
      ratio(metrics.profitFactor),
      t(options.locale, "grossProfitLoss"),
      thresholdTone(metrics.profitFactor),
      thresholdStatusLabel(options.locale, metrics.profitFactor),
    ],
    [
      t(options.locale, "winRate"),
      percent(metrics.winRate),
      `${metrics.winCount} / ${metrics.lossCount}`,
    ],
    [
      t(options.locale, "payoffRatio"),
      ratio(metrics.payoffRatio),
      t(options.locale, "averageWinLoss"),
      thresholdTone(metrics.payoffRatio),
      thresholdStatusLabel(options.locale, metrics.payoffRatio),
    ],
    [
      t(options.locale, "expectancy"),
      money(metrics.expectancy),
      t(options.locale, "perClosedTrade"),
      pnlTone(metrics.expectancy),
      statusLabel(options.locale, metrics.expectancy),
    ],
    intradayWeaknessCard(report.intradaySessions, options.locale),
    [
      t(options.locale, "medianHoldingDays"),
      formatHoldingDuration(metrics.medianHoldingDays, options.locale),
      formatMessage(options.locale, "holdingSampleSummary", {
        count: metrics.holdingSampleCount,
      }),
    ],
    [
      t(options.locale, "commissionDrag"),
      money(metrics.commissions),
      `${metrics.executionCount} ${t(options.locale, "executions")}`,
      "loss",
      t(options.locale, "costStatus"),
    ],
  ]);

  const chartOptions = { locale: options.locale, theme: cssChartTheme() };
  drawDailyChart(els.dailyChart, report.daily, chartOptions);
  drawDistributionChart(
    els.distributionChart,
    report.closedTrades,
    chartOptions,
  );
  renderPeriodSection(els, report, options);

  const advice = buildAdviceSignals(report);
  renderInsights(
    els.disciplineList,
    advice.discipline.map((signal) => renderAdvice(options.locale, signal)),
  );
  renderDisciplineBanner(els.disciplineBanner, report, options.locale);
  renderInsights(
    els.bestLoserList,
    advice.bestLoserWins.map((signal) => renderAdvice(options.locale, signal)),
  );
  renderInsights(
    els.offlineAdvice,
    advice.offlineAdvice.map((signal) => renderAdvice(options.locale, signal)),
  );
  renderHoldingPeriods(els.holdingRows, report.holdingPeriods, options.locale);
  renderDirectionSummaries(
    els.directionRows,
    report.directionSummaries,
    options.locale,
  );
  renderAssetGroups(els.assetRows, report.assetGroups, options.locale);
  renderOptionRows(
    els.optionRows,
    report.optionTrades,
    options.locale,
    options.sorts.option,
  );
  renderSymbols(
    els.symbolRows,
    els.symbolPager,
    sortRows(report.symbols, options.sorts.symbol),
    options.locale,
    options.symbolPage,
  );
  updateSortButtons(options.sorts);
}

function renderAccountPicker(
  els: AppElements,
  report: ParsedStatement,
  locale: Locale,
): void {
  const hasMultipleAccounts = report.accounts.length > 1;
  els.maskedAccount.hidden = hasMultipleAccounts;
  els.accountSelect.hidden = !hasMultipleAccounts;
  if (!hasMultipleAccounts) return;

  els.accountSelect.innerHTML = report.accounts
    .map((account) => {
      const selected =
        account.index === report.selectedAccountIndex ? " selected" : "";
      const label = formatMessage(locale, "accountOptionLabel", {
        account: account.maskedAccountId || "--",
        trades: account.tradeCount,
      });
      return `<option value="${account.index}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

export function renderPeriodSection(
  els: AppElements,
  report: ParsedStatement,
  options: RenderOptions,
): void {
  const periods =
    options.periodMode === "weekly" ? report.weekly : report.monthly;
  els.periodTitle.textContent = formatMessage(options.locale, "periodTitle", {
    period: options.periodMode,
  });
  els.periodColumnLabel.textContent =
    options.periodMode === "weekly"
      ? t(options.locale, "periodColumn")
      : t(options.locale, "monthColumn");
  els.periodWeekly.classList.toggle("active", options.periodMode === "weekly");
  els.periodMonthly.classList.toggle(
    "active",
    options.periodMode === "monthly",
  );

  drawPeriodPerformanceChart(els.periodChart, periods, {
    locale: options.locale,
    theme: cssChartTheme(),
  });
  renderPeriods(
    els.periodRows,
    sortRows(periods, options.sorts.period),
    12,
    Boolean(options.sorts.period),
  );
  renderIntradaySessions(
    els.intradaySessionRows,
    report.intradaySessions,
    options.locale,
  );
  renderWeekdays(els.weekdayRows, report.weekdays, options.locale);
  updateSortButtons(options.sorts);
}

export function renderError(
  target: HTMLElement,
  locale: Locale,
  message: string,
): void {
  target.innerHTML = `<div class="insight"><strong>${escapeHtml(t(locale, "importFailed"))}</strong><p>${escapeHtml(message)}</p></div>`;
  window.setTimeout(() => {
    target.innerHTML = "";
  }, 2400);
}

export function translateStaticText(locale: Locale): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (!key) continue;
    element.textContent = t(locale, key as TranslationKey);
  }
}

type MetricTone = "win" | "loss" | "neutral";
type MetricCard = {
  label: string;
  value: string;
  note: string;
  tone?: MetricTone;
  status?: string;
  valueHtml?: string;
};

function metricCards(
  cards: Array<[string, string, string, MetricTone?, string?] | MetricCard>,
): string {
  return cards
    .map((card) => {
      const normalized = Array.isArray(card)
        ? {
            label: card[0],
            value: card[1],
            note: card[2],
            tone: card[3],
            status: card[4],
          }
        : card;
      const {
        label,
        value,
        note,
        tone = "neutral",
        status,
        valueHtml,
      } = normalized;
      return `
      <article class="metric-card ${tone}">
        <span>${escapeHtml(label)}</span>
        <strong class="${tone}">${valueHtml || escapeHtml(value)}</strong>
        <small>${escapeHtml(note)}</small>
        ${status ? `<em>${escapeHtml(status)}</em>` : ""}
      </article>
    `;
    })
    .join("");
}

function pnlTone(value: number): MetricTone {
  if (value > 0) return "win";
  if (value < 0) return "loss";
  return "neutral";
}

function thresholdTone(value: number): MetricTone {
  if (value >= 1) return "win";
  if (value > 0) return "loss";
  return "neutral";
}

function statusLabel(locale: Locale, value: number): string {
  if (value > 0) return t(locale, "profitStatus");
  if (value < 0) return t(locale, "lossStatus");
  return t(locale, "flatStatus");
}

function thresholdStatusLabel(locale: Locale, value: number): string {
  if (value >= 1) return t(locale, "profitStatus");
  if (value > 0) return t(locale, "lossStatus");
  return t(locale, "flatStatus");
}

function renderInsights(target: HTMLElement, items: Insight[]): void {
  target.innerHTML = items
    .map(
      (item) => `
      <div class="insight">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </div>
    `,
    )
    .join("");
}

function renderSymbols(
  target: HTMLElement,
  pager: HTMLElement,
  symbols: SymbolSummary[],
  locale: Locale,
  page: number,
): void {
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(symbols.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const start = (currentPage - 1) * pageSize;
  const visibleSymbols = symbols.slice(start, start + pageSize);

  target.innerHTML = visibleSymbols
    .map((row) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      return `
      <tr>
        <td>${escapeHtml(row.symbol)}</td>
        <td>${escapeHtml(localizeAssetClass(row.assetClass, locale))}</td>
        <td class="num ${tone}">${money(row.pnl)}</td>
        <td class="num">${row.count}</td>
        <td class="num">${percent(row.winRate)}</td>
        <td class="num ${tone}">${money(row.average)}</td>
      </tr>
    `;
    })
    .join("");

  if (!symbols.length) {
    target.innerHTML = `<tr><td colspan="6">${escapeHtml(t(locale, "chartEmpty"))}</td></tr>`;
  }

  const visiblePages = symbolPagerPages(currentPage, pageCount);
  const pageButtons = visiblePages
    .map((pageNumber) => {
      const active = pageNumber === currentPage;
      return `
        <button class="pager-page${active ? " active" : ""}" type="button" data-symbol-page="${pageNumber}" aria-label="${escapeHtml(formatMessage(locale, "pageStatus", { page: pageNumber, pageCount }))}"${active ? ' aria-current="page"' : ""}>${pageNumber}</button>
      `;
    })
    .join("");

  pager.innerHTML = `
    <button class="pager-button" type="button" data-symbol-page="prev" aria-label="${escapeHtml(t(locale, "previousPage"))}"${currentPage <= 1 ? " disabled" : ""}>‹</button>
    <div class="pager-pages">${pageButtons}</div>
    <span class="pager-status">${escapeHtml(formatMessage(locale, "pageStatus", { page: currentPage, pageCount }))}</span>
    <button class="pager-button" type="button" data-symbol-page="next" aria-label="${escapeHtml(t(locale, "nextPage"))}"${currentPage >= pageCount ? " disabled" : ""}>›</button>
  `;
}

function symbolPagerPages(currentPage: number, pageCount: number): number[] {
  const windowSize = 7;
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(
    1,
    Math.min(currentPage - halfWindow, pageCount - windowSize + 1),
  );
  const end = Math.min(pageCount, start + windowSize - 1);
  return Array.from(
    { length: end - start + 1 },
    (_value, index) => start + index,
  );
}

function renderPeriods(
  target: HTMLElement,
  periods: PeriodPerformance[],
  limit: number,
  sorted: boolean,
): void {
  const visibleRows = sorted ? periods.slice(0, limit) : periods.slice(-limit);
  target.innerHTML = visibleRows
    .map((row) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      return `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td class="num ${tone}">${money(row.pnl)}</td>
        <td class="num">${ratio(row.profitFactor)}</td>
        <td class="num">${ratio(row.payoffRatio)}</td>
        <td class="num">${percent(row.winRate)}</td>
        <td class="num">${row.count}</td>
      </tr>
    `;
    })
    .join("");
}

function renderIntradaySessions(
  target: HTMLElement,
  rows: IntradaySessionSummary[],
  locale: Locale,
): void {
  target.innerHTML = rows
    .map((row) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      return `
      <tr>
        <td>${intradaySessionLabel(row.session, locale)}</td>
        <td class="num ${tone}">${money(row.pnl)}</td>
        <td class="num ${row.medianPnl >= 0 ? "win" : "loss"}">${money(row.medianPnl)}</td>
        <td class="num">${money(row.average)}</td>
        <td class="num">${ratio(row.profitFactor)}</td>
        <td class="num">${ratio(row.payoffRatio)}</td>
        <td class="num">${percent(row.winRate)}</td>
        <td class="num">${row.count}</td>
      </tr>
    `;
    })
    .join("");

  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="8">${escapeHtml(t(locale, "chartEmpty"))}</td></tr>`;
  }
}

function renderWeekdays(
  target: HTMLElement,
  rows: WeekdayPerformance[],
  locale: Locale,
): void {
  const rankedRows = [...rows].sort(
    (a, b) =>
      sortableRatio(b.payoffRatio) - sortableRatio(a.payoffRatio) ||
      sortableRatio(b.profitFactor) - sortableRatio(a.profitFactor) ||
      b.average - a.average ||
      b.pnl - a.pnl,
  );
  target.innerHTML = rankedRows
    .map((row, index) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      const rank =
        index === 0
          ? t(locale, "bestDay")
          : index === rankedRows.length - 1
            ? t(locale, "worstDay")
            : "";
      return `
      <tr>
        <td><span class="weekday-name">${escapeHtml(weekdayName(row.weekday, locale))}</span></td>
        <td class="rank-cell">${rank ? `<span class="rank-pill ${index === 0 ? "win" : "loss"}">${escapeHtml(rank)}</span>` : ""}</td>
        <td class="num ${tone}">${money(row.pnl)}</td>
        <td class="num ${row.average >= 0 ? "win" : "loss"}">${money(row.average)}</td>
        <td class="num">${ratio(row.profitFactor)}</td>
        <td class="num">${ratio(row.payoffRatio)}</td>
        <td class="num">${percent(row.winRate)}</td>
        <td class="num">${row.count}</td>
      </tr>
    `;
    })
    .join("");

  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="8">${escapeHtml(t(locale, "chartEmpty"))}</td></tr>`;
  }
}

function renderDisciplineBanner(
  target: HTMLElement,
  report: ParsedStatement,
  locale: Locale,
): void {
  const worstDay = [...report.daily]
    .filter((day) => day.pnl < 0)
    .sort((a, b) => a.pnl - b.pnl)[0];
  const dailyLossThreshold = Math.max(
    100,
    Math.abs(report.metrics.avgWin || 0) * 2,
    Math.abs(report.metrics.net || 0) * 0.12,
  );
  if (!worstDay || Math.abs(worstDay.pnl) < dailyLossThreshold) {
    target.innerHTML = "";
    target.hidden = true;
    return;
  }

  target.hidden = false;
  target.innerHTML = `
    <div class="discipline-banner-copy">
      <span>${escapeHtml(t(locale, "largeLossAlert"))}</span>
      <strong>${escapeHtml(t(locale, "largeLossDiscipline"))}</strong>
      <p>${escapeHtml(t(locale, "largeLossRule"))}</p>
    </div>
    <div class="discipline-banner-stat">
      <span>${escapeHtml(t(locale, "worstLossDay"))}</span>
      <strong>${money(worstDay.pnl)}</strong>
      <small>${escapeHtml(worstDay.day || "--")} · ${worstDay.count} ${escapeHtml(t(locale, "trades"))}</small>
    </div>
  `;
}

function renderAssetGroups(
  target: HTMLElement,
  rows: AssetGroupSummary[],
  locale: Locale,
): void {
  target.innerHTML = rows
    .map((row) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      return `
      <article class="asset-card">
        <div class="asset-card-head">
          <span>${escapeHtml(assetGroupName(row.group, locale))}</span>
          <strong class="${tone}">${money(row.pnl)}</strong>
        </div>
        <dl>
          <div><dt>${escapeHtml(t(locale, "pf"))}</dt><dd>${ratio(row.profitFactor)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "payoffShort"))}</dt><dd>${ratio(row.payoffRatio)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "winRate"))}</dt><dd>${percent(row.winRate)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "average"))}</dt><dd class="${tone}">${money(row.average)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "trades"))}</dt><dd>${row.count}</dd></div>
        </dl>
      </article>
    `;
    })
    .join("");
}

function renderHoldingPeriods(
  target: HTMLElement,
  rows: HoldingPeriodSummary[],
  locale: Locale,
): void {
  target.innerHTML = rows
    .map((row) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      return `
      <tr>
        <td>${escapeHtml(holdingBucketName(row.bucket, locale))}</td>
        <td class="num">${formatHoldingDuration(row.medianHoldingDays, locale)}</td>
        <td class="num ${tone}">${money(row.pnl)}</td>
        <td class="num">${ratio(row.profitFactor)}</td>
        <td class="num">${ratio(row.payoffRatio)}</td>
        <td class="num">${percent(row.winRate)}</td>
        <td class="num">${row.count}</td>
      </tr>
    `;
    })
    .join("");

  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="7">${escapeHtml(t(locale, "chartEmpty"))}</td></tr>`;
  }
}

function renderDirectionSummaries(
  target: HTMLElement,
  rows: DirectionSummary[],
  locale: Locale,
): void {
  target.innerHTML = rows
    .map((row) => {
      const tone = row.pnl >= 0 ? "win" : "loss";
      return `
      <article class="direction-card ${row.direction}">
        <div class="direction-card-head">
          <span>${escapeHtml(directionName(row.direction, locale))}</span>
          <strong class="${tone}">${money(row.pnl)}</strong>
        </div>
        <dl>
          <div><dt>${escapeHtml(t(locale, "medianHoldingDays"))}</dt><dd>${formatHoldingDuration(row.medianHoldingDays, locale)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "pf"))}</dt><dd>${ratio(row.profitFactor)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "payoffShort"))}</dt><dd>${ratio(row.payoffRatio)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "winRate"))}</dt><dd>${percent(row.winRate)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "average"))}</dt><dd class="${tone}">${money(row.average)}</dd></div>
          <div><dt>${escapeHtml(t(locale, "trades"))}</dt><dd>${row.count}</dd></div>
        </dl>
      </article>
    `;
    })
    .join("");

  if (!rows.length) {
    target.innerHTML = `<div class="empty-note">${escapeHtml(t(locale, "chartEmpty"))}</div>`;
  }
}

function sortRows<T extends object>(
  rows: T[],
  sort: SortState | undefined,
): T[] {
  if (!sort) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = sortableValue((a as Record<string, unknown>)[sort.key]);
    const right = sortableValue((b as Record<string, unknown>)[sort.key]);
    if (typeof left === "string" || typeof right === "string") {
      const compared = String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return compared * direction;
    }
    if (left === right) return 0;
    return left > right ? direction : -direction;
  });
}

function sortableValue(value: unknown): string | number {
  if (typeof value === "number") {
    if (value === Infinity) return Number.MAX_SAFE_INTEGER;
    if (value === -Infinity) return Number.MIN_SAFE_INTEGER;
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") return value;
  return 0;
}

function sortableRatio(value: number): number {
  if (value === Infinity) return Number.MAX_SAFE_INTEGER;
  if (value === -Infinity) return Number.MIN_SAFE_INTEGER;
  return Number.isFinite(value) ? value : 0;
}

function updateSortButtons(sorts: RenderOptions["sorts"]): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    ".sort-button",
  )) {
    const table = button.dataset.sortTable as SortTable | undefined;
    const key = button.dataset.sortKey;
    const sort = table ? sorts[table] : undefined;
    const active = Boolean(sort && sort.key === key);
    button.classList.toggle("active", active);
    button.dataset.direction = active ? sort?.direction || "" : "";
  }
}

interface OptionUnderlyingSummary {
  underlying: string;
  dateLabel: string;
  lastDate: string;
  pnl: number;
  profitFactor: number;
  winRate: number;
  count: number;
  lifecycleCount: number;
  lifecycleCounts: OptionLifecycleCount[];
  details: ClosedTrade[];
}

function renderOptionRows(
  target: HTMLElement,
  rows: ClosedTrade[],
  locale: Locale,
  sort: SortState | undefined,
): void {
  const summaries = sortRows(
    buildOptionUnderlyingSummaries(rows, locale),
    sort,
  );
  target.innerHTML = summaries
    .map((row, index) => {
      const groupKey = `option-${index}`;
      return [
        renderOptionSummaryRow(row, groupKey, locale),
        ...row.details.map((trade) =>
          renderOptionDetailRow(trade, groupKey, locale)
        ),
      ].join("");
    })
    .join("");
  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="7">${escapeHtml(t(locale, "chartEmpty"))}</td></tr>`;
  }
}

function renderOptionSummaryRow(
  row: OptionUnderlyingSummary,
  groupKey: string,
  locale: Locale,
): string {
  const tone = row.pnl >= 0 ? "win" : "loss";
  return `
    <tr class="group-row">
      <td>
        <span class="option-underlying">
          <button class="collapse-button" type="button" data-option-group="${escapeHtml(groupKey)}" aria-expanded="false" aria-label="${escapeHtml(t(locale, "toggleDetails"))}">+</button>
          <span class="option-symbol">${escapeHtml(row.underlying)}</span>
        </span>
      </td>
      <td class="date-list">${escapeHtml(row.dateLabel)}</td>
      <td class="num ${tone}">${money(row.pnl)}</td>
      <td class="num">${ratio(row.profitFactor)}</td>
      <td class="num">${percent(row.winRate)}</td>
      <td class="num">${renderOptionLifecycleSummary(row.lifecycleCounts, locale)}</td>
      <td class="num">${row.count}</td>
    </tr>
  `;
}

function renderOptionDetailRow(
  trade: ClosedTrade,
  groupKey: string,
  locale: Locale,
): string {
  const tone = trade.realizedPnl >= 0 ? "win" : "loss";
  return `
    <tr class="detail-row" data-option-group="${escapeHtml(groupKey)}" hidden>
      <td class="contract-detail">${escapeHtml(trade.displaySymbol || trade.rawSymbol || "--")}</td>
      <td class="date-list">${escapeHtml(trade.day || "--")}</td>
      <td class="num ${tone}">${money(trade.realizedPnl)}</td>
      <td class="num neutral">--</td>
      <td class="num neutral">--</td>
      <td class="num">${renderOptionLifecycleDetail(trade, locale)}</td>
      <td class="num">1</td>
    </tr>
  `;
}

function buildOptionUnderlyingSummaries(
  rows: ClosedTrade[],
  locale: Locale,
): OptionUnderlyingSummary[] {
  const groups = new Map<string, ClosedTrade[]>();
  for (const row of rows) {
    const underlying =
      row.underlyingSymbol || extractUnderlying(row.displaySymbol) || "";
    groups.set(underlying, [...(groups.get(underlying) || []), row]);
  }

  return [...groups.entries()].map(([underlying, details]) => {
    const sortedDetails = [...details].sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl),
    );
    const dates = [
      ...new Set(sortedDetails.map((row) => row.day).filter(Boolean)),
    ];
    const pnls = sortedDetails
      .map((row) => row.realizedPnl)
      .filter((value) => value !== 0);
    const wins = pnls.filter((value) => value > 0);
    const losses = pnls.filter((value) => value < 0);
    const grossProfit = sum(wins);
    const grossLoss = Math.abs(sum(losses));
    const lastDate = dates[dates.length - 1] || "--";
    return {
      underlying,
      dateLabel: formatMessage(locale, "datePlusCount", {
        date: lastDate,
        count: dates.length,
      }),
      lastDate,
      pnl: sum(pnls),
      profitFactor: grossLoss
        ? grossProfit / grossLoss
        : grossProfit
          ? Infinity
          : 0,
      winRate: pnls.length ? wins.length / pnls.length : 0,
      count: sortedDetails.length,
      lifecycleCount: countOptionLifecycleTrades(sortedDetails),
      lifecycleCounts: summarizeOptionLifecycleCodes(sortedDetails),
      details: sortedDetails,
    };
  });
}

function renderOptionLifecycleSummary(
  counts: OptionLifecycleCount[],
  locale: Locale,
): string {
  if (!counts.length) return '<span class="option-lifecycle-none">—</span>';
  return `<span class="option-lifecycle-summary">${counts
    .map(({ code, count }) =>
      `<span class="option-lifecycle-summary-item" title="${escapeHtml(t(locale, optionLifecycleTranslationKey(code)))}"><span class="option-lifecycle-code">${code}</span><span class="option-lifecycle-count">×${count}</span></span>`
    )
    .join("")}</span>`;
}

function renderOptionLifecycleDetail(
  trade: ClosedTrade,
  locale: Locale,
): string {
  const codes = optionLifecycleCodes(trade);
  if (!codes.length) {
    return `<span class="option-lifecycle-none" title="${escapeHtml(t(locale, "optionLifecycleRegularClose"))}">—</span>`;
  }
  return `<span class="option-lifecycle-list">${codes
    .map((code) =>
      `<span class="option-lifecycle-item" title="IBKR ${code}"><span class="option-lifecycle-code">${code}</span><span class="option-lifecycle-label">${escapeHtml(t(locale, optionLifecycleTranslationKey(code)))}</span></span>`
    )
    .join("")}</span>`;
}

function optionLifecycleTranslationKey(
  code: OptionLifecycleCode,
): TranslationKey {
  const keys: Record<OptionLifecycleCode, TranslationKey> = {
    Ep: "optionLifecycleEp",
    Ex: "optionLifecycleEx",
    A: "optionLifecycleA",
    CD: "optionLifecycleCD",
    AEx: "optionLifecycleAEx",
    MEx: "optionLifecycleMEx",
    GEA: "optionLifecycleGEA",
  };
  return keys[code];
}

function extractUnderlying(symbol: string): string {
  return symbol.trim().split(/\s+/)[0] || "";
}

function sum(values: number[]): number {
  return values.reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  );
}

function assetGroupName(group: AssetGroup, locale: Locale): string {
  if (group === "stock") return t(locale, "stock");
  if (group === "option") return t(locale, "option");
  return t(locale, "other");
}

function localizeAssetClass(value: string, locale: Locale): string {
  if (value.toLowerCase().includes("option")) return t(locale, "option");
  if (value.toLowerCase().includes("stock")) return t(locale, "stock");
  if (value.toLowerCase().includes("cash")) return t(locale, "cash");
  if (value.toLowerCase().includes("future")) return t(locale, "future");
  return value || t(locale, "other");
}

function intradayWeaknessCard(
  rows: IntradaySessionSummary[],
  locale: Locale,
): MetricCard {
  const weakest = [...rows].sort(
    (a, b) =>
      a.average - b.average || a.medianPnl - b.medianPnl || a.pnl - b.pnl,
  )[0];
  if (!weakest)
    return {
      label: t(locale, "weakestSession"),
      value: "--",
      note: t(locale, "intradaySessionNoData"),
    };

  const tone = weakest.average >= 0 ? "win" : "loss";
  return {
    label: t(locale, "weakestSession"),
    value: `${intradaySessionName(weakest.session, locale)} ${intradaySessionRange(weakest.session)}`,
    valueHtml: `
      <span class="metric-session-name">${escapeHtml(intradaySessionName(weakest.session, locale))}</span>
      <span class="metric-session-range">${escapeHtml(intradaySessionRange(weakest.session))}</span>
    `,
    note: `${money(weakest.average)} ${t(locale, "expectancy")}`,
    tone,
    status: statusLabel(locale, weakest.average),
  };
}

function formatHoldingDuration(value: number, locale: Locale): string {
  const days = Number.isFinite(value) ? value : 0;
  if (days > 0 && days < 1) {
    const totalMinutes = Math.max(1, Math.round(days * 24 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes)
      return `${hours}${t(locale, "hoursShort")} ${minutes}${t(locale, "minutesShort")}`;
    if (hours) return `${hours}${t(locale, "hoursShort")}`;
    return `${minutes}${t(locale, "minutesShort")}`;
  }
  const formatted = days < 10 ? days.toFixed(2) : days.toFixed(1);
  return `${formatted}${t(locale, "daysShort")}`;
}

function intradaySessionName(session: IntradaySession, locale: Locale): string {
  if (session === "morning") return t(locale, "sessionMorning");
  if (session === "midday") return t(locale, "sessionMidday");
  return t(locale, "sessionLate");
}

function intradaySessionLabel(
  session: IntradaySession,
  locale: Locale,
): string {
  return `
    <span class="session-name">${escapeHtml(intradaySessionName(session, locale))}</span>
    <span class="session-range">${escapeHtml(intradaySessionRange(session))}</span>
  `;
}

function intradaySessionRange(session: IntradaySession): string {
  if (session === "morning") return "09:30-11:30";
  if (session === "midday") return "11:30-14:00";
  return "14:00-16:15";
}

function weekdayName(weekday: number, locale: Locale): string {
  const keys: TranslationKey[] = [
    "weekdaySunday",
    "weekdayMonday",
    "weekdayTuesday",
    "weekdayWednesday",
    "weekdayThursday",
    "weekdayFriday",
    "weekdaySaturday",
  ];
  return t(locale, keys[weekday] || "unknown");
}

function holdingBucketName(bucket: HoldingBucket, locale: Locale): string {
  if (bucket === "intraday") return t(locale, "holdingIntraday");
  if (bucket === "swing") return t(locale, "holdingSwing");
  if (bucket === "position") return t(locale, "holdingPosition");
  return t(locale, "holdingLongTerm");
}

function directionName(direction: PositionDirection, locale: Locale): string {
  if (direction === "long") return t(locale, "longPosition");
  if (direction === "short") return t(locale, "shortPosition");
  return t(locale, "neutralPosition");
}

function cssChartTheme() {
  const styles = getComputedStyle(document.documentElement);
  return {
    background: styles.getPropertyValue("--chart-bg").trim() || "#fbfcfb",
    ink: styles.getPropertyValue("--ink").trim() || "#17211d",
    muted: styles.getPropertyValue("--muted").trim() || "#66746e",
    line: styles.getPropertyValue("--line").trim() || "#dce4df",
    win: styles.getPropertyValue("--win").trim() || "#119c65",
    loss: styles.getPropertyValue("--loss").trim() || "#c54747",
    accent: styles.getPropertyValue("--accent").trim() || "#0f8f72",
    accentSoft: styles.getPropertyValue("--accent-soft").trim() || "#9bcbbb",
  };
}
