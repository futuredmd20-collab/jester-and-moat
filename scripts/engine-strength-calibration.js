#!/usr/bin/env node
/* Purpose: repeatable MinMax/MCTS head-to-head measurements using the game's rules and engine contracts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),MARKER="\nif (document.readyState === 'loading')";
const IDS=['minmax-1','minmax-2','minmax-3','mcts-1','mcts-2','mcts-3'];
const BUDGETS={minmax:{1:3000,2:6000,3:10000},mcts:{1:2500,2:5000,3:10000}};
function seededRandom(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function wilson(p,n,z=1.96){if(!n)return[0,1];const d=1+z*z/n,c=(p+z*z/(2*n))/d,m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return[Math.max(0,c-m),Math.min(1,c+m)];}
function elo(score){const p=Math.min(.999,Math.max(.001,score));return 400*Math.log10(p/(1-p));}
function parseArgs(args){
 const o={seed:20261106,gamesPerPair:2,maxPlies:120,budgetScale:1,pair:null,selfTest:false,json:false};
 for(let i=0;i<args.length;i++){const a=args[i],v=n=>{const x=a.startsWith(n+'=')?a.slice(n.length+1):args[++i];if(x===undefined)throw Error('Missing value for '+n);return x;};
  if(a==='--help'||a==='-h')o.help=true;else if(a==='--self-test')o.selfTest=true;else if(a==='--json')o.json=true;
  else if(a==='--seed'||a.startsWith('--seed='))o.seed=Number(v('--seed'));
  else if(a==='--games-per-pair'||a.startsWith('--games-per-pair='))o.gamesPerPair=Number(v('--games-per-pair'));
  else if(a==='--max-plies'||a.startsWith('--max-plies='))o.maxPlies=Number(v('--max-plies'));
  else if(a==='--budget-scale'||a.startsWith('--budget-scale='))o.budgetScale=Number(v('--budget-scale'));
  else if(a==='--pair'||a.startsWith('--pair='))o.pair=v('--pair').replace(':',',').split(',').map(x=>x.trim());
  else throw Error('Unknown option: '+a);
 }
 if(!Number.isSafeInteger(o.seed)||o.seed<0)throw Error('--seed must be non-negative.');
 if(!Number.isInteger(o.gamesPerPair)||o.gamesPerPair<2||o.gamesPerPair%2)throw Error('--games-per-pair must be even and >= 2.');
 if(!Number.isInteger(o.maxPlies)||o.maxPlies<2)throw Error('--max-plies must be >= 2.');
 if(!Number.isFinite(o.budgetScale)||o.budgetScale<=0)throw Error('--budget-scale must be positive.');
 if(o.pair&&(o.pair.length!==2||o.pair[0]===o.pair[1]||o.pair.some(x=>!IDS.includes(x))))throw Error('--pair must name two different profiles: '+IDS.join(', '));
 return o;
}
function helpText(){return ['node scripts/engine-strength-calibration.js [options]','','--pair ID,ID         One matchup; default all 15 pairs.','--games-per-pair N   Even games per pair, alternating colours; default 2.','--max-plies N        Unfinished games score as draws; default 120.','--seed N             Base PRNG seed; default 20261106.','--budget-scale N     Scale actual search budgets; default 1.','--json               Print full JSON results.','--self-test          Run a short engine/rules smoke test.','--help               Show help.','','Reduced budgets are smoke tests, not comparable calibration data.'].join('\n');}
function mockElement(id){return{id,value:id==='modeSelect'?'ai_vs_ai':'',checked:false,hidden:false,disabled:false,title:'',textContent:'',innerHTML:'',dataset:{},children:[],style:{setProperty(n,v){this[n]=v;}},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},removeEventListener(){},appendChild(x){this.children.push(x);},append(...x){this.children.push(...x);},removeChild(x){this.children=this.children.filter(y=>y!==x);},setAttribute(){},querySelector(){return null;},getAttribute(){return null;},focus(){},click(){}};}
function createHarness(seed){
 const els=new Map(),get=id=>{if(!els.has(id))els.set(id,mockElement(id));return els.get(id);},math=Object.create(Math),stored=new Map();math.random=seededRandom(seed);
 const sb={console,URLSearchParams,Blob,Date,Math:math,setTimeout(){return 0;},clearTimeout(){},setInterval(){return null;},clearInterval(){},URL:{createObjectURL(){throw Error('Workers are not used.');},revokeObjectURL(){}},window:{location:{search:''},innerWidth:1024,Worker:function(){},addEventListener(){}},document:{readyState:'loading',getElementById:get,querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){},createElement:mockElement,body:get('body'),documentElement:get('documentElement')},localStorage:{getItem(k){return stored.has(k)?stored.get(k):null;},setItem(k,v){stored.set(k,String(v));}}};
 const src=fs.readFileSync(path.join(ROOT,'script.js'),'utf8'),cut=src.indexOf(MARKER);if(cut<0)throw Error('script.js startup boundary not found.');
 vm.createContext(sb);vm.runInContext(fs.readFileSync(path.join(ROOT,'engines/minmax-engine.js'),'utf8'),sb,{filename:'engines/minmax-engine.js'});
 const api=['globalThis.calibrationApi={EngineContract,MinMaxLegacy,allLegalState,inCheck,findLegalMoveMatch,play,aiPlaceMoatForColor,',
 'setState(v){state=v;history=[clone(v)];historyMoveLogs=[[]];moveLog=[];gameOver=false;gameOverMessage="";},',
 'getState(){return clone(state);},getPositionKey(st){return getPositionKey(st);},getGameOver(){return gameOver;},getGameOverMessage(){return gameOverMessage;}};'].join('\n');
 vm.runInContext(src.slice(0,cut)+'\n'+api,sb,{filename:'script.js'});
 vm.runInContext(fs.readFileSync(path.join(ROOT,'engines/mcts-engine.js'),'utf8'),sb,{filename:'engines/mcts-engine.js'});get('modeSelect').value='ai_vs_ai';return sb;
}
function initialPosition(layout='classic'){
 const back=layout==='center'?['r','n','b','j','q','k','j','b','n','r']:['r','j','n','b','q','k','b','n','j','r'],board=Array.from({length:8},()=>Array(10).fill(null));
 for(let c=0;c<10;c++){board[0][c]={type:back[c],color:'b',moved:false};board[1][c]={type:'p',color:'b',moved:false};board[6][c]={type:'p',color:'w',moved:false};board[7][c]={type:back[c],color:'w',moved:false};}
 return{board,turn:'w',ply:0,ep:null,moats:{w:null,b:null},moatDestroyed:{w:false,b:false},hasPlacedMoat:{w:false,b:false},moveCounts:{w:0,b:0},phase:'normal',captured:{w:[],b:[]},halfmoveClock:0,positionHistory:{},clocks:{w:0,b:0}};
}
function profile(id){const m=/^(minmax|mcts)-([123])$/.exec(id);if(!m)throw Error('Unknown profile '+id);return{id,engine:m[1],level:Number(m[2])};}
function searchMove(sb,st,id,scale){
 const p=profile(id),engineId=p.engine==='minmax'?'minmax_legacy':'mcts',timeMs=Math.max(1,Math.round(BUDGETS[p.engine][p.level]*scale));
 const req=sb.calibrationApi.EngineContract.createRequest({requestId:'cal-'+st.ply+'-'+id,generation:st.ply,engineId,position:st,limits:{depth:p.level,timeMs}});
 const engine=p.engine==='minmax'?sb.calibrationApi.MinMaxLegacy:sb.mctsEngine(p.level),start=process.hrtime.bigint(),res=engine.search(req),elapsed=Number(process.hrtime.bigint()-start)/1e6;
 if(res.status==='no-move')return{move:null,elapsed,timedOut:false};if(res.status!=='completed')throw Error(id+' search failed: '+JSON.stringify(res.error||res));
 const move=sb.calibrationApi.findLegalMoveMatch(st,res.move);if(!move)throw Error(id+' returned an illegal move.');
 return{move,elapsed,timedOut:Boolean(res.metadata&&res.metadata.timedOut)};
}
function finishMoats(sb,st){let n=0;while(st.phase==='place_moat_w'||st.phase==='place_moat_b'){if(++n>2)throw Error('Unexpected moat-placement loop.');sb.calibrationApi.aiPlaceMoatForColor(st.phase.endsWith('_w')?'w':'b',true);st=sb.calibrationApi.getState();}return st;}
function runGame(a,b,o,seed,aColor,layout='classic'){
 const sb=createHarness(seed),api=sb.calibrationApi;let st=initialPosition(layout);st.positionHistory[api.getPositionKey(st)]=1;api.setState(st);
 const times={[a]:[],[b]:[]};let plies=0,out=null;
 while(plies<o.maxPlies){
  st=api.getState();const legal=api.allLegalState(st,st.turn);
  if(!legal.length){const check=api.inCheck(st.turn,st.board,st.moats);out={winner:check?(st.turn==='w'?'b':'w'):null,termination:check?'checkmate':'stalemate'};break;}
  const id=st.turn===aColor?a:b,found=searchMove(sb,st,id,o.budgetScale);times[id].push(found);
  if(!found.move){out={winner:null,termination:'unexpected-no-move'};break;}
  api.play(found.move,'q',true);plies++;st=api.getState();if(st.phase==='place_moat_w'||st.phase==='place_moat_b')st=finishMoats(sb,st);
  if(api.getGameOver()){const noMoves=api.allLegalState(st,st.turn).length===0,check=noMoves&&api.inCheck(st.turn,st.board,st.moats);out=check?{winner:st.turn==='w'?'b':'w',termination:'checkmate'}:{winner:null,termination:noMoves?'stalemate':'draw'};break;}
 }
 if(!out)out={winner:null,termination:'max-plies'};
 const scoreA=out.winner===null?.5:out.winner===aColor?1:0,stats={};
 for(const id of[a,b]){const xs=times[id].map(x=>x.elapsed).sort((x,y)=>x-y);stats[id]={searches:xs.length,meanMs:xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0,medianMs:xs.length?xs[Math.floor(xs.length/2)]:0,budgetHitRate:times[id].length?times[id].filter(x=>x.timedOut).length/times[id].length:0};}
 return{seed,layout,a,b,aColor,scoreA,winner:out.winner,termination:out.termination,plies,searchStats:stats};
}
function summarize(a,b,games){const score=games.reduce((s,g)=>s+g.scoreA,0)/games.length,[lo,hi]=wilson(score,games.length);return{a,b,wins:games.filter(g=>g.scoreA===1).length,draws:games.filter(g=>g.scoreA===.5).length,losses:games.filter(g=>g.scoreA===0).length,score,eloAOverB:elo(score),elo95:[elo(lo),elo(hi)]};}
function runTournament(o){
 const pairs=o.pair?[o.pair]:IDS.flatMap((a,i)=>IDS.slice(i+1).map(b=>[a,b])),games=[],summaries=[];let index=0;
 for(const[a,b]of pairs){const batch=[];for(let n=0;n<o.gamesPerPair;n++){const g=runGame(a,b,o,(o.seed+(++index*1009))>>>0,n%2===0?'w':'b',index%2===0?'classic':'center');games.push(g);batch.push(g);}summaries.push(summarize(a,b,batch));}
 return{methodology:{profiles:IDS,gamesPerPair:o.gamesPerPair,maxPlies:o.maxPlies,seed:o.seed,budgetScale:o.budgetScale,budgetMs:BUDGETS,note:'Pairwise relative Elo only. Approximate 95% Wilson intervals transformed to Elo; results depend on device/runtime and budgets.'},pairs:summaries,games};
}
function selfTest(){const a=seededRandom(17),b=seededRandom(17);for(let i=0;i<10;i++)if(a()!==b())throw Error('Seeded PRNG mismatch.');if(Math.abs(elo(.5))>1e-9)throw Error('Elo midpoint mismatch.');const g=runGame('minmax-1','mcts-1',{maxPlies:2,budgetScale:.001},12345,'w','center');if(g.plies!==2||g.termination!=='max-plies')throw Error('Smoke game failed: '+JSON.stringify(g));return{ok:true,checks:['seeded PRNG','Elo midpoint','two legal plies across MinMax and MCTS'],smokeGame:g};}
function format(r){const lines=['Pairwise engine strength (A relative to B)','Colour-balanced games; relative estimates, not official ratings.','','A             B             W-D-L       Score     Elo A-B       Approx. 95% interval'];for(const p of r.pairs)lines.push(p.a.padEnd(13)+' '+p.b.padEnd(13)+' '+(p.wins+'-'+p.draws+'-'+p.losses).padEnd(10)+' '+(p.score*100).toFixed(1).padStart(5)+'% '+p.eloAOverB.toFixed(0).padStart(8)+'   '+p.elo95[0].toFixed(0)+' to '+p.elo95[1].toFixed(0));lines.push('','Games: '+r.games.length+'; budget scale x'+r.methodology.budgetScale+'; max plies '+r.methodology.maxPlies+'.','Small samples produce wide intervals; increase games per pair before interpreting small differences.');return lines.join('\n');}
if(require.main===module){try{const o=parseArgs(process.argv.slice(2));if(o.help)process.stdout.write(helpText()+'\n');else if(o.selfTest)process.stdout.write(JSON.stringify(selfTest(),null,2)+'\n');else{const r=runTournament(o);process.stdout.write(o.json?JSON.stringify(r,null,2)+'\n':format(r)+'\n');}}catch(e){process.stderr.write((e&&e.stack)||String(e));process.stderr.write('\n');process.exitCode=1;}}
module.exports={seededRandom,wilson,elo,initialPosition,profile,parseArgs,createHarness,runGame,runTournament,selfTest};
