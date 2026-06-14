// Netlify Scheduled Function — sends email reminders before match deadlines
// GW1: fires before each day's first match (daily reminders)
// GW2+: fires once before the stage deadline
// Schedule: runs every 30 minutes to check if a reminder is due

const https = require('https');

const FB_URL   = "https://wc-predictions-36203-default-rtdb.firebaseio.com";
const EMAILJS_SERVICE_ID  = "service_szyc7ed";
const EMAILJS_TEMPLATE_ID = "template_m8gupbn";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY; // set in Netlify env vars

// GW1 matches grouped by date with first kickoff per day (UTC)
const GW1_DAYS = [
  { date: '2026-06-11', label: 'Matchday 1 — Day 1', firstKickoff: '2026-06-11T20:00:00Z',
    mids: ['M001','M002'] },
  { date: '2026-06-12', label: 'Matchday 1 — Day 2', firstKickoff: '2026-06-12T20:00:00Z',
    mids: ['M003','M004'] },
  { date: '2026-06-13', label: 'Matchday 1 — Day 3', firstKickoff: '2026-06-13T17:00:00Z',
    mids: ['M005','M006','M007','M008'] },
  { date: '2026-06-14', label: 'Matchday 1 — Day 4', firstKickoff: '2026-06-14T17:00:00Z',
    mids: ['M009','M010','M011','M012'] },
  { date: '2026-06-15', label: 'Matchday 1 — Day 5', firstKickoff: '2026-06-15T17:00:00Z',
    mids: ['M013','M014','M015','M016'] },
  { date: '2026-06-16', label: 'Matchday 1 — Day 6', firstKickoff: '2026-06-16T17:00:00Z',
    mids: ['M017','M018','M019','M020'] },
  { date: '2026-06-17', label: 'Matchday 1 — Day 7', firstKickoff: '2026-06-17T17:00:00Z',
    mids: ['M021','M022','M023','M024'] },
];

// GW2+ stage deadlines — remind 3 hours before
const STAGE_DEADLINES = [
  { key: 'MD2',   label: 'Matchday 2',    deadline: '2026-06-18T17:00:00Z', mids: Array.from({length:24},(_,i)=>`M${String(i+25).padStart(3,'0')}`) },
  { key: 'MD3',   label: 'Matchday 3',    deadline: '2026-06-24T17:00:00Z', mids: Array.from({length:24},(_,i)=>`M${String(i+49).padStart(3,'0')}`) },
  { key: 'R32',   label: 'Round of 32',   deadline: '2026-06-28T20:00:00Z', mids: Array.from({length:16},(_,i)=>`M${String(i+73).padStart(3,'0')}`) },
  { key: 'R16',   label: 'Round of 16',   deadline: '2026-07-04T20:00:00Z', mids: Array.from({length:8}, (_,i)=>`M${String(i+89).padStart(3,'0')}`) },
  { key: 'QF',    label: 'Quarterfinals', deadline: '2026-07-09T20:00:00Z', mids: Array.from({length:4}, (_,i)=>`M${String(i+97).padStart(3,'0')}`) },
  { key: 'SF',    label: 'Semifinals',    deadline: '2026-07-14T20:00:00Z', mids: ['M101','M102'] },
  { key: 'Final', label: 'Final & 3rd',   deadline: '2026-07-18T20:00:00Z', mids: ['M103','M104'] },
];

// Remind this many ms before deadline
const GW1_REMIND_BEFORE_MS  = 2 * 60 * 60 * 1000;  // 2 hours before first match of day
const GW2_REMIND_BEFORE_MS  = 3 * 60 * 60 * 1000;  // 3 hours before stage deadline
const WINDOW_MS = 30 * 60 * 1000; // function runs every 30 min — fire if in this window

function fbGet(path) {
  return new Promise((resolve, reject) => {
    const url = path ? `${FB_URL}/${path}.json` : `${FB_URL}/.json`;
    https.get(url, { headers: { 'User-Agent': 'wc2026-reminders' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d || 'null')));
    }).on('error', reject);
  });
}

function fbSet(path, value) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(value);
    const u = new URL(`${FB_URL}/${path}.json`);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d||'null'))); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Send email via EmailJS REST API (server-side)
