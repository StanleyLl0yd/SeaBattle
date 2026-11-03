'use strict';
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname,'..');
const html = readFileSync(join(root,'index.html'),'utf8');
const paths = ['js/config.js','js/career.js','js/stats.js','js/ui-state.js','js/engine.js','js/ai.js','js/daily.js','js/replay.js','js/tactics.js','js/backup.js','js/ui.js'];
const script = paths.map(path=>readFileSync(join(root,path),'utf8')).join('\n');
module.exports = {html,script,paths};
