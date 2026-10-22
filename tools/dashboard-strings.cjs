/* UI strings for the agent dashboard: English only.
 *
 * There is no language switch, nothing reads ?lang= or a language cookie, and
 * every page is English. The text still goes through T(key) / t(lang, key),
 * which return the key itself. LANG is always 'en'.
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
