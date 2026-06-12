const { schedule } = require('@netlify/functions');

// ── CONFIG ──────────────────────────────────────────────────────────
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_KEY || '5285a7be898d4a4d9c6b262da48366ec';
const FIREBASE_URL          = 'https://wc-predictions-36203-default-rtdb.firebaseio.com';
const WC_COMPETITION_ID     = 2000; // FIFA World Cup on football-data.org
const WC2026_SEASON         = 2026;

// Match number → our internal match ID mapping
// football-data.org returns matches with home/away team names
// We map by team names to our M001-M104 IDs

const TEAM_NORM = {
  'Mexico': 'Mexico', 'South Africa': 'South Africa',
  'Korea Republic': 'South Korea', 'South Korea': 'South Korea',
  'Czech Republic': 'Czech Republic', 'Czechia': 'Czech Republic',
  'Canada': 'Canada', 'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'United States': 'United States', 'USA': 'United States',
  'Paraguay': 'Paraguay', 'Haiti': 'Haiti', 'Scotland': 'Scotland',
  'Australia': 'Australia', 'Turkey': 'Turkey', 'Brazil': 'Brazil',
  'Morocco': 'Morocco', 'Qatar': 'Qatar', 'Switzerland': 'Switzerland',
  "Côte d'Ivoire": 'Ivory Coast', 'Ivory Coast': 'Ivory Coast',
  'Ecuador': 'Ecuador', 'Germany': 'Germany', 'Curaçao': 'Curaçao',
  'Netherlands': 'Netherlands', 'Japan': 'Japan', 'Sweden': 'Sweden',
  'Tunisia': 'Tunisia', 'Saudi Arabia': 'Saudi Arabia', 'Uruguay': 'Uruguay',
  'Spain': 'Spain', 'Cape Verde': 'Cape Verde', 'Cabo Verde': 'Cape Verde',
  'Iran': 'Iran', 'New Zealand': 'New Zealand', 'Belgium': 'Belgium',
  'Egypt': 'Egypt', 'France': 'France', 'Senegal': 'Senegal',
  'Iraq': 'Iraq', 'Norway': 'Norway', 'Argentina': 'Argentina',
  'Algeria': 'Algeria', 'Austria': 'Austria', 'Jordan': 'Jordan',
  'Ghana': 'Ghana', 'Panama': 'Panama', 'England': 'England',
  'Croatia': 'Croatia', 'Portugal': 'Portugal', 'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo', 'Democratic Republic of Congo': 'DR Congo',
  'Uzbekistan': 'Uzbekistan', 'Colombia': 'Colombia',
};

// Build lookup: "HomeTeam|AwayTeam" → matchId
const MATCH_LOOKUP = {
  'Mexico|South Africa': 'M001', 'South Korea|Czech Republic': 'M002',
  'Canada|Bosnia and Herzegovina': 'M003', 'United States|Paraguay': 'M004',
  'Haiti|Scotland': 'M005', 'Australia|Turkey': 'M006',
  'Brazil|Morocco': 'M007', 'Qatar|Switzerland': 'M008',
  'Ivory Coast|Ecuador': 'M009', 'Germany|Curaçao': 'M010',
  'Netherlands|Japan': 'M011', 'Sweden|Tunisia': 'M012',
  'Saudi Arabia|Uruguay': 'M013', 'Spain|Cape Verde': 'M014',
  'Iran|New Zealand': 'M015', 'Belgium|Egypt': 'M016',
  'France|Senegal': 'M017', 'Iraq|Norway': 'M018',
  'Argentina|Algeria': 'M019', 'Austria|Jordan': 'M020',
  'Ghana|Panama': 'M021', 'England|Croatia': 'M022',
  'Portugal|DR Congo': 'M023', 'Uzbekistan|Colombia': 'M024',
  'Czech Republic|South Africa': 'M025', 'Switzerland|Bosnia and Herzegovina': 'M026',
  'Canada|Qatar': 'M027', 'Mexico|South Korea': 'M028',
  'Brazil|Haiti': 'M029', 'Scotland|Morocco': 'M030',
  'Turkey|Paraguay': 'M031', 'United States|Australia': 'M032',
  'Germany|Ivory Coast': 'M033', 'Ecuador|Curaçao': 'M034',
  'Netherlands|Sweden': 'M035', 'Tunisia|Japan': 'M036',
  'Uruguay|Cape Verde': 'M037', 'Spain|Saudi Arabia': 'M038',
  'Belgium|Iran': 'M039', 'New Zealand|Egypt': 'M040',
  'Norway|Senegal': 'M041', 'France|Iraq': 'M042',
  'Argentina|Austria': 'M043', 'Jordan|Algeria': 'M044',
  'England|Ghana': 'M045', 'Panama|Croatia': 'M046',
  'Portugal|Uzbekistan': 'M047', 'Colombia|DR Congo': 'M048',
  'Scotland|Brazil': 'M049', 'Morocco|Haiti': 'M050',
  'Switzerland|Canada': 'M051', 'Bosnia and Herzegovina|Qatar': 'M052',
  'Czech Republic|Mexico': 'M053', 'South Africa|South Korea': 'M054',
  'Curaçao|Ivory Coast': 'M055', 'Ecuador|Germany': 'M056',
  'Japan|Sweden': 'M057', 'Tunisia|Netherlands': 'M058',
  'Turkey|United States': 'M059', 'Paraguay|Australia': 'M060',
  'Norway|France': 'M061', 'Senegal|Iraq': 'M062',
  'Egypt|Iran': 'M063', 'New Zealand|Belgium': 'M064',
  'Cape Verde|Saudi Arabia': 'M065', 'Uruguay|Spain': 'M066',
  'Croatia|Ghana': 'M067', 'England|Panama': 'M068',
  'Algeria|Austria': 'M069', 'Jordan|Argentina': 'M070',
  'Colombia|Portugal': 'M071', 'DR Congo|Uzbekistan': 'M072',
};

