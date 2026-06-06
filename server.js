import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// --- ECOS (한국은행) 설정 ---
function loadConfig() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'data', 'config.json'), 'utf-8'));
  } catch { return {}; }
}
function getEcosKey() { return loadConfig().ecosApiKey || 'sample'; }

const ECOS_KR_BONDS = {
  kr_bond2y:  { stat: '817Y002', item1: '010195000', name: '국고채 2년 금리',  category: '한국 채권' },
  kr_bond3y:  { stat: '817Y002', item1: '010200000', name: '국고채 3년 금리',  category: '한국 채권' },
  kr_bond5y:  { stat: '817Y002', item1: '010200001', name: '국고채 5년 금리',  category: '한국 채권' },
  kr_bond10y: { stat: '817Y002', item1: '010210000', name: '국고채 10년 금리', category: '한국 채권' },
  kr_bond30y: { stat: '817Y002', item1: '010230000', name: '국고채 30년 금리', category: '한국 채권' },
};

const ECOS_KR_ECONOMY = {
  kr_base_rate: { stat: '722Y001', item1: '0101000', name: '한국 기준금리', category: '한국 경제' },
};

const ECOS_MONTHLY = {
  unemployment:  { stat: '901Y027', item1: 'I61BC',   item2: 'I28B', name: '한국 실업률',   category: '한국 경제' },
  employment:    { stat: '901Y027', item1: 'I61E',    item2: 'I28B', name: '한국 고용률',   category: '한국 경제' },
  cpi:           { stat: '901Y009', item1: '0',       item2: null,  name: '한국 물가상승률', category: '한국 경제' },
  forex_reserve: { stat: '732Y001', item1: '99',      item2: null,  name: '한국 외환보유액', category: '한국 경제' },
  us_base_rate:  { stat: '902Y006', item1: 'US',      item2: null,  name: '미국 기준금리', category: '미국 경제' },
};

// --- BLS (미국 노동통계국) 지표 ---
const BLS_INDICATORS = {
  us_unemployment: { seriesId: 'LNS14000000', name: '미국 실업률',     category: '미국 경제' },
  us_employment:   { seriesId: 'LNS12300000', name: '미국 고용률',     category: '미국 경제' },
  us_cpi:          { seriesId: 'CUSR0000SA0', name: '미국 물가상승률', category: '미국 경제' },
};

// --- EIA (미국 에너지정보청) 지표 ---
const EIA_INDICATORS = {
  crude_inventory:    { type: 'us', name: '미국 원유재고 (SPR 제외)', category: '원자재' },
  kr_oil_inventory:   { type: 'kr', name: '한국 석유재고',            category: '원자재' },
};

// --- 미국 채권 (Yahoo Finance) ---
const US_BOND_INDICATORS = {
  us2y:     { ticker: '2YY=F',  name: '미국 국채 2년 금리',  category: '미국 채권' },
  us5y:     { ticker: '^FVX',   name: '미국 국채 5년 금리',  category: '미국 채권' },
  us10y:    { ticker: '^TNX',   name: '미국 국채 10년 금리', category: '미국 채권' },
  us30y:    { ticker: '^TYX',   name: '미국 국채 30년 금리', category: '미국 채권' },
};

// --- FRED (세인트루이스 연준) 지표 ---
const FRED_INDICATORS = {
  fed_balance: { seriesId: 'WALCL', name: 'Fed 대차대조표', category: '미국 경제' },
};

