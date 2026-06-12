// Netlify Scheduled Function — no external imports needed
// Schedule is defined in netlify.toml instead

const FOOTBALL_DATA_KEY = "5285a7be898d4a4d9c6b262da48366ec";
const FIREBASE_URL = "https://wc-predictions-36203-default-rtdb.firebaseio.com";

const TEAM_NORM = {"Korea Republic":"South Korea","Czechia":"Czech Republic","Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast","Bosnia & Herzegovina":"Bosnia and Herzegovina","Congo DR":"DR Congo","Democratic Republic of Congo":"DR Congo","Cabo Verde":"Cape Verde","USA":"United States"};
function norm(t){ return TEAM_NORM[t]||t; }

const LOOKUP = {"Mexico|South Africa":"M001","South Korea|Czech Republic":"M002","Canada|Bosnia and Herzegovina":"M003","United States|Paraguay":"M004","Haiti|Scotland":"M005","Australia|Turkey":"M006","Brazil|Morocco":"M007","Qatar|Switzerland":"M008","Ivory Coast|Ecuador":"M009","Germany|Curaçao":"M010","Netherlands|Japan":"M011","Sweden|Tunisia":"M012","Saudi Arabia|Uruguay":"M013","Spain|Cape Verde":"M014","Iran|New Zealand":"M015","Belgium|Egypt":"M016","France|Senegal":"M017","Iraq|Norway":"M018","Argentina|Algeria":"M019","Austria|Jordan":"M020","Ghana|Panama":"M021","England|Croatia":"M022","Portugal|DR Congo":"M023","Uzbekistan|Colombia":"M024","Czech Republic|South Africa":"M025","Switzerland|Bosnia and Herzegovina":"M026","Canada|Qatar":"M027","Mexico|South Korea":"M028","Brazil|Haiti":"M029","Scotland|Morocco":"M030","Turkey|Paraguay":"M031","United States|Australia":"M032","Germany|Ivory Coast":"M033","Ecuador|Curaçao":"M034","Netherlands|Sweden":"M035","Tunisia|Japan":"M036","Uruguay|Cape Verde":"M037","Spain|Saudi Arabia":"M038","Belgium|Iran":"M039","New Zealand|Egypt":"M040","Norway|Senegal":"M041","France|Iraq":"M042","Argentina|Austria":"M043","Jordan|Algeria":"M044","England|Ghana":"M045","Panama|Croatia":"M046","Portugal|Uzbekistan":"M047","Colombia|DR Congo":"M048","Scotland|Brazil":"M049","Morocco|Haiti":"M050","Switzerland|Canada":"M051","Bosnia and Herzegovina|Qatar":"M052","Czech Republic|Mexico":"M053","South Africa|South Korea":"M054","Curaçao|Ivory Coast":"M055","Ecuador|Germany":"M056","Japan|Sweden":"M057","Tunisia|Netherlands":"M058","Turkey|United States":"M059","Paraguay|Australia":"M060","Norway|France":"M061","Senegal|Iraq":"M062","Egypt|Iran":"M063","New Zealand|Belgium":"M064","Cape Verde|Saudi Arabia":"M065","Uruguay|Spain":"M066","Croatia|Ghana":"M067","England|Panama":"M068","Algeria|Austria":"M069","Jordan|Argentina":"M070","Colombia|Portugal":"M071","DR Congo|Uzbekistan":"M072"};

exports.handler = async function(event, context) {
  try {
    const now = new Date();
    if(now < new Date("2026-06-11") || now > new Date("2026-07-20")) {
      return { statusCode: 200, body: "Outside tournament window" };
    }

    const r = await fetch(
      "https://api.football-data.org/v4/competitions/2000/matches?status=FINISHED",
      { headers: { "X-Auth-Token": FOOTBALL_DATA_KEY } }
    );
    if(!r.ok) throw new Error("API " + r.status);
    const { matches = [] } = await r.json();

    const fbr = await fetch(`${FIREBASE_URL}/actuals.json`);
    const existing = (await fbr.json()) || {};

    let changed = 0;
    matches.forEach(m => {
      const home = norm(m.homeTeam?.name || "");
      const away = norm(m.awayTeam?.name || "");
      const mid  = LOOKUP[`${home}|${away}`];
      if(!mid) return;
      const hg = m.score?.fullTime?.home;
      const ag = m.score?.fullTime?.away;
      if(hg == null || ag == null) return;
      if(!existing[mid] || existing[mid].hg !== hg || existing[mid].ag !== ag) {
        existing[mid] = { hg, ag, source: "football-data", ts: Date.now() };
        changed++;
      }
    });

    if(changed > 0) {
      await fetch(`${FIREBASE_URL}/actuals.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing)
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, changed }) };
  } catch(e) {
    return { statusCode: 500, body: e.message };
  }
};
