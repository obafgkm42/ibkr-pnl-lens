import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseIbkrStatement } from "../src/domain/analytics.js";
import {
  countOptionLifecycleTrades,
  optionLifecycleCodes,
  summarizeOptionLifecycleCodes,
} from "../src/domain/optionLifecycle.js";
import { buildAdviceSignals } from "../src/ui/advice.js";

const xml = await readFile(
  "tests/fixtures/sample-ibkr-statement.xml",
  "utf8",
);

const multiAccountXml = `
<FlexStatements>
  <FlexStatement accountId="DEMO-A" fromDate="20260101" toDate="20260131">
    <Trades>
      <Trade assetCategory="STK" currency="USD" symbol="AAA" description="AAA" underlyingSymbol="AAA" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="10" proceeds="10" ibCommission="-1" cost="0" fifoPnlRealized="125" mtmPnl="125" openCloseIndicator="C" notes="P" transactionType="Sell" />
    </Trades>
    <Orders>
      <Order status="Submitted" transactionType="Buy" />
    </Orders>
  </FlexStatement>
  <FlexStatement accountId="DEMO-B" fromDate="20260101" toDate="20260131">
    <Trades>
      <Trade assetCategory="STK" currency="USD" symbol="BBB" description="BBB" underlyingSymbol="BBB" dateTime="20260103;100000" tradeDate="20260103" quantity="1" tradePrice="10" proceeds="10" ibCommission="-1" cost="100" fifoPnlRealized="-75" mtmPnl="-75" openCloseIndicator="C" notes="L" transactionType="Sell" />
    </Trades>
    <Orders>
      <Order status="Canceled" transactionType="Buy" />
    </Orders>
  </FlexStatement>
</FlexStatements>
`;

const xmlWithMisleadingClosedLot = `
<FlexStatement accountId="DEMO-META" fromDate="20260101" toDate="20260131">
  <Trades>
    <Trade assetCategory="STK" currency="USD" symbol="META" description="META" underlyingSymbol="META" dateTime="20260115;100000" tradeDate="20260115" quantity="1" tradePrice="500" proceeds="500" ibCommission="-1" cost="450" fifoPnlRealized="50" mtmPnl="50" openCloseIndicator="C" notes="P" transactionType="Sell" />
  </Trades>
  <ClosedLots>
    <Lot symbol="META" fifoPnlRealized="-9999" proceeds="-9999" />
  </ClosedLots>
</FlexStatement>
`;

const xmlWithOnlyWinningTrades = `
<FlexStatement accountId="DEMO-WINS" fromDate="20260101" toDate="20260131">
  <Trades>
    <Trade assetCategory="STK" currency="USD" symbol="AAA" description="AAA" underlyingSymbol="AAA" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="10" proceeds="10" ibCommission="0" cost="0" fifoPnlRealized="100" mtmPnl="100" openCloseIndicator="C" notes="P" transactionType="Sell" />
    <Trade assetCategory="STK" currency="USD" symbol="BBB" description="BBB" underlyingSymbol="BBB" dateTime="20260103;100000" tradeDate="20260103" quantity="1" tradePrice="10" proceeds="10" ibCommission="0" cost="0" fifoPnlRealized="50" mtmPnl="50" openCloseIndicator="C" notes="P" transactionType="Sell" />
  </Trades>
</FlexStatement>
`;

const xmlWithMultipleMetaOptionLots = `
<FlexStatement accountId="DEMO-META" fromDate="20260528" toDate="20260604">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="META  260717C00750000" description="META 17JUL26 750 C" underlyingSymbol="META" dateTime="20260528;093730" tradeDate="20260528" quantity="1" tradePrice="5.1904825" proceeds="-519.04825" ibCommission="0" netCash="-519.04825" cost="519.04825" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="ExchTrade" expiry="20260717" putCall="C" strike="750" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="META  260717C00750000" description="META 17JUL26 750 C" underlyingSymbol="META" dateTime="20260601;101045" tradeDate="20260601" quantity="1" tradePrice="3.85" proceeds="-385" ibCommission="-0.76825" netCash="-385.76825" cost="385.76825" fifoPnlRealized="0" mtmPnl="32.5" openCloseIndicator="O" transactionType="ExchTrade" expiry="20260717" putCall="C" strike="750" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="META  260717C00750000" description="META 17JUL26 750 C" underlyingSymbol="META" dateTime="20260604;093351" tradeDate="20260604" quantity="-1" tradePrice="5.2" proceeds="520" ibCommission="-0.782252" netCash="519.217748" cost="-519.04825" fifoPnlRealized="0.169498" mtmPnl="152.5" openCloseIndicator="C" transactionType="ExchTrade" expiry="20260717" putCall="C" strike="750" multiplier="100" />
  </Trades>
  <ClosedLots>
    <Lot symbol="META  260717C00750000" fifoPnlRealized="0.169498" />
  </ClosedLots>
</FlexStatement>
`;

