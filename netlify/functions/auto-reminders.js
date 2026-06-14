// Netlify Scheduled Function: sends automatic WC 2026 prediction reminders
// Runs every 15 minutes and sends once per deadline/player about 3 hours before kickoff.

const FIREBASE_URL = process.env.FIREBASE_URL || 'https://wc-predictions-36203-default-rtdb.firebaseio.com';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'wcsp6fzLmJ7aMeIJQ';
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_szyc7ed';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_m8gupbn';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://mizoprediction.netlify.app';

const BUILTIN_USERS = [
  { name: 'Khairo', color: '#e85d04' },
  { name: 'Moataz', color: '#3b82f6' },
  { name: 'Steve', color: '#22c55e' },
];

const DEADLINE_GROUPS = [
  {
    "key": "2026-06-11",
    "label": "2026-06-11",
    "deadline": "2026-06-11T20:00:00Z",
    "mids": [
      "M001",
      "M002"
    ]
  },
  {
    "key": "2026-06-12",
    "label": "2026-06-12",
    "deadline": "2026-06-12T20:00:00Z",
    "mids": [
      "M003",
      "M004"
    ]
  },
  {
    "key": "2026-06-13",
    "label": "2026-06-13",
    "deadline": "2026-06-13T17:00:00Z",
    "mids": [
      "M005",
      "M006",
      "M007",
      "M008"
    ]
  },
  {
    "key": "2026-06-14",
    "label": "2026-06-14",
    "deadline": "2026-06-14T17:00:00Z",
    "mids": [
      "M009",
      "M010",
      "M011",
      "M012"
    ]
  },
  {
    "key": "2026-06-15",
    "label": "2026-06-15",
    "deadline": "2026-06-15T17:00:00Z",
    "mids": [
      "M013",
      "M014",
      "M015",
      "M016"
    ]
  },
  {
    "key": "2026-06-16",
    "label": "2026-06-16",
    "deadline": "2026-06-16T17:00:00Z",
    "mids": [
      "M017",
      "M018",
      "M019",
      "M020"
    ]
  },
  {
    "key": "2026-06-17",
    "label": "2026-06-17",
    "deadline": "2026-06-17T17:00:00Z",
    "mids": [
      "M021",
      "M022",
      "M023",
      "M024"
    ]
  },
  {
    "key": "2026-06-18",
    "label": "2026-06-18",
    "deadline": "2026-06-18T17:00:00Z",
    "mids": [
      "M025",
      "M026",
      "M027",
      "M028"
    ]
  },
  {
    "key": "2026-06-19",
    "label": "2026-06-19",
    "deadline": "2026-06-19T17:00:00Z",
    "mids": [
      "M029",
      "M030",
      "M031",
      "M032"
    ]
  },
  {
    "key": "2026-06-20",
    "label": "2026-06-20",
    "deadline": "2026-06-20T17:00:00Z",
    "mids": [
      "M033",
      "M034",
      "M035",
      "M036"
    ]
  },
  {
    "key": "2026-06-21",
    "label": "2026-06-21",
    "deadline": "2026-06-21T17:00:00Z",
    "mids": [
      "M037",
      "M038",
      "M039",
      "M040"
    ]
  },
  {
    "key": "2026-06-22",
    "label": "2026-06-22",
    "deadline": "2026-06-22T17:00:00Z",
    "mids": [
      "M041",
      "M042",
      "M043",
      "M044"
    ]
  },
  {
    "key": "2026-06-23",
    "label": "2026-06-23",
    "deadline": "2026-06-23T17:00:00Z",
    "mids": [
      "M045",
      "M046",
      "M047",
      "M048"
    ]
  },
  {
    "key": "2026-06-24",
    "label": "2026-06-24",
    "deadline": "2026-06-24T17:00:00Z",
    "mids": [
      "M049",
      "M050",
      "M051",
      "M052",
      "M053",
      "M054"
    ]
  },
  {
    "key": "2026-06-25",
    "label": "2026-06-25",
    "deadline": "2026-06-25T17:00:00Z",
    "mids": [
      "M055",
      "M056",
      "M057",
      "M058",
      "M059",
      "M060"
    ]
  },
  {
    "key": "2026-06-26",
    "label": "2026-06-26",
    "deadline": "2026-06-26T17:00:00Z",
    "mids": [
      "M061",
      "M062",
      "M063",
      "M064",
      "M065",
      "M066"
    ]
  },
  {
    "key": "2026-06-27",
    "label": "2026-06-27",
    "deadline": "2026-06-27T17:00:00Z",
    "mids": [
      "M067",
      "M068",
      "M069",
      "M070",
      "M071",
      "M072"
    ]
  },
  {
    "key": "2026-06-28",
    "label": "2026-06-28",
    "deadline": "2026-06-28T20:00:00Z",
    "mids": [
      "M073"
    ]
  },
  {
    "key": "2026-06-29",
    "label": "2026-06-29",
    "deadline": "2026-06-29T17:00:00Z",
    "mids": [
      "M074",
      "M075",
      "M076"
    ]
  },
  {
    "key": "2026-06-30",
    "label": "2026-06-30",
    "deadline": "2026-06-30T17:00:00Z",
    "mids": [
      "M077",
      "M078",
      "M079"
    ]
  },
  {
    "key": "2026-07-01",
    "label": "2026-07-01",
    "deadline": "2026-07-01T17:00:00Z",
    "mids": [
      "M080",
      "M081",
      "M082"
    ]
  },
  {
    "key": "2026-07-02",
    "label": "2026-07-02",
    "deadline": "2026-07-02T17:00:00Z",
    "mids": [
      "M083",
      "M084",
      "M085"
    ]
  },
  {
    "key": "2026-07-03",
    "label": "2026-07-03",
    "deadline": "2026-07-03T17:00:00Z",
    "mids": [
      "M086",
      "M087",
      "M088"
    ]
  },
  {
    "key": "2026-07-04",
    "label": "2026-07-04",
    "deadline": "2026-07-04T20:00:00Z",
    "mids": [
      "M089",
      "M090"
    ]
  },
  {
    "key": "2026-07-05",
    "label": "2026-07-05",
    "deadline": "2026-07-05T17:00:00Z",
    "mids": [
      "M091",
      "M092"
    ]
  },
  {
    "key": "2026-07-06",
    "label": "2026-07-06",
    "deadline": "2026-07-06T17:00:00Z",
    "mids": [
      "M093",
      "M094"
    ]
  },
  {
    "key": "2026-07-07",
    "label": "2026-07-07",
    "deadline": "2026-07-07T17:00:00Z",
    "mids": [
      "M095",
      "M096"
    ]
  },
  {
    "key": "2026-07-09",
    "label": "2026-07-09",
    "deadline": "2026-07-09T20:00:00Z",
    "mids": [
      "M097"
    ]
  },
  {
    "key": "2026-07-10",
    "label": "2026-07-10",
    "deadline": "2026-07-10T20:00:00Z",
    "mids": [
      "M098"
    ]
  },
  {
    "key": "2026-07-11",
    "label": "2026-07-11",
    "deadline": "2026-07-11T17:00:00Z",
    "mids": [
      "M099",
      "M100"
    ]
  },
  {
    "key": "2026-07-14",
    "label": "2026-07-14",
    "deadline": "2026-07-14T20:00:00Z",
    "mids": [
      "M101"
    ]
  },
  {
    "key": "2026-07-15",
    "label": "2026-07-15",
    "deadline": "2026-07-15T20:00:00Z",
    "mids": [
      "M102"
    ]
  },
  {
    "key": "2026-07-18",
    "label": "2026-07-18",
    "deadline": "2026-07-18T20:00:00Z",
    "mids": [
      "M103"
    ]
  },
  {
    "key": "2026-07-19",
    "label": "2026-07-19",
    "deadline": "2026-07-19T20:00:00Z",
    "mids": [
      "M104"
    ]
  }
];

