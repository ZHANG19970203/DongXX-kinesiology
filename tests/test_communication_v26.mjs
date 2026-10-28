import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FLOW} from '../clinic3d/case-flow.js';
import {FILM_SEQUENCE} from '../clinic3d/film-sequence-data.js';
import {REACTIONS,reactionFor,repairLabel,REPAIR_ACK} from '../clinic3d/communication-v26.js';
let checks=0;const check=(value)=>{assert.ok(value);checks++;};
for(const [id] of Object.entries(REACTIONS)){
 const found=Object.values(FLOW).some(n=>n.options.some(o=>o.id===id&&(o.retry||o.good===false)));check(found);
 const first=reactionFor(id,1),repeat=reactionFor(id,2);check(first.emotion==='questioning');check(repeat.text!==first.text);check(first.text.includes('林治疗师'));check(!/你(?!们)/u.test(first.text));
}
check(reactionFor('command_only',2).emotion==='upset');
check(reactionFor('heel_lift',2).emotion==='concerned');
check(reactionFor('respect_decline',1)===null);check(reactionFor('complete_missing',1)===null);
for(const n of Object.values(FLOW)){check(!/你(?!们)/u.test(n.text));for(const o of n.options){check(!/你(?!们)/u.test(o.shortLabel||o.label));if(o.good&&!o.retry)check(repairLabel(o).startsWith('抱歉'));}}
for(const c of FILM_SEQUENCE.clips)for(const lines of [c.normal,...c.alternative.map(a=>a.lines)])for(const t of lines)check(!/你(?!们)/u.test(t.text));
const app=fs.readFileSync(new URL('../clinic3d/app.js',import.meta.url),'utf8');
check(app.includes("if(offerRepair())return"));check(app.includes("state.communicationRepairs?.[activeNode?.id]?.pending)return"));
check(REPAIR_ACK.includes('不舒服'));console.log(JSON.stringify({passed:checks,authoredReactions:Object.keys(REACTIONS).length}));
