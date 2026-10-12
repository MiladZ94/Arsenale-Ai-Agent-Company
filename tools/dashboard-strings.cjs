/* UI strings for the agent dashboard: English only.
 *
 * The dashboard had a Persian interface; the owner took it out for now
 * (2026-10-12): there is no language switch, nothing reads ?lang= or the old
 * `dash-lang` cookie, and every page is English. The Persian table is in the
 * git history (tools/dashboard-strings.cjs before that date) for whoever
 * brings it back.
 *
 * The text still goes through T(key) / t(lang, key), which return the
 * English key itself, so a second language can come back here without
 * touching the hundreds of call sites. LANG is always 'en'.
 */

/** English is the only language: the key is the text. */
function t(lang, key) {
  return key
}

/** Every page is English, whatever the address or a cookie from an older
 *  dashboard says. */
function langFromRequest() {
  return { lang: 'en', explicit: false }
}

/** What the pages' browser code needs: LANG and T(key). */
function langScript() {
  return "const LANG = 'en';\nfunction T(key) { return key }\n"
}

module.exports = { t, langScript, langFromRequest }
