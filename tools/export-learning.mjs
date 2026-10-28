import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const entry=require.resolve('@oai/artifact-tool',{paths:[process.env.DXX_NODE_PACKAGES]});
const {Workbook,SpreadsheetFile}=await import(pathToFileURL(entry).href);
const input=JSON.parse(await fs.readFile(process.argv[2],'utf8')),workbook=Workbook.create();
const letter=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const clean=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;if(v==null)return '';const t=String(v).replace(/sk-[A-Za-z0-9_-]{12,}/g,'[凭据已隐藏]').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');return /^[=+@-]/.test(t)?"'"+t:t;};
for(const [i,t]of input.sheets.entries()){
 const sheet=workbook.worksheets.add(t.name),cols=t.headers.length,last=letter(cols-1),rows=t.rows.map(row=>Array.from({length:cols},(_,j)=>clean(row[j])));
 const titleLast=letter(Math.min(cols,6)-1);
 sheet.getRange(`A1:${titleLast}1`).merge();sheet.getRange('A1').values=[[t.title]];
 sheet.getRange(`A2:${titleLast}2`).merge();sheet.getRange('A2').values=[[t.note]];
 const matrix=[t.headers,...rows];sheet.getRange(`A4:${last}${matrix.length+3}`).values=matrix;
 sheet.getRange(`A1:${last}${Math.max(5,matrix.length+3)}`).format.font={name:'Microsoft YaHei',size:10,color:'#254D3B'};
 sheet.getRange(`A1:${last}1`).format={fill:'#286D4B',font:{name:'Microsoft YaHei',size:16,bold:true,color:'#FFFFFF'},rowHeight:34};
 sheet.getRange(`A2:${last}2`).format={wrapText:true,rowHeight:42,font:{size:10,color:'#617568'}};
 sheet.getRange(`A4:${last}4`).format={fill:'#DEEDDF',font:{bold:true,color:'#204C33'},rowHeight:30,wrapText:true};
 sheet.getRange(`A5:${last}${Math.max(5,matrix.length+3)}`).format={rowHeight:30,wrapText:true,verticalAlignment:'top'};
 sheet.getRange(`A:${last}`).format.columnWidth=20;
 for(const col of t.wideColumns||[])sheet.getRange(`${col}:${col}`).format.columnWidth=52;
 for(const col of t.textColumns||[])sheet.getRange(`${col}5:${col}${Math.max(5,matrix.length+3)}`).setNumberFormat('@');
 if(t.name==='学习证书')sheet.getRange('D:D').format.columnWidth=32;
 if(t.name==='学生汇总'&&rows.length)sheet.getRange(`J5:J${rows.length+4}`).setNumberFormat('0.0%');
 for(let r=0;r<rows.length;r++){const lines=Math.max(...rows[r].map((v,j)=>{const width=(t.wideColumns||[]).includes(letter(j))?27:10;return String(v??'').split('\n').reduce((n,s)=>n+Math.ceil(s.length/width),0);}));sheet.getRange(`A${r+5}:${last}${r+5}`).format.rowHeight=Math.min(300,Math.max(30,lines*15));}
 if(rows.length)sheet.tables.add(`A4:${last}${matrix.length+3}`,true,'LearningTable'+i);
 sheet.freezePanes.freezeRows(4);
}
await workbook.recalculate();
const scan=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?',options:{useRegex:true,maxResults:20},maxChars:1000});
const result=await SpreadsheetFile.exportXlsx(workbook);await result.save(process.argv[3]);
if(process.argv[4]){await fs.mkdir(process.argv[4],{recursive:true});for(let i=0;i<input.sheets.length;i++){const image=await workbook.render({sheetName:input.sheets[i].name,range:(input.sheets[i].name==='肌肉彩绘'?'G4:N7':input.sheets[i].name==='学习证书'?'A1:J6':'A1:F7'),scale:1.4});await fs.writeFile(process.argv[4]+'/'+i+'.png',new Uint8Array(await image.arrayBuffer()));}}
console.log(JSON.stringify({sheets:input.sheets.map(x=>({name:x.name,rows:x.rows.length})),output:process.argv[3]}));
