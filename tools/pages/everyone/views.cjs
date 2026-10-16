const path = require('path')
const { clientFunction } = require('../source.cjs')

// The body is in views/part*.js, joined by clientFunction (pages/source.cjs).
const everyoneViews = clientFunction(path.join(__dirname, 'views'), 'everyoneViews(h)', ['part1.js', 'part2.js', 'part3.js'])

module.exports = { everyoneViews }
