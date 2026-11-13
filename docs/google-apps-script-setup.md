# Connecting Google Sheets via Apps Script (no Google Cloud Console)

Alternative to the service-account Sheets API for the Supabase/production
sync path (`lib/connectors/google-sheets/sync.ts`). No Google Cloud project,
no service account, no `googleapis` package — the script runs inside the
spreadsheet itself and only hands data back to callers who know the secret.
The sheet is never shared publicly (unlike the CSV-export path used for
local/demo syncing).

## 1. Paste the script into the sheet

1. Open the Google Sheet → **Extensions → Apps Script**.
2. Delete the placeholder code and paste this in:

```javascript
// Keep this secret private — anyone with it can read the sheet's data.
// Generate a random one, e.g. by running: openssl rand -hex 24
var SECRET = "PASTE_A_LONG_RANDOM_SECRET_HERE";

// Only these 4 tabs can ever be read through this endpoint, even if the
// secret leaks — keep this in sync with config/data-sources.ts.
var ALLOWED_TABS = [
  "Dash - Position Tracker",
  "Dash - Daily Candidate Feedback",
  "Dash - Overall Upcoming joiner",
  "Dash - Drop Outs",
];

function doGet(e) {
  if (!e || e.parameter.key !== SECRET) {
    return jsonOutput({ error: "Unauthorized" });
  }

  var tabName = e.parameter.tab;
  if (!tabName) {
    return jsonOutput({ error: 'Missing "tab" parameter' });
  }
  if (ALLOWED_TABS.indexOf(tabName) === -1) {
    return jsonOutput({ error: "Tab not allowed: " + tabName });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) {
    return jsonOutput({ error: "No such tab: " + tabName });
  }

  var values = sheet.getDataRange().getDisplayValues();
  if (values.length === 0) {
    return jsonOutput({ headers: [], rows: [] });
  }

  var headers = values[0];
  var rows = values.slice(1);
  return jsonOutput({ headers: headers, rows: rows });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
```

3. Replace `PASTE_A_LONG_RANDOM_SECRET_HERE` with a long random string (e.g.
   run `openssl rand -hex 24` in a terminal and paste the output). Keep this
   value — you'll need it in `.env.local` / Vercel too.
4. Save the project (any name, e.g. "TA Dashboard Sync API").

## 2. Deploy it as a Web App

1. **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Settings:
   - **Execute as**: Me (your account)
   - **Who has access**: Anyone
   - (Not "Anyone with a Google account" — the script's own secret check is
     the actual gate; requiring Google sign-in on top of it isn't needed and
     complicates server-to-server calls.)
4. Click **Deploy**, authorize it when prompted (it needs permission to read
   the spreadsheet it's bound to).
5. Copy the **Web app URL** it gives you — looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

## 3. Configure the app

Add to `.env.local` (and the same two vars in Vercel → Settings →
Environment Variables):

```
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
GOOGLE_APPS_SCRIPT_SECRET=the-same-random-secret-from-step-1
```

Once `GOOGLE_APPS_SCRIPT_URL` is set, the Supabase-mode sync
(`npm run sync` / the Admin panel's "Sync now") automatically uses this
instead of the service-account Sheets API — no other config needed, and
`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` can be
left unset entirely.

## 4. Re-deploying after editing the script

Apps Script Web App URLs are pinned to a specific deployment. If you edit
the script later (e.g. to fix a bug), you must **Deploy → Manage
deployments → edit (pencil icon) → New version** — just saving the script
doesn't update the live URL.

## Security notes

- The secret travels as a URL query parameter (`?key=...`). Apps Script Web
  Apps only serve HTTPS, so it's encrypted in transit, but it will show up
  in Google's own request logs for the script and in server logs on our
  side — treat it like a password, and rotate it (edit `SECRET` in the
  script + redeploy, update the env var) if you suspect it leaked.
- The `ALLOWED_TABS` list means the endpoint can only ever return those 4
  tabs, even if the secret leaks — the rest of the spreadsheet (including
  any other tabs with unrelated data) stays unreachable through this URL.
  If you add a 5th synced tab later (a new entry in
  `config/data-sources.ts`), add its exact tab name here too.

## The HR exits sheet (Exit Employees tab) needs its own script

Apps Script is bound to ONE spreadsheet, so the exits sheet (a different file
from the TA tracker) gets its own copy of the script and its own secret.

1. Open the **exits spreadsheet** → **Extensions → Apps Script**.
2. Paste the same script as in step 1 above, but set the allow-list to just
   that tab and use a NEW secret (do not reuse the tracker's):

   ```javascript
   var SECRET = "PASTE_A_DIFFERENT_LONG_RANDOM_SECRET_HERE";
   var ALLOWED_TABS = ["Exit Employees"];
   ```

3. Deploy it as a Web app exactly like step 2 (Execute as: Me, Access: Anyone)
   and copy the Web app URL.
4. Add to `.env.local` and to Vercel → Settings → Environment Variables:

   ```
   EXIT_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   EXIT_APPS_SCRIPT_SECRET=the-secret-from-step-2
   ```

5. Click **Sync now**. While these two variables are missing, the app falls
   back to reading that tab through the sheet's public "Anyone with the link"
   share link. Once the script works, you can switch the sheet's sharing back
   to **Restricted** — it contains names and reasons for leaving.

## The finance sheet (Real OG tab, Financials page) needs its own script

The Financials page reads the **Real OG** tab of the finance spreadsheet live
(it is not copied into the database). It contains payroll, so once it works you
should not leave the sheet open to "Anyone with the link". Same recipe as the
exits sheet, with its own script and its own secret:

1. Open the **finance spreadsheet** → **Extensions → Apps Script**.
2. Paste the same script as in step 1 above, with:

   ```javascript
   var SECRET = "PASTE_A_THIRD_LONG_RANDOM_SECRET_HERE";
   var ALLOWED_TABS = ["Real OG"];
   ```

3. Deploy it as a Web app (Execute as: Me, Access: Anyone) and copy the URL.
4. Add to `.env.local` and to Vercel → Settings → Environment Variables:

   ```
   FINANCE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   FINANCE_APPS_SCRIPT_SECRET=the-secret-from-step-2
   ```

5. Redeploy on Vercel, then switch the sheet's sharing to **Restricted**.

Until both variables are set, the page falls back to the sheet's public share
link. The Financials tab is hidden from non-admin roles until an admin ticks it
in the Admin panel's tab matrix. Rows are found by their label, so adding a
month column or a new department row in the sheet needs no code change.
