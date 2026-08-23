// Scheduled Netlify Function — runs once a day (see netlify.toml) and:
//   1. Emails anyone whose saved Zakat due date is 7 days away (first reminder).
//   2. Emails anyone whose saved Zakat due date is today (final reminder), then
//      rolls their due date forward ~354 days (one lunar year) and resets the
//      "sent" flags, so the same reminder fires again automatically next year.
//
// Requires these Netlify environment variables (Site settings -> Environment
// variables), all server-side secrets that must NOT be added to any HTML/JS:
//   SUPABASE_URL                - same project URL used in zakat-calculator.html
//   SUPABASE_SERVICE_ROLE_KEY   - Project Settings -> API -> service_role key
//   RESEND_API_KEY              - from resend.com, after verifying a sending domain
//   REMINDER_FROM_EMAIL         - e.g. "Zakat Reminders <reminders@paktaxcalculator.net>"

const LUNAR_YEAR_DAYS = 354;

exports.handler = async function () {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, REMINDER_FROM_EMAIL } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("send-zakat-reminders: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return respond(500, { error: "not_configured" });
  }
  if (!RESEND_API_KEY || !REMINDER_FROM_EMAIL) {
    console.error("send-zakat-reminders: missing RESEND_API_KEY or REMINDER_FROM_EMAIL");
    return respond(500, { error: "not_configured" });
  }

  const today = new Date();
  const todayISO = isoDate(today);
  const in7ISO = isoDate(addDays(today, 7));

  let sent7 = 0, sentDue = 0, errors = 0;

  try {
    const dueIn7 = await supabaseSelect(
      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
      `due_date=eq.${in7ISO}&reminder_7day_sent=eq.false`
    );
    for (const row of dueIn7) {
      try {
        await sendEmail(RESEND_API_KEY, REMINDER_FROM_EMAIL, row.email,
          "Your Zakat is due in 7 days",
          reminderEmailHtml(row, "in 7 days", row.due_date));
        await supabasePatch(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, row.id, {
          reminder_7day_sent: true,
          updated_at: new Date().toISOString(),
        });
        sent7++;
      } catch (e) {
        console.error("7-day reminder failed for", row.id, e);
        errors++;
      }
    }

    const dueToday = await supabaseSelect(
      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
      `due_date=eq.${todayISO}&reminder_dueday_sent=eq.false`
    );
    for (const row of dueToday) {
      try {
        await sendEmail(RESEND_API_KEY, REMINDER_FROM_EMAIL, row.email,
          "Your Zakat is due today",
          reminderEmailHtml(row, "today", row.due_date));
        const nextDue = isoDate(addDays(new Date(row.due_date + "T00:00:00Z"), LUNAR_YEAR_DAYS));
        await supabasePatch(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, row.id, {
          due_date: nextDue,
          reminder_7day_sent: false,
          reminder_dueday_sent: false,
          updated_at: new Date().toISOString(),
        });
        sentDue++;
      } catch (e) {
        console.error("due-day reminder failed for", row.id, e);
        errors++;
      }
    }
  } catch (e) {
    console.error("send-zakat-reminders: fatal error", e);
    return respond(500, { error: "server_error", detail: String(e).slice(0, 300) });
  }

  return respond(200, { sent7day: sent7, sentDueDay: sentDue, errors: errors });
};

function reminderEmailHtml(row, whenPhrase, dueDateStr) {
  const currency = row.reporting_currency ? ` (in ${row.reporting_currency})` : "";
  return (
    `<p>Assalamu Alaikum,</p>` +
    `<p>This is a reminder that your Zakat is due <strong>${whenPhrase}</strong> — on <strong>${dueDateStr}</strong>${row.due_date_hijri ? ` (${row.due_date_hijri})` : ""}.</p>` +
    `<p>Head back to the Zakat Calculator to recalculate your exact amount due${currency} with today's gold and silver rates:</p>` +
    `<p><a href="https://paktaxcalculator.net/zakat-calculator.html">paktaxcalculator.net/zakat-calculator.html</a></p>` +
    `<p style="color:#666;font-size:0.85em;">You're receiving this because you saved a Zakat reminder on Pakistan Tax Calculator. This is an automated estimate reminder, not a religious ruling — please verify amounts and consult a scholar for your specific situation.</p>`
  );
}

async function supabaseSelect(url, key, query) {
  const res = await fetch(`${url}/rest/v1/zakat_reminders?select=*&${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabasePatch(url, key, id, fields) {
  const res = await fetch(`${url}/rest/v1/zakat_reminders?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Supabase patch failed: ${res.status} ${await res.text()}`);
}

async function sendEmail(apiKey, from, to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function respond(statusCode, obj) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) };
}
