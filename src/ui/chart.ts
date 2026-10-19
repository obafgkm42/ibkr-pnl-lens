import { money } from "../domain/format.js";
import type { ClosedTrade, DailyPnl, PeriodPerformance } from "../domain/types.js";
import type { Locale } from "./i18n/index.js";
import { t } from "./i18n/index.js";

interface ChartTheme {
  background: string;
  ink: string;
  muted: string;
  line: string;
  win: string;
  loss: string;
  accent: string;
  accentSoft: string;
}

interface ChartOptions {
  locale: Locale;
  theme: ChartTheme;
}

export function drawDailyChart(canvas: HTMLCanvasElement, daily: DailyPnl[], options: ChartOptions): void {
  drawCanvas(canvas, options.theme, ({ ctx, width, height, pad }) => {
    const values = daily.map((row) => row.pnl);
    const cumulative = daily.map((row) => row.cumulative);
    const barValues = aggregatePnlValues(values, width, pad);
    const { min, max } = paddedBounds([...barValues, ...cumulative, 0]);
    const y = scale(min, max, height - pad, pad);
    const step = daily.length > 1 ? (width - pad * 2) / (daily.length - 1) : width - pad * 2;
    const zeroY = y(0);

    ctx.strokeStyle = options.theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, crisp(zeroY));
    ctx.lineTo(width - pad, crisp(zeroY));
    ctx.stroke();

    drawDensePnlBars(ctx, values, { width, pad, zeroY, y, win: options.theme.win, loss: options.theme.loss });

    ctx.strokeStyle = options.theme.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    cumulative.forEach((value, index) => {
      const x = pad + index * step;
      const pointY = y(value);
      if (index === 0) ctx.moveTo(x, pointY);
      else ctx.lineTo(x, pointY);
    });
    ctx.stroke();

    drawAxisLabels(ctx, { width, height, pad, min, max, options, legend: t(options.locale, "dailyChartLegend") });
  });
}

/** Draw observed counts from loss to profit, with small outcomes near zero. */
export function drawDistributionChart(
  canvas: HTMLCanvasElement,
  trades: ClosedTrade[],
  options: ChartOptions,
): void {
  drawCanvas(canvas, options.theme, ({ ctx, width, height, pad }) => {
    const wins = trades
      .filter((trade) => trade.realizedPnl > 0)
      .map((trade) => trade.realizedPnl);
    const losses = trades
      .filter((trade) => trade.realizedPnl < 0)
      .map((trade) => Math.abs(trade.realizedPnl));
    // Keep signed P/L order rather than sorting counts into an artificial bell curve.
    const buckets: Array<[string, number, string]> = [
      [
        t(options.locale, "lossBucketLarge"),
        losses.filter((value) => value >= 150).length,
        "#812f35",
      ],
      [
        t(options.locale, "lossBucketMedium"),
        losses.filter((value) => value >= 50 && value < 150).length,
        options.theme.loss,
      ],
      [
        t(options.locale, "lossBucketSmall"),
        losses.filter((value) => value < 50).length,
        "#e6a2a2",
      ],
      [
        t(options.locale, "winBucketSmall"),
        wins.filter((value) => value < 50).length,
        "#7bc8a4",
      ],
      [
        t(options.locale, "winBucketMedium"),
        wins.filter((value) => value >= 50 && value < 150).length,
        options.theme.win,
      ],
      [
        t(options.locale, "winBucketLarge"),
        wins.filter((value) => value >= 150).length,
        "#09624f",
      ],
    ];
    const max = Math.max(...buckets.map((bucket) => bucket[1]), 1);
    const chartWidth = width - pad * 2;
    const barGap = 12;
    const barWidth = (chartWidth - barGap * (buckets.length - 1)) / buckets.length;
    const barBottom = height - 84;
    const labelTop = height - 52;

    ctx.strokeStyle = options.theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, crisp(barBottom));
    ctx.lineTo(width - pad, crisp(barBottom));
    ctx.moveTo(crisp(width / 2), pad - 8);
    ctx.lineTo(crisp(width / 2), barBottom + 6);
    ctx.stroke();
    ctx.fillStyle = options.theme.muted;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("0", width / 2, barBottom + 19);

    buckets.forEach(([label, value, color], index) => {
      const x = pad + index * (barWidth + barGap);
      const barHeight = ((barBottom - pad) * value) / max;
      ctx.fillStyle = color;
      ctx.fillRect(x, barBottom - barHeight, barWidth, barHeight);
      ctx.fillStyle = options.theme.muted;
      ctx.font = `${barWidth < 86 ? 10 : 11}px system-ui`;
      ctx.textAlign = "center";
      drawWrappedLabel(
        ctx, label, x + barWidth / 2, labelTop, Math.max(46, barWidth + 8), 2,
      );
      ctx.fillStyle = options.theme.ink;
      ctx.font = "700 13px system-ui";
      ctx.fillText(String(value), x + barWidth / 2, barBottom - barHeight - 8);
    });
  });
}