const xmlWithLongShortHolding = `
<FlexStatement accountId="DEMO-HOLD" fromDate="20260101" toDate="20260120">
  <Trades>
    <Trade assetCategory="STK" currency="USD" symbol="AAA" description="AAA" underlyingSymbol="AAA" dateTime="20260102;100000" tradeDate="20260102" quantity="10" tradePrice="10" proceeds="-100" ibCommission="0" netCash="-100" cost="100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" />
    <Trade assetCategory="STK" currency="USD" symbol="AAA" description="AAA" underlyingSymbol="AAA" dateTime="20260105;100000" tradeDate="20260105" quantity="-10" tradePrice="12" proceeds="120" ibCommission="0" netCash="120" cost="-100" fifoPnlRealized="20" mtmPnl="20" openCloseIndicator="C" transactionType="Sell" />
    <Trade assetCategory="STK" currency="USD" symbol="BBB" description="BBB" underlyingSymbol="BBB" dateTime="20260106;100000" tradeDate="20260106" quantity="-5" tradePrice="20" proceeds="100" ibCommission="0" netCash="100" cost="-100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="SellShort" />
    <Trade assetCategory="STK" currency="USD" symbol="BBB" description="BBB" underlyingSymbol="BBB" dateTime="20260106;150000" tradeDate="20260106" quantity="5" tradePrice="19" proceeds="-95" ibCommission="0" netCash="-95" cost="100" fifoPnlRealized="5" mtmPnl="5" openCloseIndicator="C" transactionType="Buy" />
  </Trades>
</FlexStatement>
`;

