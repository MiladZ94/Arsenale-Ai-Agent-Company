/* The 1.0 screens: Tasks (a board, a list, a new-task page and a task page),
 * Approvals (one letter at a time), Team (an office room with a profile and a
 * hire panel at its side), Finished work, Settings (Assistants, Phone alerts,
 * Safety rules, Office packs, Privacy), the first-start wizard, the Today
 * strip and the browser's desktop notifications.
 *
 * everyoneViews is never run in Node: like companyViews its source is
 * written into the page, so it uses only what the browser has. Every string
 * a person reads goes through T(); the page is English only.
 * dashboard-strings.cjs. The drawings come from everyoneArt (everyone-art.cjs).
 *
 * The screens read their data from the server's GET endpoints when they are
 * open, and write only through the server's POST endpoints, which check the
 * owner's key and write as the owner. Nothing here starts or stops an agent:
 * a task is a request the assistant reads the next time the owner talks to it.
 *
 * People are shown by name: a team member's name, else its job title, never
 * its file id (that is under Details). Time comes first; tokens and money only
 * under Details.
 *
 * Forms survive redraws: the main part of a screen is redrawn when its HTML
 * changes, the side panel (where the profile and hire forms are) only when it
 * opens or changes, and typed values are carried over even then.
 *
 * A file path is never opened: it is shown as text with "Copy path". Web
 * links open in a new browser tab.
 *
 * The code is in pages/everyone/ (style, views); this file keeps the require path.
 */
const { EVERYONE_STYLE } = require('./pages/everyone/style.cjs')
const { everyoneViews } = require('./pages/everyone/views.cjs')

module.exports = { EVERYONE_STYLE, everyoneViews }