export function drawPeriodPerformanceChart(canvas: HTMLCanvasElement, periods: PeriodPerformance[], options: ChartOptions): void {
  drawCanvas(canvas, options.theme, ({ ctx, width, height, pad }) => {
    if (!periods.length) {
      drawEmptyState(ctx, width, height, t(options.locale, "chartEmpty"), options);
      return;
    }

    const plotTop = pad + 18;
    const plotBottom = height - pad - 38;
    const pnlValues = periods.map((period) => period.pnl);
    const displayPnlValues = aggregatePnlValues(pnlValues, width, pad);
    const { min: pnlMin, max: pnlMax } = chartBounds(displayPnlValues);
    const pnlY = scale(pnlMin, pnlMax, plotBottom, plotTop);
    const step = periods.length > 1 ? (width - pad * 2) / (periods.length - 1) : width - pad * 2;
    const zeroY = pnlY(0);

    ctx.strokeStyle = options.theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, crisp(zeroY));
    ctx.lineTo(width - pad, crisp(zeroY));
    ctx.stroke();

    drawDensePnlBars(ctx, pnlValues, { width, pad, zeroY, y: pnlY, win: options.theme.win, loss: options.theme.loss });

    ctx.fillStyle = options.theme.muted;
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(money(pnlMax), pad, 18);
    ctx.fillText(money(pnlMin), pad, plotBottom + 16);
    ctx.textAlign = "right";
    ctx.fillText(t(options.locale, "realized"), width - pad, 18);

    drawPeriodLabels(ctx, periods, { width, height, pad, step, options });
  });
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  theme: ChartTheme,
  painter: (args: { ctx: CanvasRenderingContext2D; width: number; height: number; pad: number }) => void,
  retry = true,
): void {
  const ratioValue = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 16) {
    if (retry) window.requestAnimationFrame(() => drawCanvas(canvas, theme, painter, false));
    return;
  }
  const cssWidth = Math.max(320, rect.width);
  const cssHeight = Math.max(180, rect.height || 260);
  canvas.width = Math.round(cssWidth * ratioValue);
  canvas.height = Math.round(cssHeight * ratioValue);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratioValue, ratioValue);
  const width = canvas.width / ratioValue;
  const height = canvas.height / ratioValue;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);
  painter({ ctx, width, height, pad: 46 });
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number, text: string, options: ChartOptions): void {
  ctx.fillStyle = options.theme.muted;
  ctx.font = "14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
}

function drawWrappedLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
): void {
  const words = label
    .replace(/([/-])/g, "$1 ")
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines[lines.length - 1] || "";
    const next = current ? `${current} ${word}` : word;
    if (!current) {
      lines.push(word);
      continue;
    }
    if (ctx.measureText(next).width <= maxWidth) {
      lines[lines.length - 1] = next;
      continue;
    }
    if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} ${word}`, maxWidth);
    }
  }

  const safeLines = lines.slice(0, maxLines);
  safeLines.forEach((line, index) => {
    ctx.fillText(index === maxLines - 1 ? ellipsize(ctx, line, maxWidth) : line, x, y + index * 13);
  });
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trim()}…`;
}

