/* A test reporter for GitHub Actions (run.cjs adds it there only): each failed
 * test becomes an error annotation on its file and line, so a failure can be
 * read on the pull request, and from the check run, without opening the log.
 * GitHub keeps the first ten of a step. */
const path = require('path')

const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
// a property value also ends at a comma or a colon
const prop = (s) => esc(s).replace(/,/g, '%2C').replace(/:/g, '%3A')

module.exports = async function* annotate(source) {
  for await (const e of source) {
    if (e.type !== 'test:fail') continue
    const d = e.data
    const err = d.details && d.details.error
    // a parent whose subtest failed: the subtest has its own annotation
    if (err && err.failureType === 'subtestsFailed') continue
    const cause = err && err.cause ? err.cause : err
    const text = (err && err.failureType ? err.failureType + ': ' : '') + String((cause && (cause.message || cause)) || 'failed')
    const file = d.file ? path.relative(process.cwd(), d.file).split(path.sep).join('/') : ''
    yield '::error file=' + prop(file) + ',line=' + (d.line || 1) + ',title=' + prop(String(d.name).slice(0, 120)) + '::' + esc(text.slice(0, 1500)) + '\n'
  }
}