// --- Yahoo Finance 지표 ---
const YAHOO_INDICATORS = {
  kospi:    { ticker: '^KS11',       name: 'KOSPI',              category: '한국 주식' },
  kosdaq:   { ticker: '^KQ11',       name: 'KOSDAQ',             category: '한국 주식' },

  sp500:    { ticker: '^GSPC',       name: 'S&P 500',            category: '해외 주식' },
  nasdaq:   { ticker: '^IXIC',       name: 'NASDAQ',             category: '해외 주식' },
  nikkei:   { ticker: '^N225',       name: '닛케이 225',          category: '해외 주식' },
  hsi:      { ticker: '^HSI',        name: '항셍',               category: '해외 주식' },
  shanghai: { ticker: '000001.SS',   name: '상해종합',            category: '해외 주식' },
  dax:      { ticker: '^GDAXI',      name: 'DAX',                category: '해외 주식' },
  sox:      { ticker: '^SOX',        name: '필라델피아 반도체',     category: '해외 주식' },

  oil:      { ticker: 'CL=F',        name: 'WTI 유가',            category: '원자재' },
  brent:    { ticker: 'BZ=F',        name: '브렌트유',             category: '원자재' },
  gold:     { ticker: 'GC=F',        name: '금',                  category: '원자재' },
  silver:   { ticker: 'SI=F',        name: '은',                  category: '원자재' },
  natgas:   { ticker: 'NG=F',        name: '천연가스',             category: '원자재' },
  copper:   { ticker: 'HG=F',        name: '구리',                category: '원자재' },

  usdkrw:   { ticker: 'KRW=X',       name: 'USD/KRW',            category: '환율' },
  dxy:      { ticker: 'DX-Y.NYB',    name: '달러 인덱스',          category: '환율' },
  eurusd:   { ticker: 'EURUSD=X',    name: 'EUR/USD',             category: '환율' },
  usdjpy:   { ticker: 'JPY=X',       name: 'USD/JPY',             category: '환율' },
  usdcny:   { ticker: 'CNY=X',       name: 'USD/CNY',             category: '환율' },

  btc:      { ticker: 'BTC-USD',     name: '비트코인',             category: '암호화폐' },
  eth:      { ticker: 'ETH-USD',     name: '이더리움',             category: '암호화폐' },

  vix:      { ticker: '^VIX',        name: 'VIX 공포지수',         category: '변동성' },

  nps:      { ticker: null,          name: '국민연금 주식비중',      category: '기타' },
};

const ECOS_DAILY = { ...ECOS_KR_BONDS, ...ECOS_KR_ECONOMY };
const toEntries = (obj, src) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { ...v, source: src }]));
const ALL_INDICATORS = {
  ...toEntries(ECOS_KR_BONDS, 'ecos_daily'),     // 한국 채권
  ...toEntries(US_BOND_INDICATORS, 'yahoo'),     // 미국 채권
  ...toEntries(ECOS_KR_ECONOMY, 'ecos_daily'),   // 한국 기준금리
  ...toEntries(ECOS_MONTHLY, 'ecos_monthly'),    // 한국 경제 (실업률, 고용률, 물가)
  ...toEntries(BLS_INDICATORS, 'bls'),           // 미국 경제 (실업률, 고용률, 물가)
  ...toEntries(FRED_INDICATORS, 'fred'),         // Fed 대차대조표
  ...toEntries(EIA_INDICATORS, 'eia'),           // 원유재고
  ...toEntries(YAHOO_INDICATORS, 'yahoo'),       // 주식, 원자재, 환율, 암호화폐 등
};

const DEFAULT_ON = new Set(['kospi', 'kr_bond10y', 'oil', 'usdkrw']);

const FETCH_DAYS  = { '1w': 12, '1m': 38, '3m': 100, '6m': 195, '1y': 380 };
const ACTUAL_DAYS = { '1w': 7,  '1m': 30, '3m': 90,  '6m': 180, '1y': 365 };

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function loadNpsData() {
  try { return JSON.parse(readFileSync(join(__dirname, 'data', 'nps.json'), 'utf-8')); }
  catch { return []; }
}

