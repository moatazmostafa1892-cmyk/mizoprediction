const https = require('https');

const FD_KEY  = "5285a7be898d4a4d9c6b262da48366ec";
const FB_URL  = "https://wc-predictions-36203-default-rtdb.firebaseio.com";

const NORM = {
  "Korea Republic":"South Korea","Czechia":"Czech Republic",
  "Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast",
  "Bosnia & Herzegovina":"Bosnia and Herzegovina",
  "Congo DR":"DR Congo","Democratic Republic of Congo":"DR Congo",
  "Cabo Verde":"Cape Verde","USA":"United States",
  "Curaçao":"Curaçao","Curacao":"Curaçao",
};
const norm = t => NORM[String(t||'').trim()] || String(t||'').trim();

const LOOKUP = {"Mexico|South Africa":"M001","South Korea|Czech Republic":"M002","Canada|Bosnia and Herzegovina":"M003","United States|Paraguay":"M004","Haiti|Scotland":"M005","Australia|Turkey":"M006","Brazil|Morocco":"M007","Qatar|Switzerland":"M008","Ivory Coast|Ecuador":"M009","Germany|Curaçao":"M010","Netherlands|Japan":"M011","Sweden|Tunisia":"M012","Saudi Arabia|Uruguay":"M013","Spain|Cape Verde":"M014","Iran|New Zealand":"M015","Belgium|Egypt":"M016","France|Senegal":"M017","Iraq|Norway":"M018","Argentina|Algeria":"M019","Austria|Jordan":"M020","Ghana|Panama":"M021","England|Croatia":"M022","Portugal|DR Congo":"M023","Uzbekistan|Colombia":"M024","Czech Republic|South Africa":"M025","Switzerland|Bosnia and Herzegovina":"M026","Canada|Qatar":"M027","Mexico|South Korea":"M028","Brazil|Haiti":"M029","Scotland|Morocco":"M030","Turkey|Paraguay":"M031","United States|Australia":"M032","Germany|Ivory Coast":"M033","Ecuador|Curaçao":"M034","Netherlands|Sweden":"M035","Tunisia|Japan":"M036","Uruguay|Cape Verde":"M037","Spain|Saudi Arabia":"M038","Belgium|Iran":"M039","New Zealand|Egypt":"M040","Norway|Senegal":"M041","France|Iraq":"M042","Argentina|Austria":"M043","Jordan|Algeria":"M044","England|Ghana":"M045","Panama|Croatia":"M046","Portugal|Uzbekistan":"M047","Colombia|DR Congo":"M048","Scotland|Brazil":"M049","Morocco|Haiti":"M050","Switzerland|Canada":"M051","Bosnia and Herzegovina|Qatar":"M052","Czech Republic|Mexico":"M053","South Africa|South Korea":"M054","Curaçao|Ivory Coast":"M055","Ecuador|Germany":"M056","Japan|Sweden":"M057","Tunisia|Netherlands":"M058","Turkey|United States":"M059","Paraguay|Australia":"M060","Norway|France":"M061","Senegal|Iraq":"M062","Egypt|Iran":"M063","New Zealand|Belgium":"M064","Cape Verde|Saudi Arabia":"M065","Uruguay|Spain":"M066","Croatia|Ghana":"M067","England|Panama":"M068","Algeria|Austria":"M069","Jordan|Argentina":"M070","Colombia|Portugal":"M071","DR Congo|Uzbekistan":"M072"};

function findMid(h,a){
  h=norm(h); a=norm(a);
  return LOOKUP[`${h}|${a}`]||LOOKUP[`${a}|${h}`]||null;
}

function req(method, url, headers={}, body=null){
  return new Promise((res,rej)=>{
    const u = new URL(url);
    const opt = {hostname:u.hostname,path:u.pathname+u.search,method,
      headers:{'User-Agent':'wc2026','Content-Type':'application/json',...headers}};
    if(body){ const b=JSON.stringify(body); opt.headers['Content-Length']=Buffer.byteLength(b); }
    const r = https.request(opt, resp=>{
      let d='';
      resp.on('data',c=>d+=c);
      resp.on('end',()=>res({status:resp.statusCode,body:d}));
    });
    r.on('error',rej);
    r.setTimeout(12000,()=>{r.destroy();rej(new Error('timeout'));});
    if(body) r.write(JSON.stringify(body));
    r.end();
  });
}

exports.handler = async ()=>{
  const H = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  try {
    // 1. Get results from football-data.org
    const fd = await req('GET',
      'https://api.football-data.org/v4/competitions/2000/matches?status=FINISHED',
      {'X-Auth-Token':FD_KEY});

    if(fd.status!==200) throw new Error(`FD API ${fd.status}: ${fd.body.slice(0,300)}`);

    const {matches=[]} = JSON.parse(fd.body);

    // 2. Get current Firebase actuals
    const fb = await req('GET',`${FB_URL}/actuals.json`);
    const existing = JSON.parse(fb.body)||{};

    // 3. Compute updates
    const updates={}, unmatched=[];
    for(const m of matches){
      const h = m.homeTeam?.name||'', a = m.awayTeam?.name||'';
      const mid = findMid(h,a);
      if(!mid){ unmatched.push(`${norm(h)} vs ${norm(a)}`); continue; }
      const hg=m.score?.fullTime?.home, ag=m.score?.fullTime?.away;
      if(hg==null||ag==null) continue;
      const ex=existing[mid];
      if(ex?.source==='manual') continue; // never overwrite manual
      if(!ex||ex.hg!==hg||ex.ag!==ag)
        updates[mid]={hg,ag,source:'football-data',ts:Date.now()};
    }

    // 4. Write each match individually
    const changed=Object.keys(updates).length;
    await Promise.all(Object.entries(updates).map(([mid,v])=>
      req('PUT',`${FB_URL}/actuals/${mid}.json`,{},v)
    ));

    return {statusCode:200,headers:H,
      body:JSON.stringify({ok:true,changed,total:matches.length,updates,unmatched})};

  } catch(e){
    return {statusCode:500,headers:H,body:JSON.stringify({error:e.message,stack:e.stack})};
  }
};
