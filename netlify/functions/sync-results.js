// Netlify Function — syncs match results from worldcup26.ir to Firebase
// Runs every 5 min (scheduled) AND on-demand when frontend calls it

const https = require('https');

const FB_URL = "https://wc-predictions-36203-default-rtdb.firebaseio.com";

const NORM = {
  "Korea Republic":"South Korea","Czechia":"Czech Republic",
  "Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast",
  "Bosnia & Herzegovina":"Bosnia and Herzegovina","Bosnia-Herzegovina":"Bosnia and Herzegovina",
  "Congo DR":"DR Congo","Democratic Republic of Congo":"DR Congo",
  "Cabo Verde":"Cape Verde","USA":"United States","United States of America":"United States",
  "Curaçao":"Curaçao","Curacao":"Curaçao","Turkiye":"Turkey","Türkiye":"Turkey",
};
const norm = t => NORM[String(t||'').trim()] || String(t||'').trim();

const LOOKUP = {
  "Mexico|South Africa":"M001","South Korea|Czech Republic":"M002",
  "Canada|Bosnia and Herzegovina":"M003","United States|Paraguay":"M004",
  "Haiti|Scotland":"M005","Australia|Turkey":"M006","Brazil|Morocco":"M007",
  "Qatar|Switzerland":"M008","Germany|Curaçao":"M009","Ivory Coast|Ecuador":"M011",
  "Netherlands|Japan":"M010","Sweden|Tunisia":"M012","Saudi Arabia|Uruguay":"M013",
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

const findMid = (h, a) => {
  const hn = norm(h), an = norm(a);
  return LOOKUP[`${hn}|${an}`] || LOOKUP[`${an}|${hn}`] || null;
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject).setTimeout(12000, function(){ this.destroy(); reject(new Error('timeout')); });
  });
}

function put(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async () => {
  const H = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    const res = await get('https://worldcup26.ir/get/games');
    if(res.status !== 200) throw new Error(`worldcup26.ir returned ${res.status}`);

    const data = JSON.parse(res.body);
    const games = data.games || data || [];

    const fbRes = await get(`${FB_URL}/actuals.json`);
    const existing = JSON.parse(fbRes.body) || {};

    const updates = {}, unmatched = [];

    for(const g of games) {
      if(String(g.finished||'').toUpperCase() !== 'TRUE') continue;
      const hg = parseFloat(g.home_score);
      const ag = parseFloat(g.away_score);
      if(isNaN(hg) || isNaN(ag)) continue;

      const hName = String(g.home_team_name_en || g.home_team || g.home || '').trim();
      const aName = String(g.away_team_name_en || g.away_team || g.away || '').trim();
      const mid = findMid(hName, aName);

      if(!mid) { unmatched.push(`${norm(hName)} vs ${norm(aName)}`); continue; }

      const ex = existing[mid];
      if(ex && ex.source === 'manual') continue;
      if(!ex || ex.hg !== hg || ex.ag !== ag) {
        updates[mid] = { hg, ag, source: 'api', ts: Date.now() };
      }
    }

    const changed = Object.keys(updates).length;
    for(const [mid, val] of Object.entries(updates)) {
      await put(`${FB_URL}/actuals/${mid}.json`, val);
    }

    return { statusCode: 200, headers: H,
      body: JSON.stringify({ ok: true, changed, total: games.length, updates, unmatched }) };

  } catch(e) {
    return { statusCode: 200, headers: H,
      body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