// --- ECOS 데이터 가져오기 ---
async function fetchEcosRaw(statCode, cycle, startDate, endDate, item1, item2, maxRows) {
  const key = getEcosKey();
  const limit = key === 'sample' ? 10 : maxRows;
  let url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/${limit}/${statCode}/${cycle}/${startDate}/${endDate}/${item1}`;
  if (item2) url += `/${item2}`;

  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`ECOS API ${resp.status}`);
  const json = await resp.json();
  if (json.RESULT?.CODE) throw new Error(json.RESULT.MESSAGE);
  return json.StatisticSearch?.row || [];
}

async function fetchEcosDaily(key, period) {
  const conf = ECOS_DAILY[key];
  const cacheKey = `ecos:${key}:${period}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const fetchDays = FETCH_DAYS[period] || 38;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - fetchDays);
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');

  const rows = await fetchEcosRaw(conf.stat, 'D', fmt(start), fmt(end), conf.item1, null, 500);
  const data = rows.map(r => ({
    date: r.TIME.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
    close: parseFloat(r.DATA_VALUE),
  })).filter(d => !isNaN(d.close));

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

async function fetchEcosMonthly(key, period) {
  const conf = ECOS_MONTHLY[key];
  const cacheKey = `ecos:${key}:${period}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const actualDays = ACTUAL_DAYS[period] || 30;
  const end = new Date();
  const start = new Date();

  const isCpi = key === 'cpi' || key === 'us_cpi';
  const extraMonths = isCpi ? 16 : 3;
  start.setMonth(start.getMonth() - Math.ceil(actualDays / 30) - extraMonths);

  const fmtM = d => String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0');
  const rows = await fetchEcosRaw(conf.stat, 'M', fmtM(start), fmtM(end), conf.item1, conf.item2, 100);

  let data;
  const lastDay = ym => {
    const y = parseInt(ym.slice(0, 4)), m = parseInt(ym.slice(4));
    return ym.slice(0, 4) + '-' + ym.slice(4) + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  };

  if (isCpi) {
    const byMonth = {};
    rows.forEach(r => { byMonth[r.TIME] = parseFloat(r.DATA_VALUE); });
    const months = Object.keys(byMonth).sort();
    data = months.filter(m => {
      const prevYear = String(parseInt(m.slice(0, 4)) - 1) + m.slice(4);
      return byMonth[prevYear] != null;
    }).map(m => {
      const prevYear = String(parseInt(m.slice(0, 4)) - 1) + m.slice(4);
      const yoy = ((byMonth[m] - byMonth[prevYear]) / byMonth[prevYear]) * 100;
      return { date: lastDay(m), close: parseFloat(yoy.toFixed(2)) };
    });
  } else {
    data = rows.map(r => ({
      date: lastDay(r.TIME),
      close: parseFloat(r.DATA_VALUE),
    })).filter(d => !isNaN(d.close));
  }

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// --- BLS (미국 노동통계국) 데이터 가져오기 ---
async function fetchBls(key, period) {
  const conf = BLS_INDICATORS[key];
  const cacheKey = `bls:${key}:${period}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const actualDays = ACTUAL_DAYS[period] || 30;
  const endYear = new Date().getFullYear();
  const startYear = key === 'us_cpi'
    ? endYear - Math.ceil(actualDays / 365) - 1
    : endYear - Math.max(1, Math.ceil(actualDays / 365));

  const blsKey = loadConfig().blsApiKey || '';
  const payload = { seriesid: [conf.seriesId], startyear: String(startYear), endyear: String(endYear) };
  if (blsKey) payload.registrationkey = blsKey;

  const resp = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`BLS API ${resp.status}`);
  const json = await resp.json();
  if (json.status !== 'REQUEST_SUCCEEDED') throw new Error(json.message?.[0] || 'BLS error');

  const series = json.Results?.series?.[0]?.data || [];
  const lastDay = (y, m) => {
    const d = new Date(parseInt(y), parseInt(m), 0).getDate();
    return `${y}-${m}-${String(d).padStart(2, '0')}`;
  };

  const sorted = series
    .filter(r => r.period.startsWith('M'))
    .map(r => ({ ym: r.year + r.period.replace('M', ''), value: parseFloat(r.value), year: r.year, month: r.period.replace('M', '') }))
    .filter(r => !isNaN(r.value))
    .sort((a, b) => a.ym.localeCompare(b.ym));

  let data;
  if (key === 'us_cpi') {
    const byMonth = {};
    sorted.forEach(r => { byMonth[r.ym] = r.value; });
    data = sorted.filter(r => {
      const prevYm = String(parseInt(r.year) - 1) + r.month;
      return byMonth[prevYm] != null;
    }).map(r => {
      const prevYm = String(parseInt(r.year) - 1) + r.month;
      const yoy = ((r.value - byMonth[prevYm]) / byMonth[prevYm]) * 100;
      return { date: lastDay(r.year, r.month), close: parseFloat(yoy.toFixed(2)) };
    });
  } else {
    data = sorted.map(r => ({ date: lastDay(r.year, r.month), close: r.value }));
  }

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// --- EIA (미국 에너지정보청) 데이터 가져오기 ---
async function fetchEia(key, period) {
  const cacheKey = `eia:${key}:${period}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  let url;
  const fetchDays = FETCH_DAYS[period] || 38;
  const start = new Date();
  start.setDate(start.getDate() - fetchDays);

  if (key === 'crude_inventory') {
    const startStr = start.toISOString().slice(0, 10);
    url = `https://api.eia.gov/v2/petroleum/stoc/wstk/data?api_key=DEMO_KEY&frequency=weekly&data%5B0%5D=value&facets%5Bproduct%5D%5B%5D=EPC0&facets%5Bduoarea%5D%5B%5D=NUS&facets%5Bprocess%5D%5B%5D=SAX&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=asc&start=${startStr}&length=100`;
  } else if (key === 'kr_oil_inventory') {
    const startM = start.toISOString().slice(0, 7);
    url = `https://api.eia.gov/v2/international/data?api_key=DEMO_KEY&frequency=monthly&data%5B0%5D=value&facets%5BactivityId%5D%5B%5D=5&facets%5BcountryRegionId%5D%5B%5D=KOR&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=asc&start=${startM}&length=50`;
  }

  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`EIA API ${resp.status}`);
  const json = await resp.json();

  const rows = json.response?.data || [];
  let data;
  if (key === 'kr_oil_inventory') {
    data = rows.map(r => {
      const ym = r.period;
      const y = parseInt(ym.slice(0, 4)), m = parseInt(ym.slice(5, 7));
      const lastD = new Date(y, m, 0).getDate();
      return { date: `${ym}-${String(lastD).padStart(2, '0')}`, close: parseFloat(r.value) };
    }).filter(d => !isNaN(d.close));
  } else {
    data = rows.map(r => ({ date: r.period, close: parseFloat(r.value) })).filter(d => !isNaN(d.close));
  }

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// --- FRED CSV 데이터 가져오기 ---
async function fetchFred(key, period) {
  const conf = FRED_INDICATORS[key];
  const cacheKey = `fred:${key}:${period}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const fetchDays = FETCH_DAYS[period] || 38;
  const start = new Date();
  start.setDate(start.getDate() - fetchDays);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = new Date().toISOString().slice(0, 10);

  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${conf.seriesId}&cosd=${startStr}&coed=${endStr}`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`FRED ${resp.status}`);
  const text = await resp.text();

  const data = text.trim().split('\n').slice(1).map(line => {
    const [date, val] = line.split(',');
    return { date, close: parseFloat(val) };
  }).filter(d => !isNaN(d.close) && d.date !== '.');

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// --- Yahoo Finance 데이터 가져오기 ---
async function fetchYahoo(ticker, period) {
  const cacheKey = `yahoo:${ticker}:${period}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const fetchDays = FETCH_DAYS[period] || 38;
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - fetchDays * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  if (!resp.ok) throw new Error(`Yahoo API ${resp.status}`);

  const json = await resp.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const data = timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    close: closes[i],
  })).filter(d => d.close != null);

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

function toPercentChange(quotes, period, monthly = false) {
  if (!quotes?.length) return [];

  const actualDays = ACTUAL_DAYS[period] || 30;
  const buffer = monthly ? 62 : 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - actualDays - buffer);
  cutoff.setHours(0, 0, 0, 0);
  const filtered = quotes.filter(q => new Date(q.date) >= cutoff);
  if (!filtered.length) return [];
  const base = filtered[0].close;
  if (!base) return [];
  return filtered.map((q, i) => {
    const prev = i > 0 ? filtered[i - 1].close : q.close;
    return {
      date: q.date,
      value: parseFloat((((q.close - base) / base) * 100).toFixed(3)),
      delta: parseFloat((((q.close - prev) / prev) * 100).toFixed(3)),
      raw: parseFloat(q.close.toFixed(2)),
    };
  });
}

function npsToPercentChange(npsData, period) {
  if (!npsData?.length) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (ACTUAL_DAYS[period] || 30));
  const filtered = npsData.filter(d => new Date(d.date) >= cutoff);
  if (!filtered.length) return [];
  const base = filtered[0].ratio;
  return filtered.map((d, i) => {
    const prev = i > 0 ? filtered[i - 1].ratio : d.ratio;
    return {
      date: d.date,
      value: parseFloat((((d.ratio - base) / base) * 100).toFixed(3)),
      delta: parseFloat((((d.ratio - prev) / prev) * 100).toFixed(3)),
      raw: d.ratio,
    };
  });
}

app.get('/api/config', (req, res) => {
  const config = Object.entries(ALL_INDICATORS).map(([key, val]) => ({
    key, name: val.name, category: val.category, defaultOn: DEFAULT_ON.has(key),
  }));
  res.json(config);
});

app.get('/api/data', async (req, res) => {
  const { period = '1m', indicators = '' } = req.query;
  const selected = indicators.split(',').filter(k => ALL_INDICATORS[k]);
  const results = {};

  await Promise.all(selected.map(async (key) => {
    const ind = ALL_INDICATORS[key];
    if (key === 'nps') {
      const series = npsToPercentChange(loadNpsData(), period);
      results[key] = { name: ind.name, data: series, latest: series.at(-1) || null };
      return;
    }
    try {
      let quotes;
      const monthly = ind.source === 'ecos_monthly' || ind.source === 'bls' || (ind.source === 'eia' && key === 'kr_oil_inventory');
      if (ind.source === 'ecos_daily') {
        quotes = await fetchEcosDaily(key, period);
      } else if (ind.source === 'ecos_monthly') {
        quotes = await fetchEcosMonthly(key, period);
      } else if (ind.source === 'bls') {
        quotes = await fetchBls(key, period);
      } else if (ind.source === 'fred') {
        quotes = await fetchFred(key, period);
      } else if (ind.source === 'eia') {
        quotes = await fetchEia(key, period);
      } else {
        quotes = await fetchYahoo(ind.ticker, period);
      }
      const series = toPercentChange(quotes, period, monthly);
      results[key] = { name: ind.name, data: series, latest: series.at(-1) || null };
    } catch (err) {
      console.error(`[${key}] ${err.message}`);
      results[key] = { name: ind.name, data: [], latest: null, error: err.message };
    }
  }));

  res.json(results);
});

app.get('/api/nps', (req, res) => res.json(loadNpsData()));

app.post('/api/nps', (req, res) => {
  try {
    writeFileSync(join(__dirname, 'data', 'nps.json'), JSON.stringify(req.body, null, 2), 'utf-8');
    cache.clear();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/ecos-key', (req, res) => {
  const key = getEcosKey();
  res.json({ configured: key !== 'sample', key: key === 'sample' ? 'sample' : '***' });
});

app.post('/api/ecos-key', (req, res) => {
  try {
    const configPath = join(__dirname, 'data', 'config.json');
    const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : {};
    config.ecosApiKey = req.body.key;
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    cache.clear();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const key = getEcosKey();
  console.log(`경제지표 대시보드: http://localhost:${PORT}`);
  if (key === 'sample') console.log('⚠ ECOS API: sample 키 사용 중 (10건 제한). 정식 키 등록: ecos.bok.or.kr/api/#/');
});
