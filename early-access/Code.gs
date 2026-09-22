/**
 * The Papervoice early-access list.
 *
 * A Google Apps Script web app that takes one email address from the form on
 * papervoice.app and appends a row to the Sheet this script is bound to.
 *
 * It is deliberately the whole backend. There is no account system, no vendor,
 * and nothing to pay for: the list is a spreadsheet, and the only thing kept
 * is what someone typed in to be invited.
 *
 * See README.md beside this file for how to deploy it and what to paste into
 * EARLY_ACCESS_ENDPOINT.
 */

/** The tab written to. Created on first use if it is not there. */
var SHEET_NAME = 'signups';

/** Quietly accept an address already on the list rather than adding it twice. */
var SKIP_DUPLICATES = true;

var HEADERS = ['timestamp', 'email', 'utm_source', 'utm_medium', 'utm_campaign',
               'utm_content', 'referrer', 'received_at'];

/**
 * Loose on purpose, and the same rule the page applies.
 *
 * Anything stricter rejects real addresses -- plus signs, long new top-level
 * domains, apostrophes -- and the address is proven by an invite arriving,
 * not by a regular expression.
 */
function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 254;
}

function reply(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** So opening the deployed URL in a browser says something useful. */
function doGet() {
  return reply({ ok: true, service: 'papervoice-early-access' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return reply({ ok: false, error: 'Empty request.' });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return reply({ ok: false, error: 'Could not read that request.' });
    }

    // The hidden field on the form. A person never sees it, so anything in it
    // came from a bot. Answer as though it worked -- telling a bot why it
    // failed only teaches it to try again.
    if (String(body.trap || '').length > 0) {
      return reply({ ok: true });
    }

    var email = String(body.email || '').trim();
    if (!email) return reply({ ok: false, error: 'Please enter an email address.' });
    if (!looksLikeEmail(email)) {
      return reply({ ok: false, error: 'That does not look like an email address.' });
    }

    // One writer at a time. Two submissions landing together could otherwise
    // both read "not a duplicate" and both append.
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);
    } catch (err) {
      return reply({ ok: false, error: 'Busy just now — please try again.' });
    }

    try {
      var sheet = getSheet();

      if (SKIP_DUPLICATES && alreadyListed(sheet, email)) {
        // Already in. From the person's side this is a success, and it is:
        // they are on the list, which is all they asked for.
        return reply({ ok: true, duplicate: true });
      }

      sheet.appendRow([
        String(body.timestamp || ''),
        email,
        String(body.utm_source || ''),
        String(body.utm_medium || ''),
        String(body.utm_campaign || ''),
        String(body.utm_content || ''),
        String(body.referrer || ''),
        new Date().toISOString()
      ]);

      return reply({ ok: true });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // Whatever went wrong here is not the visitor's business, and the page
    // shows its own message. Log it so it can be found.
    console.error(err);
    return reply({ ok: false, error: 'Could not save that. Please try again.' });
  }
}

function getSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function alreadyListed(sheet, email) {
  var rows = sheet.getLastRow();
  if (rows < 2) return false;

  // Column B is the address; one read of the column rather than one per row.
  var column = sheet.getRange(2, 2, rows - 1, 1).getValues();
  var wanted = email.toLowerCase();
  for (var i = 0; i < column.length; i++) {
    if (String(column[i][0]).trim().toLowerCase() === wanted) return true;
  }
  return false;
}
