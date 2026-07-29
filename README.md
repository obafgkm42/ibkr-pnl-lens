# IBKR PnL Lens

Fully offline IBKR Flex XML analyzer for profit factor, payoff ratio, realized P/L, option auto-expiry risk, period performance, and trade discipline review.

This project is designed for traders who want a quick, private review of their Interactive Brokers activity data without sending statements, account identifiers, or API keys to any external service.

## Demo

![IBKR PnL Lens interface preview](demo/demo.png)

## Features

- Upload an IBKR Flex XML file directly in the browser.
- Fully offline analysis: no LLM, no API key, no backend, no analytics API.
- Masks account identifiers in the UI.
- Separates executions from canceled orders when the XML includes order records.
- Includes option auto-expiry (`Ep`) in closed trade analysis instead of dropping it as noise.
- Reports profit factor, payoff ratio, win rate, expectancy, commissions, daily realized P/L, weekly/monthly period quality, symbol impact, and rule-based discipline notes.
- Separates stock and option performance, with option review grouped by underlying and trade date.
- Supports light/dark theme and local UI language switching for Traditional Chinese, Simplified Chinese, English, Japanese, Korean, Spanish, German, French, Russian, and Finnish.
- Built for static Cloudflare Workers asset deployment with Wrangler.

## Data Format

The app supports **IBKR Flex XML** only. CSV support was intentionally removed because ordinary IBKR activity CSV exports are multi-section reports with repeated headers and duplicated field names, which makes them fragile for analysis.

Recommended Flex Query sections:

- Account Information
- Trades
- Option Exercises, Assignments & Expirations
- Orders / Order History, if you want canceled order analysis

The current analyzer uses `<Trade>` records as execution records and `<OptionEAE>` records for exercises, assignments, expirations, and cash settlement. Realized P/L is calculated by matching closing executions against the most recent open executions for the same symbol, using execution cash flow when available. IBKR-reported realized P/L takes precedence for option lifecycle records, including `Ep` (expired position), `Ex` (exercise), `A` (assignment), `CD` (cash delivery), `AEx`, `MEx`, and `GEA`, so cash-settled proceeds are not replaced by a zero-cash expiry calculation. `<Lot>` records are ignored for P/L analytics because they can duplicate or break down the same closed activity already represented by trades. If your Flex XML contains `<Order>` records, canceled orders are counted separately.

## Privacy

IBKR PnL Lens runs in your browser. The uploaded XML is parsed locally and is not transmitted by the app.

The UI masks account identifiers such as `U12345678` into a redacted format. Still, treat exported brokerage statements as sensitive files and avoid committing them to Git.

## Not Financial Advice

IBKR PnL Lens is for education, trade review, and personal journaling only. It does not provide financial, investment, tax, legal, or trading advice.

Any rule-based notes shown by the app are generated from the uploaded statement data and should be treated as review prompts, not recommendations to buy, sell, hold, size, or manage any position.

## Metrics

- **Net realized P/L**: Sum of realized P/L from matched closing executions.
- **Profit Factor**: Gross profit divided by gross loss.
- **Win Rate**: Winning closed trades divided by closed trades with non-zero realized P/L.
- **Payoff Ratio**: Average win divided by average loss.
- **Expectancy**: Average realized P/L per closed trade.
- **Auto Expiry**: Option trades with `Ep` notes are included and highlighted.
- **Period Performance**: Weekly or monthly net realized P/L with profit factor and payoff ratio.
- **Asset Breakdown**: Stock and option performance are calculated separately.
- **Option Underlying-Date Review**: Option trades are grouped by underlying and date to expose concentrated wins, losses, and expiry issues.

## Exporting Flex XML From IBKR

In IBKR Client Portal:

1. Open `Performance & Reports`.
2. Go to `Flex Queries`.
3. Create or edit an Activity Flex Query.
4. Choose XML output.
5. Include Trades.
6. Include Option Exercises, Assignments & Expirations with proceeds, realized P/L, and contract fields.
7. Add Orders / Order History if you need canceled order analysis.
8. Run the query and download the XML file.

## Local Development

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

The production bundle is written to `dist/`.

## Cloudflare Wrangler Deployment

This repo is configured for Cloudflare Workers static asset deployment through `wrangler.toml`:

```toml
name = "ibkr-pnl-lens"
compatibility_date = "2026-06-04"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

Deploy with:

```bash
npm run deploy
```

The script runs `npm run build` first and then `wrangler deploy`.

If you want to preview the built bundle locally before deploying:

```bash
npm run build
npm run preview
```

## Cloudflare Pages Alternative

Cloudflare Pages settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `20`

If you still prefer Pages, connect the GitHub repo and use the settings above. The app is a static frontend and does not require a backend worker.

## Repository Hygiene

- Do not commit real brokerage statements, Flex XML exports, account IDs, local file paths, or screenshots containing personal data.
- Keep test fixtures synthetic and small.
- Use lower-case Conventional Commits, for example `feat: add period chart` or `fix: mask account id`.
- Before publishing changes, run `npm test` and `npm run build`.

## Status

This is an early version. The current focus is accurate IBKR Flex XML parsing, privacy, clear offline reporting, and deployment as a small static Cloudflare app.
