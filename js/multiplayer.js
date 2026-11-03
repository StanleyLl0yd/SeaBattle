// The online room controller never changes the local single-player game.
const ONLINE_SESSION_KEY="seabattle.online.session.v1";
const ONLINE_TEXT={
 en:{
 open:"Play with a friend",back:"Back to solo",heading:"Play with a friend",brand:"Sea Battle · Two players",
 intro:"Invite one friend. Both players must stay online; no accounts required.",
 name:"Your name (optional)",create:"Create room",roomCode:"Invitation code",join:"Join",
 copy:"Copy invite link",copied:"Link copied",copyFallback:"Select and copy the link",
 room:"Room",round:"Round",myBoard:"Your fleet",enemyBoard:"Friend's fleet",shots:"Shots",
 ready:"Ready",random:"Random fleet",manual:"Manual placement",rotate:"Rotate",undo:"Undo",
 leave:"Leave room",claim:"Claim victory",rematch:"Rematch",resume:"Resume current room",
 waiting:"Waiting for your friend…",placement:"Place your fleet and press Ready.",
 readyWaiting:"Ready! Waiting for the other player.",myTurn:"Your turn.",
 theirTurn:"Friend's turn.",offline:"Friend disconnected. Game paused.",
 seconds:"seconds to reconnect",claimable:"Your friend did not return. You may claim victory.",
 win:"You won!",loss:"You lost.",closed:"The room was closed.",
 match:"Battle",online:"online",away:"offline",confirmSurrender:"Leave and concede this battle?",
 confirmLeave:"Close this room for both players?",remoteError:"Connection problem. Retrying…",
 ROOM_NOT_FOUND:"Room not found.",ROOM_EXPIRED:"Room expired.",ROOM_FULL:"Room already has two players.",
 NOT_AUTHORIZED:"Session no longer valid.",INVALID_CODE:"Invalid invitation code.",
 INVALID_FLEET:"Invalid ship layout.",INVALID_PHASE:"Action not available now.",
 NOT_YOUR_TURN:"Not your turn.",OPPONENT_OFFLINE:"Friend is offline. Battle paused.",
 CELL_UNAVAILABLE:"Cell already known.",CANNOT_CLAIM:"Reconnect period not finished.",
 RETRY:"Concurrent update; refreshing…",SERVER_UNAVAILABLE:"Game server unavailable.",
 INVALID_REQUEST:"Invalid request.",ROOM_UNAVAILABLE:"Unable to create room."
 },
 ru:{
 open:"Играть с другом",back:"К одиночной игре",heading:"Играть с другом",brand:"Морской бой · Два игрока",
 intro:"Пригласите друга. Оба игрока должны быть онлайн. Без регистрации.",
 name:"Ваше имя (необязательно)",create:"Создать комнату",roomCode:"Код приглашения",join:"Войти",
 copy:"Скопировать приглашение",copied:"Ссылка скопирована",copyFallback:"Выделите и скопируйте ссылку",
 room:"Комната",round:"Раунд",myBoard:"Ваш флот",enemyBoard:"Флот друга",shots:"Выстрелы",
 ready:"Готов",random:"Случайный флот",manual:"Ручная расстановка",rotate:"Повернуть",undo:"Отменить",
 leave:"Покинуть комнату",claim:"Засчитать победу",rematch:"Реванш",resume:"Вернуться в партию",
 waiting:"Ожидание подключения друга…",placement:"Расставьте флот и нажмите «Готов».",
 readyWaiting:"Готово! Ожидание соперника.",myTurn:"Ваш ход.",
 theirTurn:"Ход соперника.",offline:"Друг отключился. Бой приостановлен.",
 seconds:"сек. до окончания ожидания",claimable:"Друг не вернулся. Можно засчитать победу.",
 win:"Вы победили!",loss:"Вы проиграли.",closed:"Комната закрыта.",
 match:"Бой",online:"в сети",away:"не в сети",confirmSurrender:"Покинуть бой и признать поражение?",
 confirmLeave:"Закрыть комнату для обоих игроков?",remoteError:"Проблема со связью. Повторная попытка…",
 ROOM_NOT_FOUND:"Комната не найдена.",ROOM_EXPIRED:"Срок действия комнаты истёк.",ROOM_FULL:"В комнате уже два игрока.",
 NOT_AUTHORIZED:"Сеанс недействителен.",INVALID_CODE:"Неверный код приглашения.",
 INVALID_FLEET:"Некорректная расстановка.",INVALID_PHASE:"Действие сейчас недоступно.",
 NOT_YOUR_TURN:"Не ваш ход.",OPPONENT_OFFLINE:"Друг не в сети. Бой приостановлен.",
 CELL_UNAVAILABLE:"Клетка уже открыта.",CANNOT_CLAIM:"Время ожидания ещё не истекло.",
 RETRY:"Одновременное изменение. Обновляем…",SERVER_UNAVAILABLE:"Сервер недоступен.",
 INVALID_REQUEST:"Некорректный запрос.",ROOM_UNAVAILABLE:"Не удалось создать комнату."
 }
};
const onlineT=key=>(ONLINE_TEXT[language]||ONLINE_TEXT.en)[key]||ONLINE_TEXT.en[key]||key;
const onlineId=id=>document.getElementById(id);
let onlineActive=false,onlineSession=null,onlineView=null,onlineFleet=null;
let onlineManual=false,onlineHorizontal=true,onlineBusy=false,onlineTimer=0,onlineEpoch=0;
function onlineSave(value){
  onlineSession=value;
  try{if(value)localStorage.setItem(ONLINE_SESSION_KEY,JSON.stringify(value));
    else localStorage.removeItem(ONLINE_SESSION_KEY);}catch{}
}
function onlineRestore(){
  try{
    const s=JSON.parse(localStorage.getItem(ONLINE_SESSION_KEY)||"null");
    if(s&&/^[A-HJ-NP-Z2-9]{12}$/.test(s.code)&&/^[A-Za-z0-9_-]{48}$/.test(s.token))
      return {code:s.code,token:s.token};
  }catch{}
  return null;
}
function onlineInvite(code){
  const url=new URL(location.href);
  url.search="";url.hash="";url.searchParams.set("room",code);
  return url.toString();
}
function onlineMessage(key){
  onlineId("online-error").textContent=key?onlineT(key):"";
}
async function onlineFetch(action,body={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(ONLINE_API,{method:"POST",headers:{"content-type":"application/json"},
      cache:"no-store",signal:controller.signal,body:JSON.stringify({action,...body})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||"SERVER_UNAVAILABLE");
    return result;
  }finally{clearTimeout(timer);}
}
function onlineCurrentFleet(){
  return onlineView?.myFleet||onlineFleet?.ships.map(s=>s.cells)||[];
}
function onlineGrid(id,marks,ships,shootable,placeable){
  const board=onlineId(id);
  const visible=new Set(ships.flat()),focused=document.activeElement?.parentElement===board?
    document.activeElement.dataset.i:null;
  let html="";
  for(let i=0;i<100;i++){
    const mark=["miss","hit","sunk","blocked"].includes(marks[i])?marks[i]:null;
    const classes=["cell"];
    if(mark)classes.push(mark,"fired");
    else if(visible.has(i))classes.push("ship");
    classes.push(id==="online-their-grid"?"enemy-cell":"own-cell");
    const enabled=(shootable&&!mark||placeable)&&!onlineBusy;
    const coordinate=LETTERS[language][i%10]+(Math.floor(i/10)+1);
    html+='<button type="button" class="'+classes.join(" ")+'" data-i="'+i+
      '" aria-label="'+coordinate+'"'+(enabled?'':' disabled')+'></button>';
  }
  board.innerHTML=html;
  if(focused!==null)board.querySelector('[data-i="'+focused+'"]:not(:disabled)')?.focus({preventScroll:true});
}
function renderMultiplayerLocale(){
  if(typeof document==="undefined"||!onlineId("online-open"))return;
  document.querySelectorAll("[data-online-i18n]").forEach(n=>{n.textContent=onlineT(n.dataset.onlineI18n);});
  document.querySelectorAll("[data-online-placeholder]").forEach(n=>{n.placeholder=onlineT(n.dataset.onlinePlaceholder);});
  document.querySelectorAll("[data-online-aria]").forEach(n=>{n.setAttribute("aria-label",onlineT(n.dataset.onlineAria));});
  onlineId("online-open").textContent=onlineT(onlineActive?"back":"open");
  const brand=document.querySelector('[data-i18n="brand"]');
  if(brand&&onlineActive)brand.textContent=onlineT("brand");
  if(onlineActive)onlineRender(true);
}
function onlineRender(force=false){
  const view=onlineView;
  onlineId("online-lobby").hidden=!!view;
  onlineId("online-game").hidden=!view;
  onlineId("online-resume").hidden=!!view||!onlineSession;
  if(!view)return;
  onlineId("online-room-code").textContent=onlineT("room")+" "+view.code+" · "+onlineT("round")+" "+view.round;
  onlineId("online-invitation").value=onlineInvite(view.code);
  onlineId("online-presence").textContent=(view.opponentName||"—")+" · "+onlineT(view.opponentOnline?"online":"away");
  const setup=["waiting","placement"].includes(view.phase);
  const playing=view.phase==="playing",finished=view.phase==="finished";
  onlineId("online-placement").hidden=!setup;
  onlineId("online-after").hidden=!finished;
  onlineId("online-claim").hidden=!view.claimAvailable;
  onlineId("online-ready").disabled=onlineBusy||view.myReady||onlineCurrentFleet().length!==10;
  for(const id of ["online-random","online-manual","online-rotate","online-undo"])
    onlineId(id).disabled=onlineBusy||view.myReady||!setup;
  onlineId("online-rotate").disabled ||=!onlineManual;
  onlineId("online-undo").disabled ||=!onlineManual||onlineCurrentFleet().length===0;
  onlineId("online-rematch").disabled=onlineBusy||view.myRematch;
  onlineId("online-rematch-status").textContent=view.myRematch?onlineT("readyWaiting"):"";
  let status;
  if(view.phase==="waiting")status=onlineT("waiting");
  else if(setup)status=onlineT(view.myReady?"readyWaiting":"placement");
  else if(playing){
    status=!view.opponentOnline?onlineT(view.claimAvailable?"claimable":"offline"):
      onlineT(view.turn===view.role?"myTurn":"theirTurn");
    if(!view.opponentOnline&&!view.claimAvailable&&view.reconnectSeconds!==null)
      status+=" "+view.reconnectSeconds+" "+onlineT("seconds");
  }else status=onlineT(!view.winner?"closed":view.winner===view.role?"win":"loss");
  onlineId("online-status").textContent=status;
  onlineId("online-my-count").textContent=view.ownAfloat+" / 10";
  onlineId("online-their-count").textContent=view.enemyAfloat+" / 10";
  onlineId("online-my-shots").textContent=String(view.ownShots);
  onlineId("online-their-shots").textContent=String(view.enemyShots);
  const canFire=playing&&view.turn===view.role&&view.opponentOnline;
  const key=JSON.stringify([view.version,language,onlineBusy,onlineManual,onlineCurrentFleet(),canFire]);
  if(force||onlineId("online-game").dataset.renderKey!==key){
    onlineId("online-game").dataset.renderKey=key;
    onlineGrid("online-my-grid",view.own,onlineCurrentFleet(),false,setup&&!view.myReady&&onlineManual);
    onlineGrid("online-their-grid",view.enemy,[],canFire,false);
  }
}
function onlineAccept(view){
  if(!onlineSession)return;
  if(onlineView&&onlineView.code===view.code&&view.version<onlineView.version)return;
  if(onlineView&&onlineView.round!==view.round){
    onlineFleet=randomFleet();onlineManual=false;
  }
  onlineView=view;onlineRender();
}
function onlineStop(){
  onlineEpoch++;clearTimeout(onlineTimer);onlineTimer=0;
}
function onlinePoll(){
  onlineStop();
  const epoch=onlineEpoch;
  async function tick(){
    if(!onlineActive||!onlineSession||epoch!==onlineEpoch)return;
    if(!onlineBusy){
      try{
        const result=await onlineFetch("state",onlineSession);
        if(epoch!==onlineEpoch)return;
        onlineAccept(result);onlineMessage();
      }catch(error){
        if(epoch!==onlineEpoch)return;
        if(["ROOM_EXPIRED","NOT_AUTHORIZED","ROOM_NOT_FOUND"].includes(error.message)){
          onlineSave(null);onlineView=null;onlineRender();
        }
        onlineMessage(ONLINE_TEXT.en[error.message]?error.message:"remoteError");
      }
    }
    if(epoch===onlineEpoch&&onlineSession&&onlineActive)
      onlineTimer=setTimeout(tick,document.hidden?5000:1500);
  }
  void tick();
}
async function onlineAction(action,params={}){
  if(onlineBusy||!onlineSession)return false;
  onlineBusy=true;onlineRender();
  try{
    const result=await onlineFetch(action,{...onlineSession,...params});
    onlineAccept(result);onlineMessage();onlinePoll();return true;
  }catch(error){onlineMessage(ONLINE_TEXT.en[error.message]?error.message:"remoteError");return false;}
  finally{onlineBusy=false;onlineRender();}
}
async function onlineStart(action){
  if(onlineBusy)return;
  onlineBusy=true;
  try{
    const params=action==="create"?{name:onlineId("online-name").value}:
      {code:onlineId("online-join-code").value.trim().toUpperCase(),name:onlineId("online-name").value};
    const result=await onlineFetch(action,params);
    onlineSave({code:result.code,token:result.token});
    onlineFleet=randomFleet();onlineManual=false;onlineHorizontal=true;
    onlineView=null;onlineAccept(result);onlineMessage();onlinePoll();
  }catch(error){onlineMessage(ONLINE_TEXT.en[error.message]?error.message:"remoteError");}
  finally{onlineBusy=false;onlineRender();}
}
function onlineSwitch(enabled){
  onlineActive=enabled;
  document.body.classList.toggle("online-mode",enabled);
  onlineId("solo-area").hidden=enabled;
  onlineId("online-area").hidden=!enabled;
  renderMultiplayerLocale();
  if(enabled&&onlineSession){if(!onlineFleet)onlineFleet=randomFleet();onlinePoll();}
  else onlineStop();
}
function onlineInit(){
  if(!onlineId("online-open"))return;
  if(typeof ONLINE_API!=="string"||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/seabattle-multiplayer$/.test(ONLINE_API)){
    onlineId("online-open").hidden=true;return;
  }
  onlineId("online-open").hidden=false;onlineSession=onlineRestore();
  const invite=new URL(location.href).searchParams.get("room");
  if(invite&&/^[A-HJ-NP-Z2-9]{12}$/i.test(invite)){
    onlineId("online-join-code").value=invite.toUpperCase();
    if(onlineSession?.code!==invite.toUpperCase())onlineSession=null;
    onlineSwitch(true);
  }
  const on=(id,fn)=>onlineId(id).addEventListener("click",fn);
  on("online-open",()=>onlineSwitch(!onlineActive));
  on("online-create",()=>void onlineStart("create"));
  on("online-join",()=>void onlineStart("join"));
  on("online-resume",()=>onlineSwitch(true));
  on("online-copy",async()=>{
    try{await navigator.clipboard.writeText(onlineId("online-invitation").value);onlineMessage("copied");}
    catch{onlineId("online-invitation").select();onlineMessage("copyFallback");}
  });
  on("online-random",()=>{onlineFleet=randomFleet();onlineManual=false;onlineRender(true);});
  on("online-manual",()=>{onlineFleet=createBoard();onlineManual=true;onlineHorizontal=true;onlineRender(true);});
  on("online-rotate",()=>{onlineHorizontal=!onlineHorizontal;onlineRender();});
  on("online-undo",()=>{
    if(!onlineManual||!onlineFleet?.ships.length)return;
    const ship=onlineFleet.ships.pop();
    for(const at of ship.cells)onlineFleet.cells[at]=-1;
    onlineRender(true);
  });
  onlineId("online-my-grid").addEventListener("click",event=>{
    const cell=event.target.closest(".cell"),view=onlineView;
    if(!cell||!view||view.myReady||!["waiting","placement"].includes(view.phase)||
      !onlineManual||onlineBusy)return;
    const size=FLEET[onlineFleet.ships.length];
    if(!size)return;
    const pick=candidate(onlineFleet,size,Number(cell.dataset.i),onlineHorizontal);
    if(pick.valid){placeShip(onlineFleet,pick.cells);onlineRender(true);}
  });
  onlineId("online-their-grid").addEventListener("click",event=>{
    const cell=event.target.closest(".cell");
    if(cell&&!cell.disabled&&onlineView?.phase==="playing"&&onlineView.turn===onlineView.role)
      void onlineAction("fire",{cell:Number(cell.dataset.i)});
  });
  on("online-ready",()=>{if(onlineCurrentFleet().length===10)void onlineAction("ready",{fleet:onlineCurrentFleet()});});
  on("online-claim",()=>void onlineAction("claim"));
  on("online-rematch",()=>void onlineAction("rematch"));
  on("online-leave",async()=>{
    if(!onlineView)return;
    const playing=onlineView.phase==="playing",preparing=["waiting","placement"].includes(onlineView.phase);
    if((playing||preparing)&&!confirm(onlineT(playing?"confirmSurrender":"confirmLeave")))return;
    if((playing||preparing)&&!await onlineAction(playing?"surrender":"leave"))return;
    onlineSave(null);onlineView=null;onlineFleet=null;onlineSwitch(false);
  });
  renderMultiplayerLocale();
}
if(typeof window!=="undefined"&&typeof document!=="undefined")onlineInit();