exports.config = {
  schedule: '*/15 * * * *'
};

function fbKey(s) {
  return String(s || '').trim().replace(/[.#$\[\]\/]/g, '_');
}

function fbPath(path) {
  const clean = String(path || '').replace(/^\/+|\/+$/g, '');
  const base = FIREBASE_URL.replace(/\/+$/, '');
  return clean ? `${base}/${clean}.json` : `${base}/.json`;
}

async function fbGet(path) {
  const r = await fetch(fbPath(path), { cache: 'no-store' });
  if (!r.ok) throw new Error(`Firebase GET failed for ${path}: ${r.status}`);
  return await r.json();
}

async function fbSet(path, value) {
  const r = await fetch(fbPath(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!r.ok) throw new Error(`Firebase PUT failed for ${path}: ${r.status}`);
  return await r.json();
}

function parseFirebaseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return Object.values(value).filter(Boolean);
}

function getAllUsers(snapshot) {
  const custom = parseFirebaseList(snapshot.custom_users);
  const map = new Map();
  [...BUILTIN_USERS, ...custom].forEach(u => {
    if (!u || !u.name) return;
    map.set(String(u.name).trim(), { name: String(u.name).trim(), color: u.color || '#666' });
  });
  return [...map.values()];
}

function getEmail(snapshot, name) {
  const emails = snapshot.player_emails || {};
  const key = fbKey(name);
  return String(emails[key] || emails[name] || '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function missingMidsForUser(snapshot, name, group) {
  const key = fbKey(name);
  const preds = (snapshot.predictions && snapshot.predictions[key]) || snapshot.predictions?.[name] || {};
  return group.mids.filter(mid => {
    const p = preds[mid];
    return !p || p.hg === undefined || p.hg === null || p.hg === '' || p.ag === undefined || p.ag === null || p.ag === '';
  });
}

function deadlineText(deadlineIso) {
  return new Date(deadlineIso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
  });
}

function buildEmailMessage(name, missingCount, deadlineIso) {
  return `Hey ${name},

You have ${missingCount} missing prediction${missingCount !== 1 ? 's' : ''} for WC 2026.

Deadline: ${deadlineText(deadlineIso)}

Please log in and complete them before the deadline:
${WEBSITE_URL}`;
}

async function sendEmail({ email, name, missingCount, deadlineIso }) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: email,
        player_email: email,
        player_name: name,
        missing_count: missingCount,
        deadline: deadlineText(deadlineIso),
        subject: `WC 2026 Predictions Reminder - ${missingCount} missing`,
        message: buildEmailMessage(name, missingCount, deadlineIso),
        website_url: WEBSITE_URL
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS failed: ${response.status} ${text}`);
  }
}

function groupsAboutThreeHoursAway(now = new Date()) {
  const nowMs = now.getTime();
  const minMs = 2.75 * 60 * 60 * 1000; // 2h45m
  const maxMs = 3.25 * 60 * 60 * 1000; // 3h15m
  return DEADLINE_GROUPS.filter(g => {
    const diff = new Date(g.deadline).getTime() - nowMs;
    return diff >= minMs && diff <= maxMs;
  });
}

exports.handler = async function(event, context) {
  const now = new Date();
  const dueGroups = groupsAboutThreeHoursAway(now);

  if (!dueGroups.length) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'No deadlines in the 3-hour reminder window.' }) };
  }

  const snapshot = await fbGet('');
  const users = getAllUsers(snapshot || {});
  const results = [];

  for (const group of dueGroups) {
    const deadlineKey = group.deadline.replace(/[^0-9A-Za-z]/g, '_');

    for (const user of users) {
      const name = user.name;
      const playerKey = fbKey(name);
      const alreadySent = snapshot?.auto_reminder_log?.[deadlineKey]?.[playerKey];
      if (alreadySent) {
        results.push({ deadline: group.deadline, player: name, status: 'skipped_already_sent' });
        continue;
      }

      const email = getEmail(snapshot || {}, name);
      if (!isValidEmail(email)) {
        results.push({ deadline: group.deadline, player: name, status: 'skipped_no_email' });
        continue;
      }

      const missing = missingMidsForUser(snapshot || {}, name, group);
      if (!missing.length) {
        results.push({ deadline: group.deadline, player: name, status: 'skipped_complete' });
        continue;
      }

      try {
        await sendEmail({ email, name, missingCount: missing.length, deadlineIso: group.deadline });
        await fbSet(`auto_reminder_log/${deadlineKey}/${playerKey}`, {
          sentAt: now.toISOString(),
          email,
          missingCount: missing.length,
          mids: missing
        });
        results.push({ deadline: group.deadline, player: name, status: 'sent', missingCount: missing.length });
      } catch (err) {
        console.error(err);
        results.push({ deadline: group.deadline, player: name, status: 'error', error: err.message });
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, checkedAt: now.toISOString(), results })
  };
};