function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  { width, height, pad, min, max, options, legend }: { width: number; height: number; pad: number; min: number; max: number; options: ChartOptions; legend: string },
): void {
  ctx.fillStyle = options.theme.muted;
  ctx.font = "12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(money(max), pad, 18);
  ctx.fillText(money(min), pad, height - 8);
  ctx.textAlign = "right";
  ctx.fillText(legend, width - pad, 18);
}

function drawDensePnlBars(
  ctx: CanvasRenderingContext2D,
  values: number[],
  {
    width,
    pad,
    zeroY,
    y,
    win,
    loss,
  }: {
    width: number;
    pad: number;
    zeroY: number;
    y: (value: number) => number;
    win: string;
    loss: string;
  },
): void {
  if (!values.length) return;
  const chartWidth = width - pad * 2;
  const buckets = aggregatePnlValues(values, width, pad);

  const step = buckets.length > 1 ? chartWidth / buckets.length : chartWidth;
  const barWidth = Math.max(1, Math.min(18, step * 0.72));

  buckets.forEach((value, index) => {
    const x = pad + index * step + step / 2;
    const barY = y(value);
    const height = Math.max(1, Math.abs(barY - zeroY));
    ctx.fillStyle = value >= 0 ? win : loss;
    ctx.fillRect(Math.round(x - barWidth / 2), Math.round(Math.min(zeroY, barY)), Math.max(1, barWidth), Math.max(1, Math.round(height)));
  });
}

function aggregatePnlValues(values: number[], width: number, pad: number): number[] {
  const chartWidth = width - pad * 2;
  const maxBars = Math.max(24, Math.floor(chartWidth / 3));
  const bucketSize = Math.max(1, Math.ceil(values.length / maxBars));
  const buckets: number[] = [];

  for (let index = 0; index < values.length; index += bucketSize) {
    const bucket = values.slice(index, index + bucketSize);
    buckets.push(bucket.reduce((total, value) => total + value, 0));
  }

  return buckets;
}

function scale(min: number, max: number, outMin: number, outMax: number): (value: number) => number {
  if (min === max) return () => (outMin + outMax) / 2;
  return (value) => outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function crisp(value: number): number {
  return Math.round(value) + 0.5;
}

function drawPeriodLabels(
  ctx: CanvasRenderingContext2D,
  periods: PeriodPerformance[],
  { width, height, pad, step, options }: { width: number; height: number; pad: number; step: number; options: ChartOptions },
): void {
  const maxLabels = width < 620 ? 3 : 6;
  const interval = Math.max(1, Math.ceil(periods.length / maxLabels));
  const minGap = width < 620 ? 96 : 118;
  const labelY = height - 32;
  let lastLabelX = -Infinity;

  ctx.fillStyle = options.theme.muted;
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  periods.forEach((period, index) => {
    if (index % interval !== 0 && index !== periods.length - 1) return;
    const x = pad + index * step;
    if (x - lastLabelX < minGap) return;
    const label = shortPeriodLabel(period.label);
    if (label.includes("\n")) {
      const [start, end] = label.split("\n");
      ctx.fillText(start || "", x, labelY);
      ctx.fillText(end || "", x, labelY + 13);
    } else {
      ctx.fillText(label, x, labelY + 6);
    }
    lastLabelX = x;
  });
}

function shortPeriodLabel(label: string): string {
  if (label.includes(" - ")) {
    const [start, end] = label.split(" - ");
    return `${(start || "").slice(5)}\n${end || ""}`;
  }
  return label;
}

function chartBounds(values: number[]): { min: number; max: number } {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: -1, max: 1 };
  const magnitude = Math.max(capMax(finite.map(Math.abs)), 1);
  return { min: -magnitude, max: magnitude };
}

function paddedBounds(values: number[]): { min: number; max: number } {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: -1, max: 1 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, Math.abs(max), Math.abs(min), 1);
  const padding = span * 0.08;
  return { min: min - padding, max: max + padding };
}

function capMax(values: number[]): number {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 1;
  const index = Math.min(finite.length - 1, Math.floor(finite.length * 0.9));
  return Math.max(finite[index] || 1, finite[finite.length - 1] * 0.35);
}
