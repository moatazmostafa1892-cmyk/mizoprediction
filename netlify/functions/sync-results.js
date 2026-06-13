// Netlify Function — syncs match results from football-data.org to Firebase
// Runs every 5 min (scheduled) AND on-demand when frontend calls it

const https = require('https');

const FOOTBALL_DATA_KEY = "5285a7be898d4a4d9c6b262da48366ec";
const FIREBASE_URL = "https://wc-predictions-36203-default-rtdb.firebaseio.com";

const TEAM_NORM = {
  "Korea Republic":"South Korea","Czechia":"Czech Republic",
  "Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast",
  "Bosnia & Herzegovina":"Bosnia and Herzegovina","Bosnia-Herzegovina":"Bosnia and Herzegovina",
  "Congo DR":"DR Congo","Democratic Republic of Congo":"DR Congo","DRC":"DR Congo",
  "Cabo Verde":"Cape Verde","USA":"United States","United States of America":"United States",
  "Curaçao":"Curaçao","Curacao":"Curaçao",
};
function norm(t){ return TEAM_NORM[String(t||'').trim()] || String(t||'').trim(); }

const LOOKUP = {
  "Mexico|South Africa":"M001","South Korea|Czech Republic":"M002",
  "Canada|Bosnia and Herzegovina":"M003","United States|Paraguay":"M004",
  "Haiti|Scotland":"M005","Australia|Turkey":"M006","Brazil|Morocco":"M007",
  "Qatar|Switzerland":"M008","Ivory Coast|Ecuador":"M009","Germany|Curaçao":"M010",
  "Netherlands|Japan":"M011","Sweden|Tunisia":"M012","Saudi Arabia|Uruguay":"M013",
  "Spain|Cape Verde":"M014","Iran|New Zealand":"M015","Belgium|Egypt":"M016",
  "France|Senegal":"M017","Iraq|Norway":"M018","Argentina|Algeria":"M019",
  "Austria|Jordan":"M020","Ghana|Panama":"M021","England|Croatia":"M022",
  "Portugal|DR Congo":"M023","Uzbekistan|Colombia":"M024",
  "Czech Republic|South Africa":"M025","Switzerland|Bosnia and Herzegovina":"M026",
  "Canada|Qatar":"M027","Mexico|South Korea":"M028","Brazil|Haiti":"M029",
  "Scotland|Morocco":"M030","Turkey|Paraguay":"M031","United States|Australia":"M032",
  "Germany|Ivory Coast":"M033","Ecuador|Curaçao":"M034","Netherlands|Sweden":"M035",
  "Tunisia|Japan":"M036","Uruguay|Cape Verde":"M037","Spain|Saudi Arabia":"M038",
  "Belgium|Iran":"M039","New Zealand|Egypt":"M040","Norway|Senegal":"M041",
  "France|Iraq":"M042","Argentina|Austria":"M043","Jordan|Algeria":"M044",
  "England|Ghana":"M045","Panama|Croatia":"M046","Portugal|Uzbekistan":"M047",
  "Colombia|DR Congo":"M048","Scotland|Brazil":"M049","Morocco|Haiti":"M050",
  "Switzerland|Canada":"M051","Bosnia and Herzegovina|Qatar":"M052",
  "Czech Republic|Mexico":"M053","South Africa|South Korea":"M054",
  "Curaçao|Ivory Coast":"M055","Ecuador|Germany":"M056","Japan|Sweden":"M057",
  "Tunisia|Netherlands":"M058","Turkey|United States":"M059","Paraguay|Australia":"M060",
  "Norway|France":"M061","Senegal|Iraq":"M062","Egypt|Iran":"M063",
  "New Zealand|Belgium":"M064","Cape Verde|Saudi Arabia":"M065","Uruguay|Spain":"M066",
  "Croatia|Ghana":"M067","England|Panama":"M068","Algeria|Austria":"M069",
  "Jordan|Argentina":"M070","Colombia|Portugal":"M071","DR Congo|Uzbekistan":"M072",
};

// Build reverse lookup for swapped home/away
const LOOKUP_REV = {};
Object.entries(LOOKUP).forEach(([k,v]) => {
  const [h,a] = k.split('|');
  LOOKUP_REV[`${a}|${h}`] = v;
});

function findMid(home, away) {
  const h = norm(home), a = norm(away);
  return LOOKUP[`${h}|${a}`] || LOOKUP_REV[`${h}|${a}`] || null;
}

// Simple HTTPS request helper (no fetch needed)
function httpsGet(url, headers={}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'GET',
      headers: { 'User-Agent': 'WC2026-Predictions/1.0', ...headers }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function httpsPut(url, body) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'WC2026-Predictions/1.0'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Fetch finished matches from football-data.org
    const apiRes = await httpsGet(
      "https://api.football-data.org/v4/competitions/2000/matches?status=FINISHED",
      { "X-Auth-Token": FOOTBALL_DATA_KEY }
    );

    if(apiRes.status !== 200) {
      throw new Error(`football-data API returned ${apiRes.status}: ${apiRes.body.slice(0,200)}`);
    }

    const { matches = [] } = JSON.parse(apiRes.body);

    // 2. Get existing actuals from Firebase
    const fbRes = await httpsGet(`${FIREBASE_URL}/actuals.json`);
    const existing = JSON.parse(fbRes.body) || {};

    // 3. Find changed results
    const updates = {};
    const unmatched = [];

    matches.forEach(m => {
      const home = norm(m.homeTeam?.name || m.homeTeam?.shortName || "");
      const away = norm(m.awayTeam?.name || m.awayTeam?.shortName || "");
      const mid = findMid(home, away);

      if(!mid) {
        unmatched.push(`${home} vs ${away}`);
        return;
      }

      const hg = m.score?.fullTime?.home;
      const ag = m.score?.fullTime?.away;
      if(hg == null || ag == null) return;

      const ex = existing[mid];
      if(!ex || ex.source !== 'manual') {
        if(!ex || ex.hg !== hg || ex.ag !== ag) {
          updates[mid] = { hg, ag, source: 'football-data', ts: Date.now() };
        }
      }
    });

    // 4. Write each result individually to Firebase
    const changed = Object.keys(updates).length;
    if(changed > 0) {
      await Promise.all(
        Object.entries(updates).map(([mid, result]) =>
          httpsPut(`${FIREBASE_URL}/actuals/${mid}.json`, result)
        )
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, changed, total: matches.length, updates, unmatched })
    };

  } catch(e) {
    console.error('sync-results error:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