const xmlWithBoughtPutExposure = `
<FlexStatement accountId="DEMO-PUT" fromDate="20260101" toDate="20260105">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00450000" description="SPY 16JAN26 450 P" underlyingSymbol="SPY" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="3" proceeds="-300" ibCommission="0" netCash="-300" cost="300" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="P" strike="450" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00450000" description="SPY 16JAN26 450 P" underlyingSymbol="SPY" dateTime="20260105;100000" tradeDate="20260105" quantity="-1" tradePrice="5" proceeds="500" ibCommission="0" netCash="500" cost="-300" fifoPnlRealized="200" mtmPnl="200" openCloseIndicator="C" transactionType="Sell" expiry="20260116" putCall="P" strike="450" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const xmlWithBullPutSpread = `
<FlexStatement accountId="DEMO-SPREAD" fromDate="20260101" toDate="20260105">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00450000" description="SPY 16JAN26 450 P" underlyingSymbol="SPY" dateTime="20260102;100000" tradeDate="20260102" quantity="-1" tradePrice="5" proceeds="500" ibCommission="0" netCash="500" cost="-500" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Sell" orderID="SPREAD-OPEN" expiry="20260116" putCall="P" strike="450" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00440000" description="SPY 16JAN26 440 P" underlyingSymbol="SPY" dateTime="20260102;100001" tradeDate="20260102" quantity="1" tradePrice="2" proceeds="-200" ibCommission="0" netCash="-200" cost="200" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" orderID="SPREAD-OPEN" expiry="20260116" putCall="P" strike="440" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00450000" description="SPY 16JAN26 450 P" underlyingSymbol="SPY" dateTime="20260105;100000" tradeDate="20260105" quantity="1" tradePrice="3" proceeds="-300" ibCommission="0" netCash="-300" cost="500" fifoPnlRealized="200" mtmPnl="200" openCloseIndicator="C" transactionType="Buy" orderID="SPREAD-OPEN" expiry="20260116" putCall="P" strike="450" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00440000" description="SPY 16JAN26 440 P" underlyingSymbol="SPY" dateTime="20260105;100001" tradeDate="20260105" quantity="-1" tradePrice="1" proceeds="100" ibCommission="0" netCash="100" cost="-200" fifoPnlRealized="-100" mtmPnl="-100" openCloseIndicator="C" transactionType="Sell" orderID="SPREAD-OPEN" expiry="20260116" putCall="P" strike="440" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const xmlWithIronCondor = `
<FlexStatement accountId="DEMO-CONDOR" fromDate="20260101" toDate="20260105">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00440000" description="SPY 16JAN26 440 P" underlyingSymbol="SPY" dateTime="20260102;100000" tradeDate="20260102" quantity="-1" tradePrice="2" proceeds="200" ibCommission="0" netCash="200" cost="-200" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Sell" orderID="CONDOR-OPEN" expiry="20260116" putCall="P" strike="440" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00430000" description="SPY 16JAN26 430 P" underlyingSymbol="SPY" dateTime="20260102;100001" tradeDate="20260102" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" orderID="CONDOR-OPEN" expiry="20260116" putCall="P" strike="430" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116C00460000" description="SPY 16JAN26 460 C" underlyingSymbol="SPY" dateTime="20260102;100002" tradeDate="20260102" quantity="-1" tradePrice="2" proceeds="200" ibCommission="0" netCash="200" cost="-200" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Sell" orderID="CONDOR-OPEN" expiry="20260116" putCall="C" strike="460" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116C00470000" description="SPY 16JAN26 470 C" underlyingSymbol="SPY" dateTime="20260102;100003" tradeDate="20260102" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" orderID="CONDOR-OPEN" expiry="20260116" putCall="C" strike="470" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00440000" description="SPY 16JAN26 440 P" underlyingSymbol="SPY" dateTime="20260105;100000" tradeDate="20260105" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="200" fifoPnlRealized="100" mtmPnl="100" openCloseIndicator="C" transactionType="Buy" orderID="CONDOR-OPEN" expiry="20260116" putCall="P" strike="440" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00430000" description="SPY 16JAN26 430 P" underlyingSymbol="SPY" dateTime="20260105;100001" tradeDate="20260105" quantity="-1" tradePrice="0.5" proceeds="50" ibCommission="0" netCash="50" cost="-100" fifoPnlRealized="-50" mtmPnl="-50" openCloseIndicator="C" transactionType="Sell" orderID="CONDOR-OPEN" expiry="20260116" putCall="P" strike="430" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116C00460000" description="SPY 16JAN26 460 C" underlyingSymbol="SPY" dateTime="20260105;100002" tradeDate="20260105" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="200" fifoPnlRealized="100" mtmPnl="100" openCloseIndicator="C" transactionType="Buy" orderID="CONDOR-OPEN" expiry="20260116" putCall="C" strike="460" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116C00470000" description="SPY 16JAN26 470 C" underlyingSymbol="SPY" dateTime="20260105;100003" tradeDate="20260105" quantity="-1" tradePrice="0.5" proceeds="50" ibCommission="0" netCash="50" cost="-100" fifoPnlRealized="-50" mtmPnl="-50" openCloseIndicator="C" transactionType="Sell" orderID="CONDOR-OPEN" expiry="20260116" putCall="C" strike="470" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const xmlWithIndependentSameDayOptions = `
<FlexStatement accountId="DEMO-SINGLE" fromDate="20260101" toDate="20260105">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00450000" description="SPY 16JAN26 450 P" underlyingSymbol="SPY" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="3" proceeds="-300" ibCommission="0" netCash="-300" cost="300" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="P" strike="450" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116C00460000" description="SPY 16JAN26 460 C" underlyingSymbol="SPY" dateTime="20260102;100001" tradeDate="20260102" quantity="1" tradePrice="4" proceeds="-400" ibCommission="0" netCash="-400" cost="400" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="C" strike="460" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116P00450000" description="SPY 16JAN26 450 P" underlyingSymbol="SPY" dateTime="20260105;100000" tradeDate="20260105" quantity="-1" tradePrice="5" proceeds="500" ibCommission="0" netCash="500" cost="-300" fifoPnlRealized="200" mtmPnl="200" openCloseIndicator="C" transactionType="Sell" expiry="20260116" putCall="P" strike="450" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260116C00460000" description="SPY 16JAN26 460 C" underlyingSymbol="SPY" dateTime="20260105;100001" tradeDate="20260105" quantity="-1" tradePrice="6" proceeds="600" ibCommission="0" netCash="600" cost="-400" fifoPnlRealized="200" mtmPnl="200" openCloseIndicator="C" transactionType="Sell" expiry="20260116" putCall="C" strike="460" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const xmlWithWeekendAndPremarketCloses = `
<FlexStatement accountId="DEMO-WEEKDAY" fromDate="20260104" toDate="20260109">
  <Trades>
    <Trade assetCategory="STK" currency="USD" symbol="SUN" description="SUN" underlyingSymbol="SUN" dateTime="20260104;100000" tradeDate="20260104" quantity="1" tradePrice="10" proceeds="10" ibCommission="0" cost="0" fifoPnlRealized="40" mtmPnl="40" openCloseIndicator="C" transactionType="Sell" />
    <Trade assetCategory="STK" currency="USD" symbol="PRE" description="PRE" underlyingSymbol="PRE" dateTime="20260105;080000" tradeDate="20260105" quantity="1" tradePrice="10" proceeds="10" ibCommission="0" cost="0" fifoPnlRealized="-30" mtmPnl="-30" openCloseIndicator="C" transactionType="Sell" />
    <Trade assetCategory="STK" currency="USD" symbol="REG" description="REG" underlyingSymbol="REG" dateTime="20260105;100000" tradeDate="20260105" quantity="1" tradePrice="10" proceeds="10" ibCommission="0" cost="0" fifoPnlRealized="25" mtmPnl="25" openCloseIndicator="C" transactionType="Sell" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPY   260109C00450000" description="SPY 09JAN26 450 C" underlyingSymbol="SPY" dateTime="20260109" tradeDate="20260109" quantity="-1" tradePrice="0" proceeds="0" ibCommission="0" netCash="0" cost="100" fifoPnlRealized="-100" mtmPnl="-100" openCloseIndicator="C" notes="Ep" transactionType="Expire" expiry="20260109" putCall="C" strike="450" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const xmlWithCashSettledOption = `
