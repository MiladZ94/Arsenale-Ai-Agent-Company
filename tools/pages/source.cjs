/* Client functions written into the pages as source.
 *
 * A page's browser code (officeClient, everyoneViews, office3d) is one function
 * of well over a thousand lines: the page builder writes its source into the
 * page with fn.toString(). To keep every file small the function's body is kept
 * as a few fragment files, each a run of whole statements. This puts the
 * fragments back together, in the order given, and compiles them with vm, so
 * toString() returns exactly the text of the fragments: the page is byte for
 * byte what a single function would give (tools/test/page-golden.test.cjs).
 *
 * The fragments only make sense together: names a fragment uses may be declared
 * in an earlier one. Like the rest of the page code they are never run in Node. */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

/** `signature` is e.g. 'officeClient()'; `parts` are the fragment file names
 *  in `dir`. Each file ends with one newline that is not part of the code. */
function clientFunction(dir, signature, parts) {
  const body = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r?\n$/, '')).join('\n')
  return vm.runInThisContext('(function ' + signature + ' {\n' + body + '\n})', { filename: path.join(dir, parts[0]) })
}

module.exports = { clientFunction }
