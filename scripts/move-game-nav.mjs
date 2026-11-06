import {readFileSync,writeFileSync} from 'node:fs';
const path='src/app.js';let source=readFileSync(path,'utf8');
const entry='${safeHttps(integration.gameUrl)?`<a class="nav-game" href="${esc(integration.gameUrl)}" target="_blank" rel="noopener noreferrer">🎮 正式版領地戰 ↗</a>`:\'\'}';
source=source.replace('<a class="teacher" href="#/teacher">',entry+'<a class="teacher" href="#/teacher">');
source=source.replace(/\$\{safeHttps\(integration\.gameUrl\)\?`<p class="hero-game">[\s\S]*?<\/p>`:''\}/,'');
writeFileSync(path,source);