function normTeam(name) {
  return TEAM_NORM[name] || name;
}

function makeMatchKey(home, away) {
  return `${normTeam(home)}|${normTeam(away)}`;
}

// ── FETCH from football-data.org ─────────────────────────────────────
async function fetchMatches() {
  const url = `https://api.football-data.org/v4/competitions/${WC_COMPETITION_ID}/matches?season=${WC2026_SEASON}&status=FINISHED`;
  const resp = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`football-data.org error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ── READ from Firebase ───────────────────────────────────────────────
async function readFirebase(path) {
  const resp = await fetch(`${FIREBASE_URL}/${path}.json`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) return null;
  return resp.json();
}

// ── WRITE to Firebase ────────────────────────────────────────────────
async function writeFirebase(path, data) {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────
const handler = schedule('*/5 * * * *', async () => {
  try {
    // Only run during tournament period
    const now = new Date();
    const start = new Date('2026-06-11T00:00:00Z');
    const end   = new Date('2026-07-20T00:00:00Z');
    if (now < start || now > end) {
      console.log('Outside tournament window, skipping');
      return { statusCode: 200 };
    }

    if (!FOOTBALL_DATA_API_KEY) {
      throw new Error('FOOTBALL_DATA_KEY env var not set');
    }

    // Fetch finished matches from football-data.org
    const data = await fetchMatches();
    const matches = data.matches || [];

    if (!matches.length) {
      console.log('No finished matches yet');
      return { statusCode: 200 };
    }

    // Read existing actuals from Firebase
    const existing = (await readFirebase('actuals')) || {};

    let changed = 0;
    matches.forEach(m => {
      const home = normTeam(m.homeTeam?.name || m.homeTeam?.shortName || '');
      const away = normTeam(m.awayTeam?.name || m.awayTeam?.shortName || '');
      const key  = makeMatchKey(home, away);
      const mid  = MATCH_LOOKUP[key];
      if (!mid) return;

      const hg = m.score?.fullTime?.home ?? m.score?.fullTime?.homeTeam;
      const ag = m.score?.fullTime?.away ?? m.score?.fullTime?.awayTeam;
      if (hg == null || ag == null) return;

      const ex = existing[mid];
      if (!ex || ex.hg !== hg || ex.ag !== ag) {
        existing[mid] = { hg, ag, source: 'football-data', ts: Date.now() };
        changed++;
        console.log(`Updated ${mid} (${home} ${hg}-${ag} ${away})`);
      }
    });

    if (changed > 0) {
      await writeFirebase('actuals', existing);
      console.log(`Synced ${changed} new/updated results to Firebase`);
    } else {
      console.log('No changes — all results up to date');
    }

    return { statusCode: 200, body: JSON.stringify({ synced: changed }) };

  } catch (err) {
    console.error('sync-results error:', err.message);
    return { statusCode: 500, body: err.message };
  }
});

module.exports = { handler };