<FlexStatement accountId="DEMO-CASH-SETTLED" fromDate="2026-01-02" toDate="2026-01-16">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" dateTime="20260102;10:00:00" tradeDate="20260102" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="C" strike="6000" multiplier="100" />
  </Trades>
  <OptionEAE>
    <OptionEAE assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" date="2026-01-16" transactionType="Expiration" quantity="-1" tradePrice="25" proceeds="2500" realizedPnl="2400" mtmPnl="2500" code="CD;Ep" expiry="2026-01-16" putCall="C" strike="6000.0000" multiplier="100" />
  </OptionEAE>
</FlexStatement>
`;

const xmlWithWorthlessOptionExpiration = `
<FlexStatement accountId="DEMO-WORTHLESS" fromDate="20260102" toDate="20260116">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPXW  260116P05000000" description="SPXW 16JAN26 5000 P" underlyingSymbol="SPX" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="1.75" proceeds="-175" ibCommission="0" netCash="-175" cost="175" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="P" strike="5000" multiplier="100" />
  </Trades>
  <OptionEAE>
    <OptionEAE assetCategory="OPT" currency="USD" symbol="SPXW  260116P05000000" description="SPXW 16JAN26 5000 P" underlyingSymbol="SPX" date="20260116" transactionType="Expiration" quantity="-1" tradePrice="0" proceeds="0" mtmPnl="-175" code="Ep" expiry="20260116" putCall="P" strike="5000" multiplier="100" />
  </OptionEAE>