function sendEmail(toEmail, toName, subject, message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: 'wcsp6fzLmJ7aMeIJQ',
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: toEmail,
        player_email: toEmail,
        player_name: toName,
        subject,
        message,
        website_url: 'https://mizoprediction.netlify.app'
      }
    });
    const req = https.request({
      hostname: 'api.emailjs.com',
      path: '/api/v1.0/email/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getMissingCount(userPreds, mids) {
  return mids.filter(mid => {
    const p = userPreds[mid];
    return !p || p.hg === undefined;
  }).length;
}

function buildMessage(name, missing, deadlineLabel, timeStr) {
  return `Hey ${name},\n\nYou have ${missing} missing prediction${missing !== 1 ? 's' : ''} for WC 2026.\n\n📅 Stage: ${deadlineLabel}\n⏰ Deadline: ${timeStr}\n\nLog in now and enter your predictions before it locks:\nhttps://mizoprediction.netlify.app\n\nGood luck! ⚽`;
}

exports.handler = async () => {
  const H = { 'Content-Type': 'application/json' };
  const now = Date.now();

  try {
    // Load all data from Firebase in one request
    const all = await fbGet('');
    const predictions = all?.predictions || {};
    const emails = all?.player_emails || {};
    const sentLog = all?.auto_reminder_sent || {};

    // ── Find which reminder is due right now ────────────────────────
    let dueReminder = null;

    // Check GW1 daily reminders
    for (const day of GW1_DAYS) {
      const kickoff = new Date(day.firstKickoff).getTime();
      const remindAt = kickoff - GW1_REMIND_BEFORE_MS;
      if (now >= remindAt && now < remindAt + WINDOW_MS) {
        // Check not already sent for this day
        if (!sentLog[`GW1_${day.date}`]) {
          dueReminder = { key: `GW1_${day.date}`, label: day.label, mids: day.mids,
            deadline: day.firstKickoff, timeStr: new Date(kickoff).toLocaleString('en-GB', {
              weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'UTC'
            }) + ' UTC' };
          break;
        }
      }
    }

    // Check GW2+ stage deadlines
    if (!dueReminder) {
      for (const stage of STAGE_DEADLINES) {
        const dl = new Date(stage.deadline).getTime();
        const remindAt = dl - GW2_REMIND_BEFORE_MS;
        if (now >= remindAt && now < remindAt + WINDOW_MS) {
          if (!sentLog[stage.key]) {
            dueReminder = { key: stage.key, label: stage.label, mids: stage.mids,
              deadline: stage.deadline, timeStr: new Date(dl).toLocaleString('en-GB', {
                weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'UTC'
              }) + ' UTC' };
            break;
          }
        }
      }
    }

    if (!dueReminder) {
      return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, action: 'no_reminder_due' }) };
    }

    // ── Send reminders to users with missing predictions ─────────────
    const sent = [], errors = [];

    for (const [fbUserKey, userPreds] of Object.entries(predictions)) {
      // Find email — try both fbKey and original name format
      const email = emails[fbUserKey] || Object.entries(emails).find(([k]) =>
        k.toLowerCase().replace(/[^a-z0-9]/g,'_') === fbUserKey.toLowerCase()
      )?.[1];

      if (!email) continue;

      const missing = getMissingCount(userPreds, dueReminder.mids);
      if (missing === 0) continue; // all done — no reminder needed

      const name = fbUserKey.replace(/_/g, ' ');
      const subject = `WC 2026 Reminder — ${missing} prediction${missing!==1?'s':''} missing`;
      const message = buildMessage(name, missing, dueReminder.label, dueReminder.timeStr);

      try {
        const result = await sendEmail(email, name, subject, message);
        if (result.status === 200) {
          sent.push(name);
        } else {
          errors.push(`${name}: EmailJS ${result.status} — ${result.body}`);
        }
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }

    // ── Mark this reminder as sent in Firebase ───────────────────────
    const newLog = Object.assign({}, sentLog, { [dueReminder.key]: new Date().toISOString() });
    await fbSet('auto_reminder_sent', newLog);

    // ── Save status for admin to see in the email modal ─────────────
    await fbSet('auto_reminder_status', {
      lastRun: new Date().toISOString(),
      stage: dueReminder.label,
      deadline: dueReminder.timeStr,
      sentCount: sent.length,
      sent,
      errorCount: errors.length,
      errors
    });

    return {
      statusCode: 200, headers: H,
      body: JSON.stringify({ ok: true, reminder: dueReminder.key, sent, errors })
    };

  } catch (e) {
    console.error('send-reminders error:', e.message);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: e.message }) };
  }
};
