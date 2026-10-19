import assert from "node:assert/strict";
import type { ClosedTrade } from "../src/domain/types.js";
import { drawDistributionChart } from "../src/ui/chart.js";

const labels: string[] = [];
const barHeights: number[] = [];
const context = {
  scale() {},
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
  fillRect(_x: number, _y: number, _width: number, height: number) {
    barHeights.push(height);
  },
  fillText(text: string) { labels.push(text); },
  measureText(text: string) { return { width: text.length * 6 }; },
};
const canvas = {
  width: 0,
  height: 0,
  getBoundingClientRect: () => ({ width: 700, height: 260 }),
  getContext: () => context,
} as unknown as HTMLCanvasElement;
Object.defineProperty(globalThis, "window", {
  value: { devicePixelRatio: 1 },
  configurable: true,
});
const options = {
  locale: "zh-Hant" as const,
  theme: {
    background: "white", ink: "black", muted: "gray", line: "gray",
    win: "green", loss: "red", accent: "teal", accentSoft: "silver",
  },
};
const trades = [-200, -150, -149, -50, -49, -1, 0, 1, 49, 50, 149, 150]
  .map((realizedPnl) => ({ realizedPnl }) as ClosedTrade);

drawDistributionChart(canvas, trades, options);
assert.deepEqual(labels, [
  "0", "大虧", "2", "中虧", "2", "小虧", "2",
  "小贏", "2", "中贏", "2", "大贏", "1",
], "signed P/L order and threshold counts must be preserved, excluding breakeven");
const heights = barHeights.slice(1); // The first rectangle paints the background.
assert.equal(heights[0], heights[1]);
assert.equal(heights[5], heights[0] / 2, "bar heights must reflect observed counts");

labels.length = 0;
barHeights.length = 0;
drawDistributionChart(canvas, [], options);
assert.deepEqual(barHeights.slice(1), [0, 0, 0, 0, 0, 0],
  "empty buckets must not display artificial nonzero bars");

console.log("Chart tests passed");