</FlexStatement>
`;

const xmlWithDuplicateCashSettlementLifecycle = `
<FlexStatement accountId="DEMO-CASH-DEDUPE" fromDate="20260102" toDate="20260116">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="C" strike="6000" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" dateTime="20260116" tradeDate="20260116" quantity="-1" tradePrice="0" proceeds="0" ibCommission="0" netCash="0" cost="100" fifoPnlRealized="-100" mtmPnl="-100" openCloseIndicator="C" notes="Ep" transactionType="Expire" expiry="20260116" putCall="C" strike="6000" multiplier="100" />
  </Trades>
  <OptionEAE>
    <OptionEAE assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" date="20260116" transactionType="Expiration" quantity="-1" tradePrice="25" proceeds="2500" realizedPnl="2400" mtmPnl="2500" code="CD;Ep" expiry="20260116" putCall="C" strike="6000" multiplier="100" />
  </OptionEAE>
</FlexStatement>
`;

const xmlWithExercisedCashSettlementTrade = `
<FlexStatement accountId="DEMO-EXERCISE" fromDate="20260102" toDate="20260116">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" dateTime="20260102;100000" tradeDate="20260102" quantity="1" tradePrice="1" proceeds="-100" ibCommission="0" netCash="-100" cost="100" fifoPnlRealized="0" mtmPnl="0" openCloseIndicator="O" transactionType="Buy" expiry="20260116" putCall="C" strike="6000" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="SPXW  260116C06000000" description="SPXW 16JAN26 6000 C" underlyingSymbol="SPX" dateTime="20260116" tradeDate="20260116" quantity="-1" tradePrice="0" proceeds="0" ibCommission="0" netCash="0" cost="100" fifoPnlRealized="2400" mtmPnl="2500" transactionType="Exercise" expiry="20260116" putCall="C" strike="6000" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const xmlWithOfficialOptionLifecycleCodes = `
<FlexStatement accountId="DEMO-CODES" fromDate="20260116" toDate="20260116">
  <Trades>
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO1 260116C00100000" description="DEMO1 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="-10" notes="Ep" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO2 260116C00100000" description="DEMO2 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="20" notes="C,Ex" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO3 260116C00100000" description="DEMO3 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="30" notes="A" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO4 260116C00100000" description="DEMO4 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="40" notes="CD" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO5 260116C00100000" description="DEMO5 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="50" notes="AEx" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO6 260116C00100000" description="DEMO6 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="60" notes="MEx" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
    <Trade assetCategory="OPT" currency="USD" symbol="DEMO7 260116C00100000" description="DEMO7 16JAN26 100 C" tradeDate="20260116" quantity="-1" fifoPnlRealized="70" notes="GEA" transactionType="Lifecycle" expiry="20260116" putCall="C" strike="100" multiplier="100" />
  </Trades>
