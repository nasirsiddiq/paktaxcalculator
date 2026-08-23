// On-demand Netlify Function — lets a logged-in user permanently delete their own
// account. This has to run server-side because deleting a Supabase auth user requires
// the SERVICE ROLE key, which must never be exposed in the website's client-side code.
//
// Flow:
//   1. The browser sends the user's own current access token (from their active
//      Supabase session) in the request body.
//   2. This function asks Supabase "who does this token belong to?" — proving the
//      caller really is that user, not someone guessing at IDs.
//   3. Only then does it delete that exact user via Supabase's admin API.
//
// Deleting the auth user automatically deletes their zakat_reminders row too, thanks
// to the "on delete cascade" set up in supabase-zakat-reminders-setup.sql.
//
// Requires the same SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
// already set up for send-zakat-reminders.js.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("delete-account: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return respond(500, { error: "not_configured" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return respond(400, { error: "Invalid JSON body" });
  }

  const accessToken = payload.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    return respond(400, { error: "Missing access_token" });
  }

  try {
    // Step 1: resolve the access token to a real, currently-valid user.
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!whoRes.ok) {
      return respond(401, { error: "invalid_session", detail: "Could not verify your session — please log in again." });
    }
    const user = await whoRes.json();
    if (!user || !user.id) {
      return respond(401, { error: "invalid_session" });
    }

    // Step 2: delete that exact user via the admin API (service role only).
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!delRes.ok) {
      const errText = await delRes.text();
      return respond(502, { error: "delete_failed", detail: errText.slice(0, 300) });
    }

    return respond(200, { deleted: true });
  } catch (err) {
    console.error("delete-account: fatal error", err);
    return respond(500, { error: "server_error", detail: String(err).slice(0, 300) });
  }
};

function respond(statusCode, obj) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) };
}
