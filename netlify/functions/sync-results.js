const https = require('https');

const FB_URL = "https://wc-predictions-36203-default-rtdb.firebaseio.com";

const NORM = {
  "Korea Republic":"South Korea","Czechia":"Czech Republic",
  "Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast","Ivory Coast":"Ivory Coast",
  "Bosnia & Herzegovina":"Bosnia and Herzegovina","Bosnia-Herzegovina":"Bosnia and Herzegovina",
  "Congo DR":"DR Congo","Democratic Republic of Congo":"DR Congo","DRC":"DR Congo",
  "Cabo Verde":"Cape Verde","USA":"United States","United States of America":"United States",
  "Curaçao":"Curaçao","Curacao":"Curaçao","Turkiye":"Turkey","Türkiye":"Turkey",
};
const norm = t => NORM[String(t||'').trim()] || String(t||'').trim();

// Verified from Al Jazeera / FIFA official schedule
const LOOKUP = {
  "Mexico|South Africa":"M001",
  "South Korea|Czech Republic":"M002",
  "Canada|Bosnia and Herzegovina":"M003",
  "United States|Paraguay":"M004",
  "Qatar|Switzerland":"M005",
  "Brazil|Morocco":"M006",
  "Haiti|Scotland":"M007",
  "Australia|Turkey":"M008",
  "Germany|Curaçao":"M009",
  "Netherlands|Japan":"M010",
  "Ivory Coast|Ecuador":"M011",
  "Sweden|Tunisia":"M012",
  "Spain|Cape Verde":"M013",
  "Belgium|Egypt":"M014",
  "Saudi Arabia|Uruguay":"M015",
  "Iran|New Zealand":"M016",
  "France|Senegal":"M017",
  "Iraq|Norway":"M018",
  "Argentina|Algeria":"M019",
  "Austria|Jordan":"M020",
  "Portugal|DR Congo":"M021",
  "England|Croatia":"M022",
  "Ghana|Panama":"M023",
  "Uzbekistan|Colombia":"M024",
  "Czech Republic|South Africa":"M025",
  "Switzerland|Bosnia and Herzegovina":"M026",
  "Canada|Qatar":"M027",
  "Mexico|South Korea":"M028",
  "Scotland|Morocco":"M029",
  "United States|Australia":"M030",
  "Brazil|Haiti":"M031",
  "Turkey|Paraguay":"M032",
  "Netherlands|Sweden":"M033",
  "Germany|Ivory Coast":"M034",
  "Ecuador|Curaçao":"M035",
  "Tunisia|Japan":"M036",
  "Spain|Saudi Arabia":"M037",
  "Belgium|Iran":"M038",
  "Uruguay|Cape Verde":"M039",
  "New Zealand|Egypt":"M040",
  "Argentina|Austria":"M041",
  "France|Iraq":"M042",
  "Norway|Senegal":"M043",
  "Jordan|Algeria":"M044",
  "Portugal|Uzbekistan":"M045",
  "England|Ghana":"M046",
  "Panama|Croatia":"M047",
  "Colombia|DR Congo":"M048",
  "Switzerland|Canada":"M049",
  "Bosnia and Herzegovina|Qatar":"M050",
  "Scotland|Brazil":"M051",
  "Morocco|Haiti":"M052",
  "Czech Republic|Mexico":"M053",
  "South Africa|South Korea":"M054",
  "Ecuador|Germany":"M055",
  "Curaçao|Ivory Coast":"M056",
  "Japan|Sweden":"M057",
  "Tunisia|Netherlands":"M058",
  "Turkey|United States":"M059",
  "Paraguay|Australia":"M060",
  "Norway|France":"M061",
  "Senegal|Iraq":"M062",
  "Cape Verde|Saudi Arabia":"M063",
  "Uruguay|Spain":"M064",
  "Egypt|Iran":"M065",
  "New Zealand|Belgium":"M066",
  "Panama|England":"M067",
  "Croatia|Ghana":"M068",
  "Colombia|Portugal":"M069",
  "DR Congo|Uzbekistan":"M070",
  "Algeria|Austria":"M071",
  "Jordan|Argentina":"M072",
};

// Build reverse lookup
const LOOKUP_REV = {};
Object.entries(LOOKUP).forEach(([k,v]) => {
  const [h,a] = k.split('|');
  LOOKUP_REV[`${a}|${h}`] = v;
});

const findMid = (h, a) => {
  const hn = norm(h), an = norm(a);
  return LOOKUP[`${hn}|${an}`] || LOOKUP_REV[`${hn}|${an}`] || null;
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