</FlexStatement>
`;

const report = parseIbkrStatement(xml);
const multiAccountReport = parseIbkrStatement(multiAccountXml);
const secondAccountReport = parseIbkrStatement(multiAccountXml, 1);
const misleadingLotReport = parseIbkrStatement(xmlWithMisleadingClosedLot);
const onlyWinningTradesReport = parseIbkrStatement(xmlWithOnlyWinningTrades);
const multipleMetaLotsReport = parseIbkrStatement(xmlWithMultipleMetaOptionLots);
const longShortHoldingReport = parseIbkrStatement(xmlWithLongShortHolding);
const boughtPutExposureReport = parseIbkrStatement(xmlWithBoughtPutExposure);
const bullPutSpreadReport = parseIbkrStatement(xmlWithBullPutSpread);
const ironCondorReport = parseIbkrStatement(xmlWithIronCondor);
const independentSameDayOptionsReport = parseIbkrStatement(xmlWithIndependentSameDayOptions);
const weekendAndPremarketClosesReport = parseIbkrStatement(xmlWithWeekendAndPremarketCloses);
const cashSettledOptionReport = parseIbkrStatement(xmlWithCashSettledOption);
const worthlessOptionExpirationReport = parseIbkrStatement(xmlWithWorthlessOptionExpiration);
const duplicateCashSettlementReport = parseIbkrStatement(xmlWithDuplicateCashSettlementLifecycle);
const exercisedCashSettlementTradeReport = parseIbkrStatement(xmlWithExercisedCashSettlementTrade);
const officialOptionLifecycleCodesReport = parseIbkrStatement(xmlWithOfficialOptionLifecycleCodes);

// Basic parsing
assert.ok(report.profile.maskedAccountId.includes("*"));
assert.ok(report.trades.length > 0);
assert.ok(report.closedTrades.length > 0);
assert.equal(multiAccountReport.accounts.length, 2);
assert.equal(multiAccountReport.selectedAccountIndex, 0);
assert.equal(secondAccountReport.selectedAccountIndex, 1);
assert.equal(multiAccountReport.trades.length, 1);
assert.equal(secondAccountReport.trades.length, 1);
assert.equal(multiAccountReport.metrics.net, 125);
assert.equal(secondAccountReport.metrics.net, -75);
assert.equal(multiAccountReport.metrics.canceledOrderCount, 0);
assert.equal(secondAccountReport.metrics.canceledOrderCount, 1);
assert.equal(misleadingLotReport.metrics.net, 50);
assert.equal(misleadingLotReport.metrics.executionCount, 1);
assert.equal(misleadingLotReport.metrics.closedCount, 1);
assert.equal(misleadingLotReport.metrics.winRate, 1);
assert.equal(misleadingLotReport.metrics.payoffRatio, Infinity);
assert.equal(onlyWinningTradesReport.metrics.profitFactor, Infinity);
assert.equal(onlyWinningTradesReport.metrics.payoffRatio, Infinity);
assert.equal(round2(multipleMetaLotsReport.metrics.net), 133.45);
assert.equal(multipleMetaLotsReport.metrics.closedCount, 1);
assert.equal(round2(multipleMetaLotsReport.closedTrades[0]?.fifoRealizedPnl || 0), 0.17);
assert.equal(round2(multipleMetaLotsReport.closedTrades[0]?.realizedPnl || 0), 133.45);
assert.equal(round2(multipleMetaLotsReport.metrics.medianHoldingDays), 2.97);
assert.equal(multipleMetaLotsReport.directionSummaries[0]?.direction, "long");
assert.equal(longShortHoldingReport.closedPositionSlices.length, 2);
assert.equal(round2(longShortHoldingReport.metrics.medianHoldingDays), 1.6);
assert.deepEqual(longShortHoldingReport.directionSummaries.map((row) => row.direction), ["long", "short"]);
assert.equal(longShortHoldingReport.holdingPeriods.some((row) => row.bucket === "intraday"), true);
assert.equal(longShortHoldingReport.holdingPeriods.some((row) => row.bucket === "swing"), true);
assert.equal(boughtPutExposureReport.closedPositionSlices[0]?.direction, "short");
assert.deepEqual(boughtPutExposureReport.directionSummaries.map((row) => row.direction), ["short"]);
assert.equal(bullPutSpreadReport.closedPositionSlices.length, 1);
assert.equal(bullPutSpreadReport.closedPositionSlices[0]?.direction, "long");
assert.deepEqual(bullPutSpreadReport.directionSummaries.map((row) => row.direction), ["long"]);
assert.equal(ironCondorReport.closedPositionSlices.length, 1);
assert.equal(ironCondorReport.closedPositionSlices[0]?.direction, "neutral");
assert.deepEqual(ironCondorReport.directionSummaries.map((row) => row.direction), ["neutral"]);
assert.equal(independentSameDayOptionsReport.closedPositionSlices.length, 2);
assert.deepEqual(independentSameDayOptionsReport.directionSummaries.map((row) => row.direction), ["long", "short"]);

// OptionEAE lifecycle events should include cash settlement without inflating executions.
assert.equal(cashSettledOptionReport.profile.period, "2026-01-02 - 2026-01-16");
assert.equal(cashSettledOptionReport.metrics.executionCount, 1);
assert.equal(cashSettledOptionReport.trades.length, 2);
assert.equal(cashSettledOptionReport.closedTrades.length, 1);
assert.equal(cashSettledOptionReport.metrics.net, 2400);
assert.equal(cashSettledOptionReport.metrics.autoExpiryCount, 1);
assert.equal(cashSettledOptionReport.closedTrades[0]?.netCash, 2500);
assert.equal(cashSettledOptionReport.closedTrades[0]?.code.includes("CD"), true);
assert.equal(cashSettledOptionReport.closedPositionSlices[0]?.pnl, 2400);

// A worthless OptionEAE expiration should still realize the opening premium loss.
assert.equal(worthlessOptionExpirationReport.metrics.executionCount, 1);
assert.equal(worthlessOptionExpirationReport.closedTrades.length, 1);
assert.equal(worthlessOptionExpirationReport.metrics.net, -175);
assert.equal(worthlessOptionExpirationReport.metrics.autoExpiryCount, 1);

// Prefer the authoritative OptionEAE cash settlement when Trades repeats the lifecycle close.
assert.equal(duplicateCashSettlementReport.metrics.executionCount, 2);
assert.equal(duplicateCashSettlementReport.trades.length, 2);
assert.equal(duplicateCashSettlementReport.closedTrades.length, 1);
assert.equal(duplicateCashSettlementReport.metrics.net, 2400);
assert.equal(duplicateCashSettlementReport.metrics.autoExpiryCount, 1);

// Exercise-coded Trades must preserve IBKR's reported cash-settlement P/L.
assert.equal(exercisedCashSettlementTradeReport.metrics.executionCount, 2);
assert.equal(exercisedCashSettlementTradeReport.closedTrades.length, 1);
assert.equal(exercisedCashSettlementTradeReport.closedTrades[0]?.close, true);
assert.equal(exercisedCashSettlementTradeReport.closedTrades[0]?.code, "C;Ex");
assert.equal(exercisedCashSettlementTradeReport.closedTrades[0]?.fifoRealizedPnl, 2400);
assert.equal(exercisedCashSettlementTradeReport.closedTrades[0]?.realizedPnl, 2400);
assert.equal(exercisedCashSettlementTradeReport.metrics.net, 2400);
assert.equal(exercisedCashSettlementTradeReport.closedPositionSlices[0]?.pnl, 2400);

// Recognize all IBKR lifecycle codes that can close or settle an option.
assert.equal(officialOptionLifecycleCodesReport.closedTrades.length, 7);
assert.equal(officialOptionLifecycleCodesReport.closedTrades.every((trade) => trade.close), true);
assert.deepEqual(
  officialOptionLifecycleCodesReport.closedTrades.map((trade) =>
    trade.actionCodes.find((code) => ["A", "AEx", "CD", "Ep", "Ex", "GEA", "MEx"].includes(code))),
  ["Ep", "Ex", "A", "CD", "AEx", "MEx", "GEA"],
);
assert.equal(officialOptionLifecycleCodesReport.metrics.autoExpiryCount, 1);
assert.equal(officialOptionLifecycleCodesReport.metrics.net, 260);
assert.deepEqual(
  summarizeOptionLifecycleCodes(officialOptionLifecycleCodesReport.closedTrades),
  [
    { code: "Ep", count: 1 },
    { code: "Ex", count: 1 },
    { code: "A", count: 1 },
    { code: "CD", count: 1 },
    { code: "AEx", count: 1 },
    { code: "MEx", count: 1 },
    { code: "GEA", count: 1 },
  ],
);
assert.equal(
  countOptionLifecycleTrades(officialOptionLifecycleCodesReport.closedTrades),
  7,
);
assert.deepEqual(
  optionLifecycleCodes({ actionCodes: ["C", "Ex", "CD"] }),
  ["Ex", "CD"],
);
assert.deepEqual(optionLifecycleCodes({ actionCodes: ["C"] }), []);

// Metrics should be internally valid
assert.ok(Number.isFinite(report.metrics.net));
assert.ok(Number.isFinite(report.metrics.profitFactor));
assert.ok(Number.isFinite(report.metrics.winRate));
assert.ok(report.metrics.executionCount > 0);
assert.ok(report.metrics.canceledOrderCount >= 0);

// Time buckets should be generated
assert.ok(report.daily.length > 0);
assert.ok(report.weekly.length > 0);
assert.ok(report.monthly.length > 0);
assert.deepEqual(report.intradaySessions.map((row) => row.session), ["morning", "midday", "late"]);
assert.equal(report.intradaySessions.find((row) => row.session === "midday")?.count, 1);
assert.equal(round2(report.intradaySessions.find((row) => row.session === "midday")?.average || 0), -110);
assert.equal(round2(report.intradaySessions.find((row) => row.session === "midday")?.medianPnl || 0), -110);
assert.ok(report.weekdays.length > 0);
assert.ok(report.weekdays.every((row) => row.count === row.wins + row.losses));
assert.deepEqual(weekendAndPremarketClosesReport.weekdays.map((row) => row.weekday), [1, 5]);
assert.equal(weekendAndPremarketClosesReport.weekdays[0]?.count, 1);
assert.equal(weekendAndPremarketClosesReport.weekdays[0]?.pnl, 25);
assert.equal(weekendAndPremarketClosesReport.weekdays[1]?.count, 1);
assert.equal(weekendAndPremarketClosesReport.weekdays[1]?.pnl, -100);

// Weekly/monthly PnL should reconcile with total net PnL
assert.equal(
  round2(report.weekly.reduce((total, row) => total + row.pnl, 0)),
  round2(report.metrics.net),
);

assert.equal(
  round2(report.monthly.reduce((total, row) => total + row.pnl, 0)),
  round2(report.metrics.net),
);

assert.equal(
  round2(report.weekdays.reduce((total, row) => total + row.pnl, 0)),
  round2(report.metrics.net),
);

// Win/loss counts should reconcile inside each bucket
assert.ok(report.weekly.every((row) => row.count === row.wins + row.losses));
assert.ok(report.monthly.every((row) => row.count === row.wins + row.losses));

// Asset and option-focused buckets should be available for review
assert.ok(report.assetGroups.some((row) => row.group === "option"));
assert.ok(report.assetGroups.some((row) => row.group === "stock"));
assert.ok(report.optionUnderlyingDays.length > 0);
assert.ok(report.closedPositionSlices.length > 0);
assert.deepEqual(report.directionSummaries.map((row) => row.direction), ["long", "short"]);

// Symbols should be parsed and cleaned
assert.ok(report.symbols.length > 0);
assert.ok(report.symbols.every((row) => row.symbol.trim().length > 0));

assert.ok(
  !report.symbols.some((row) =>
    ["C", "C;Ep", "C;L", "C;L;P", "C;Ex", "C;P"].includes(row.symbol),
  ),
);

// Strategy / advice signals should stay in the UI boundary.
const advice = buildAdviceSignals(report);
assert.ok(Array.isArray(advice.bestLoserWins));
assert.ok(Array.isArray(advice.offlineAdvice));
assert.ok(advice.discipline.every((signal) => signal.id && signal.group === "discipline"));

const allWinAdvice = buildAdviceSignals(onlyWinningTradesReport);
const allWinProfitFactorSignal = allWinAdvice.discipline.find((signal) => signal.id.startsWith("profit_factor_"));
assert.equal(allWinProfitFactorSignal?.id, "profit_factor_healthy");
assert.equal(allWinProfitFactorSignal?.data.profitFactor, Infinity);
assert.equal(
  allWinAdvice.discipline.some((signal) => signal.id === "high_winrate_weak_payoff"),
  false,
);

if (report.metrics.autoExpiryCount > 0) {
  assert.ok(
    report.closedTrades.some(
      (trade) => trade.autoExpiry && trade.code.includes("Ep"),
    ),
  );
}

console.log(
  JSON.stringify(
    {
      trades: report.trades.length,
      closed: report.closedTrades.length,
      canceled: report.metrics.canceledOrderCount,
      net: Number(report.metrics.net.toFixed(2)),
      profitFactor: Number(report.metrics.profitFactor.toFixed(2)),
      winRate: Number((report.metrics.winRate * 100).toFixed(1)),
      topSymbol: report.symbols[0]?.symbol,
      autoExpiry: report.metrics.autoExpiryCount,
      weeks: report.weekly.length,
      months: report.monthly.length,
      weekdays: report.weekdays.length,
      assetGroups: report.assetGroups.map((row) => row.group),
      optionDays: report.optionUnderlyingDays.length,
    },
    null,
    2,
  ),
);

function round2(value: number): number {
  return Number(value.toFixed(2));
}
