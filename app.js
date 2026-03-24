// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyB-jHnCvVaJXUpFq3Glnz6MFH7HYiPxjGw",
  authDomain: "resonanceweb-1a65d.firebaseapp.com",
  projectId: "resonanceweb-1a65d",
  storageBucket: "resonanceweb-1a65d.firebasestorage.app",
  messagingSenderId: "605135604978",
  appId: "1:605135604978:web:87ec9cf023d7899c28146b"
};
firebase.initializeApp(firebaseConfig);
const fdb = firebase.firestore();
// ===== STATE =====
let DB = {
  users: [],
  posts: [],
  comments: {},  // postId -> []
  forums: [],
  forumPosts: {}, // forumId -> []
  messages: {}   // "u1:u2" sorted -> []
};
let ME = null;
let curForumId = null;
let curChatPartner = null;

const SUPER_ADMINS = ['MadGod']; // 
function isAdmin() { return ME && SUPER_ADMINS.includes(ME.name); }

const SPARK_COLORS = [
  { name:'Огонь',  val:'#ff6600', bg:'#2a1000' },
  { name:'Кровь',  val:'#dd0000', bg:'#200000' },
  { name:'Пустота',val:'#9900cc', bg:'#1a0028' },
  { name:'Лёд',    val:'#0088ff', bg:'#001428' },
  { name:'Яд',     val:'#00cc44', bg:'#001a08' },
  { name:'Пепел',  val:'#aaaaaa', bg:'#111111' },
];

const SEL_COLORS = [
  { name:'Кровь',  bg:'#3a0000', fg:'#ff4400' },
  { name:'Пустота',bg:'#1a0030', fg:'#cc44ff' },
  { name:'Лёд',    bg:'#001428', fg:'#44aaff' },
  { name:'Яд',     bg:'#001408', fg:'#00ff66' },
  { name:'Пепел',  bg:'#1a1a1a', fg:'#aaaaaa' },
  { name:'Золото', bg:'#1a1000', fg:'#ffaa00' },
];

// ===== PROPHECY WORDS =====
const WORDS = [
  'тень','свет','вода','огонь','камень','ветер','дым','пыль','соль','пепел',
  'кровь','кость','нить','игла','зеркало','дверь','порог','ключ','замок','яма',
  'колодец','башня','мост','река','лес','поле','небо','земля','корень','ветвь',
  'лист','семя','плод','цветок','трава','ночь','рассвет','закат','полночь','час',
  'память','сон','слово','имя','голос','шёпот','крик','молчание','ложь','истина',
  'знак','печать','метка','рубец','след','путь','дорога','тропа','лабиринт','выход',
  'сердце','глаз','рука','рот','ухо','кожа','кость','мозг','нерв','дыхание',
  'страх','жажда','боль','усталость','холод','жар','голод','покой','ярость','нежность',
  'встреча','разлука','ожидание','уход','начало','конец','предел','бездна','глубина','высота',
  'перемена','повторение','цикл','разрыв','петля','спираль','узел','хаос','порядок','пустота',
];
function makeProphecy() {
  const len = 5 + Math.floor(Math.random() * 8);
  const ws = [];
  for (let i = 0; i < len; i++) ws.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return ws.join(' · ');
}
// ===== SAVE/LOAD =====
function save() {
  // Локальный бэкап (на случай обрыва связи)
  localStorage.setItem('_set_db', JSON.stringify(DB)); 
  // Отправляем слепок Сети в облако
  fdb.collection('network').doc('main').set(DB).catch(e => console.error("Ошибка Эфира:", e));
}

function load() {
  // 1. Мгновенная загрузка из кэша
  const raw = localStorage.getItem('_set_db');
  if (raw) DB = { ...DB, ...JSON.parse(raw) };

  // 2. Установка телепатической связи (слушаем облако в реальном времени)
  fdb.collection('network').doc('main').onSnapshot(doc => {
    if (doc.exists) {
      DB = { ...DB, ...doc.data() }; // Обновляем локальную базу данными из облака
      
      // Если мы залогинены — моментально обновляем интерфейс
      if (ME) {
        ME = DB.users.find(u => u.name === ME.name) || ME; // Синхронизируем свой профиль
        renderFeed(); 
        renderSidebar(); 
        renderForums(); 
        renderDialogs();
        if (curForumId) renderForumPosts(curForumId);
        if (curChatPartner) renderMessages();
      }
    }
  });
}
function saveMe() { if(ME) localStorage.setItem('_set_me', ME.name); }
function loadMe() {
  const n = localStorage.getItem('_set_me');
  if (n) ME = DB.users.find(u => u.name === n) || null;
}
// ===== CURSOR =====
const mainSpark = document.getElementById('spark-main');
const curLayer = document.getElementById('cur-layer');
const TRAIL = 14;
const trailEls = [];
for(let i=0;i<TRAIL;i++){
  const d = document.createElement('div');
  d.className = 'spark';
  d.style.opacity = ((1 - i/TRAIL)*0.55).toFixed(2);
  d.style.width = d.style.height = Math.max(1, 4 - i*0.2) + 'px';
  curLayer.appendChild(d);
  trailEls.push(d);
}
let mx=0, my=0, positions=[];
for(let i=0;i<TRAIL;i++) positions.push({x:0,y:0});

document.addEventListener('mousemove', e => {
  mx=e.clientX; my=e.clientY;
  mainSpark.style.left=mx+'px'; mainSpark.style.top=my+'px';
  positions = [{x:mx,y:my},...positions.slice(0,TRAIL-1)];
  trailEls.forEach((t,i)=>{ t.style.left=positions[i].x+'px'; t.style.top=positions[i].y+'px'; });
  resetIdle();
});

function setSparkColor(c) {
  mainSpark.style.background = c;
  mainSpark.style.boxShadow = `0 0 8px ${c}, 0 0 16px ${c}44`;
  trailEls.forEach(t => { t.style.background=c; t.style.boxShadow=`0 0 5px ${c}`; });
  document.documentElement.style.setProperty('--spark', c);
}

function setSelColor(bg, fg) {
  const style = document.getElementById('dyn-sel') || Object.assign(document.createElement('style'),{id:'dyn-sel'});
  style.textContent = `::selection { background:${bg}; color:${fg}; text-shadow:0 0 4px ${fg}; }`;
  if(!document.getElementById('dyn-sel')) document.head.appendChild(style);
  document.documentElement.style.setProperty('--sel-bg', bg);
  document.documentElement.style.setProperty('--sel-fg', fg);
}

// ===== IDLE =====
let idleT;
const veil = document.getElementById('veil');
function resetIdle() {
  clearTimeout(idleT);
  veil.style.background='rgba(0,0,0,0)';
  idleT=setTimeout(()=>{ veil.style.background='rgba(0,0,0,0.65)'; },180000);
}
resetIdle();

// ===== CLOCK =====
function updateClock() {
  const n=new Date();
  document.getElementById('tb-clock').textContent=
    String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
}
setInterval(updateClock,1000); updateClock();

// ===== TOAST =====
let toastT;
function toast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),3000);
}

// ===== AUTH =====
function switchAuthTab(t) {
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',(t==='login'?i===0:i===1)));
  document.getElementById('auth-login').style.display = t==='login'?'':'none';
  document.getElementById('auth-register').style.display = t==='register'?'':'none';
}

let regAv = '🜂';
function selectAv(el) {
  document.querySelectorAll('#auth-register .avatar-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected'); regAv = el.dataset.av;
}

function doLogin() {
  const name = document.getElementById('l-name').value.trim();
  const pass = document.getElementById('l-pass').value;
  const u = DB.users.find(u=>u.name===name && u.pass===pass);
  if (!u) { document.getElementById('l-err').style.display='block'; return; }
  ME = u; saveMe(); startApp();
}

function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const pass = document.getElementById('r-pass').value;
  const err = document.getElementById('r-err');
  if (!name || name.length < 2) { err.textContent='⚠ Позывной слишком короткий'; err.style.display='block'; return; }
  if (pass.length < 4) { err.textContent='⚠ Пароль слишком слабый'; err.style.display='block'; return; }
  if (DB.users.find(u=>u.name===name)) { err.textContent='⚠ Этот позывной уже занят'; err.style.display='block'; return; }
  const u = { name, pass, avatar:regAv, karma:0, sparkColor:'#ff6600', selBg:'#3a0000', selFg:'#ff4400', subs:[], forums:[], postCount:0, commentCount:0, joined:Date.now() };
  DB.users.push(u); save(); ME=u; saveMe(); startApp();
}

function doLogout() {
  ME=null; localStorage.removeItem('_set_me');
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
}

// ===== START APP =====
function startApp() {
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('nav-uname').textContent = ME.name;
  document.getElementById('prophecy-bar').textContent = makeProphecy();
  setSparkColor(ME.sparkColor||'#ff6600');
  setSelColor(ME.selBg||'#3a0000', ME.selFg||'#ff4400');
  renderFeed(); renderSidebar(); renderForums(); renderMyForumsList();
  renderColorPickers(); renderProfilePage(); renderDialogs();
  updateForumSelect();
}

// ===== PAGES =====
function showPage(p) {
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  const tabs = document.querySelectorAll('.nav-tab');
  const map = {ether:0,broadcasts:1,chats:2,profile:3};
  if(map[p]!==undefined) tabs[map[p]].classList.add('active');
  if(p==='chats') renderDialogs();
  if(p==='profile') renderProfilePage();
  if(p==='broadcasts') renderForums();
}

// ===== KARMA RING =====
function karmaRing(karma) {
  if(karma < 0) return 'bad';
  if(karma < 10) return 'g0';
  if(karma < 50) return 'g1';
  if(karma < 200) return 'g2';
  return 'g3';
}

// ===== RENDER FEED =====
function renderFeed() {
  const el = document.getElementById('feed-list');
  const feed = [...DB.posts].reverse();
  if(!feed.length){
    el.innerHTML='<div class="empty-state">Эфир пуст. Будьте первым.</div>';
    document.getElementById('feed-count').textContent='0 трансляций';
    return;
  }
  // Передаем контекст 'feed', чтобы ID не дублировались
  el.innerHTML = feed.map(p=>renderPost(p, 'feed')).join('');
  document.getElementById('feed-count').textContent = feed.length+' трансляций';
  document.getElementById('sb-online').textContent = DB.users.length;
  document.getElementById('online-count').innerHTML = '<span class="online-dot"></span> '+DB.users.length+' в сети';
}

function renderPost(p, ctx = 'feed') {
  const author = DB.users.find(u=>u.name===p.author)||{name:p.author,avatar:'?',karma:0};
  const isPostAdmin = p.pinned;
  const myLike = p.likes&&p.likes.includes(ME.name);
  const myDislike = p.dislikes&&p.dislikes.includes(ME.name);
  const cmtCount = (DB.comments[p.id]||[]).length;
  const ring = karmaRing(author.karma||0);
  const forumRef = p.forumId ? `<div class="post-forum-ref">📡 <a onclick="openForum('${p.forumId}')">${getForumName(p.forumId)}</a></div>` : '';
  const adminTag = isPostAdmin ? `<span class="post-tag admin">ЗАКРЕПЛЕНО</span>` : '';
  const adminClass = isPostAdmin ? ' admin' : '';
  const body = p.body.replace(/\[spoiler\](.*?)\[\/spoiler\]/g,'<span class="spoiler" onclick="this.classList.toggle(\'open\')">$1</span>');
  const cmtSection = renderComments(p.id, ctx);
  
  // Проверка прав на удаление
  const canDelete = p.author === ME.name || isAdmin();

  return `<div class="post${adminClass}" id="post-${ctx}-${p.id}">
    <div class="post-hdr">
      <div class="avatar">${author.avatar||'?'}<div class="karma-ring ${ring}"></div></div>
      <div class="post-meta">
        <span class="post-author${isPostAdmin?' admin-name':''}">${p.author}</span>${adminTag}
        <button class="btn sm" style="margin-left:4px;font-size:8px" onclick="startChat('${p.author}')">✉</button>
        ${p.author!==ME.name?`<button class="btn sm" style="font-size:8px;margin-left:2px" onclick="toggleSub('${p.author}')">${(ME.subs||[]).includes(p.author)?'−подписка':'+ подписка'}</button>`:''}
        <br><span class="post-time">${timeAgo(p.ts)}</span>
      </div>
    </div>
    ${forumRef}
    <div class="post-body">${body}</div>
    <div class="post-actions">
      <button class="act${myLike?' liked':''}" onclick="likePost('${p.id}',true)">⟡ ${(p.likes||[]).length}</button>
      <button class="act${myDislike?' disliked':''}" onclick="likePost('${p.id}',false)">☠ ${(p.dislikes||[]).length}</button>
      <button class="act" onclick="toggleComments('${p.id}', '${ctx}')">↩ ${cmtCount}</button>
      ${canDelete ? `<button class="act danger" onclick="deletePost('${p.id}')">✕</button>` : ''}
      <button class="act" onclick="reportPost('${p.id}')">⚔</button>
    </div>
    <div class="comments-section" id="cmts-${ctx}-${p.id}">${cmtSection}</div>
  </div>`;
}

function renderComments(postId, ctx) {
  const cmts = DB.comments[postId]||[];
  const forms = `<div class="comment-form">
    <input id="ci-${ctx}-${postId}" placeholder="Ваш комментарий..." onkeydown="if(event.key==='Enter')submitComment('${postId}', '${ctx}')">
    <button class="btn sm primary" onclick="submitComment('${postId}', '${ctx}')">⟡</button>
  </div>`;
  if(!cmts.length) return forms;
  const list = cmts.map(c=>{
    const au = DB.users.find(u=>u.name===c.author)||{avatar:'?'};
    const canDelCmt = c.author === ME.name || isAdmin();
    return `<div class="comment">
      <div class="comment-avatar">${au.avatar||'?'}</div>
      <div style="flex:1"><div class="comment-meta"><span class="comment-author">${c.author}</span> · ${timeAgo(c.ts)}</div>
      <div class="comment-body" style="word-break:break-word;">${c.body}</div></div>
      ${canDelCmt ? `<button class="act danger sm" style="align-self:flex-start;padding:1px 4px" onclick="deleteComment('${postId}', '${c.id}')">✕</button>` : ''}
    </div>`;
  }).join('');
  return list+forms;
}

function toggleComments(id, ctx) {
  const el = document.getElementById(`cmts-${ctx}-${id}`);
  el.classList.toggle('open');
  if(el.classList.contains('open') && !el.innerHTML.includes('comment-form')){
    el.innerHTML = renderComments(id, ctx);
  }
}

function submitComment(postId, ctx) {
  const inp = document.getElementById(`ci-${ctx}-${postId}`);
  const body = inp.value.trim();
  if(!body) return;
  if(!DB.comments[postId]) DB.comments[postId]=[];
  DB.comments[postId].push({id:uid(),author:ME.name,body,ts:Date.now()});
  ME.commentCount = (ME.commentCount||0)+1;
  updateUser(ME); save();
  
  // Обновляем комменты везде, где пост открыт
  const elFeed = document.getElementById(`cmts-feed-${postId}`);
  const elForum = document.getElementById(`cmts-forum-${postId}`);
  if(elFeed) elFeed.innerHTML = renderComments(postId, 'feed');
  if(elForum) elForum.innerHTML = renderComments(postId, 'forum');
}

function deleteComment(postId, cmtId) {
  if(!DB.comments[postId]) return;
  DB.comments[postId] = DB.comments[postId].filter(c => c.id !== cmtId);
  save(); toast('Комментарий стерт.');
  // Обновляем UI
  const elFeed = document.getElementById(`cmts-feed-${postId}`);
  const elForum = document.getElementById(`cmts-forum-${postId}`);
  if(elFeed) elFeed.innerHTML = renderComments(postId, 'feed');
  if(elForum) elForum.innerHTML = renderComments(postId, 'forum');
}

// ===== POSTS =====
function submitPost() {
  const txt = document.getElementById('compose-text').value.trim();
  if(!txt) { toast('Пустая мыслеформа не транслируется.'); return; }
  const forumId = document.getElementById('post-forum-sel').value || null;
  const p = { id:uid(), author:ME.name, body:txt, ts:Date.now(), likes:[], dislikes:[], forumId, pinned:false };
  DB.posts.push(p);
  ME.postCount = (ME.postCount||0)+1;
  updateUser(ME); save();
  document.getElementById('compose-text').value='';
  document.getElementById('compose-len').textContent='0';
  renderFeed(); renderSidebar();
  if(forumId) { renderForumPosts(forumId); }
  toast('Трансляция принята. Эфир обновлён.');
}

function insertSpoiler() {
  const ta = document.getElementById('compose-text');
  const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd) || 'скрытый текст';
  const before = ta.value.substring(0, ta.selectionStart);
  const after = ta.value.substring(ta.selectionEnd);
  ta.value = before + '[spoiler]' + sel + '[/spoiler]' + after;
}

document.getElementById('compose-text').addEventListener('input', function(){
  document.getElementById('compose-len').textContent = this.value.length;
});

function likePost(id, isLike) {
  const p = DB.posts.find(x=>x.id===id);
  if(!p) return;
  if(!p.likes) p.likes=[]; if(!p.dislikes) p.dislikes=[];

  const hadLike    = p.likes.includes(ME.name);
  const hadDislike = p.dislikes.includes(ME.name);

  // Снимаем текущий голос и откатываем карму
  p.likes    = p.likes.filter(n=>n!==ME.name);
  p.dislikes = p.dislikes.filter(n=>n!==ME.name);
  if(hadLike)    karmaHit(p.author, -1);
  if(hadDislike) karmaHit(p.author,  1);

  // Если нажали ту же кнопку — просто снимаем голос
  const toggling = (isLike && hadLike) || (!isLike && hadDislike);
  if(!toggling) {
    if(isLike) { p.likes.push(ME.name);    karmaHit(p.author,  1); }
    else       { p.dislikes.push(ME.name); karmaHit(p.author, -1); }
  }

  save(); renderFeed();
  if(curForumId) renderForumPosts(curForumId);
}

function deletePost(id) {
  DB.posts = DB.posts.filter(p=>p.id!==id);
  save(); renderFeed(); 
  if(curForumId) renderForumPosts(curForumId);
  toast('Мыслеформа уничтожена.');
}

function reportPost(id) { toast('⚔ Инквизиция уведомлена. Вопрос рассматривается.'); }

function toggleSub(name) {
  if(name===ME.name) return;
  if(!ME.subs) ME.subs=[];
  const i = ME.subs.indexOf(name);
  if(i>-1){ ME.subs.splice(i,1); toast('Подписка отозвана.'); }
  else { ME.subs.push(name); toast('Подписка оформлена. Их трансляции будут приходить в Эфир.'); }
  updateUser(ME); save(); renderFeed(); renderSidebar();
}

function karmaHit(name, d) {
  const u = DB.users.find(x=>x.name===name);
  if(!u) return;
  u.karma=(u.karma||0)+d; updateUser(u); save();
  if(name===ME.name) { ME.karma=(ME.karma||0)+d; renderSidebar(); }
}

// ===== SIDEBAR =====
function renderSidebar() {
  document.getElementById('sb-karma').textContent = ME.karma||0;
  document.getElementById('sb-online').textContent = DB.users.length;
  const subs = ME.subs||[];
  if(!subs.length){ document.getElementById('sb-subs').innerHTML='<div style="color:var(--textd);font-size:9px;padding:2px 0">Нет подписок</div>'; }
  else { document.getElementById('sb-subs').innerHTML = subs.map(s=>`<div class="sb-row"><a onclick="searchUser('${s}')">${s}</a></div>`).join(''); }
  const mf = ME.forums||[];
  if(!mf.length){ document.getElementById('sb-myforums').innerHTML='<div style="color:var(--textd);font-size:9px;padding:2px 0">Не состоите ни в одном</div>'; }
  else { document.getElementById('sb-myforums').innerHTML = mf.map(fid=>{ const f=DB.forums.find(x=>x.id===fid); return f?`<div class="sb-row"><a onclick="showPage('broadcasts');openForum('${f.id}')">${f.name}</a></div>`:''; }).join(''); }
  // hot posts
  const hot = [...DB.posts].sort((a,b)=>(b.likes||[]).length-(a.likes||[]).length).slice(0,5);
  document.getElementById('sb-hot').innerHTML = hot.length ? hot.map(p=>`<div class="sb-row"><a onclick="">${p.body.substring(0,28)}...</a><span>${(p.likes||[]).length}⟡</span></div>`).join('') : '<div style="color:var(--textd);font-size:9px">Пока пусто</div>';
}

// ===== FORUMS =====
function renderForums() {
  const q = (document.getElementById('forum-search')||{}).value||'';
  const list = DB.forums.filter(f=>!q||f.name.toLowerCase().includes(q.toLowerCase())||f.desc.toLowerCase().includes(q.toLowerCase()));
  const el = document.getElementById('forums-list');
  if(!list.length){ el.innerHTML='<div class="empty-state">Форумов не найдено. Создайте первый.</div>'; return; }
  el.innerHTML = list.map(f=>{
    const postCount = (DB.forumPosts[f.id]||[]).length + DB.posts.filter(p=>p.forumId===f.id).length;
    const joined = (ME.forums||[]).includes(f.id);
    return `<div class="forum-card" onclick="openForum('${f.id}')">
      <div class="forum-name">${f.name}</div>
      <div class="forum-desc">${f.desc||'Без описания'}</div>
      <div class="forum-meta">
        <span>📝 ${postCount}</span>
        <span>👥 ${f.members||0}</span>
        <span>Создан: ${timeAgo(f.ts)}</span>
        ${joined?'<span style="color:var(--resonc)">✓ вы состоите</span>':''}
      </div>
    </div>`;
  }).join('');
}

function openForum(id) {
  curForumId=id;
  const f=DB.forums.find(x=>x.id===id);
  if(!f) return;
  document.getElementById('forum-view').style.display='';
  document.getElementById('fv-title').textContent='📡 '+f.name;
  document.getElementById('fv-desc').textContent=f.desc||'';
  const joined=(ME.forums||[]).includes(id);
  const btn=document.getElementById('fv-join-btn');
  btn.textContent=joined?'Покинуть форум':'Вступить';
  btn.className='btn sm'+(joined?' danger':'');
  document.getElementById('fv-compose').style.display=joined?'':'none';
  renderForumPosts(id);
  showPage('broadcasts');
}

function closeForum() { document.getElementById('forum-view').style.display='none'; curForumId=null; }

function toggleJoinForum() {
  if(!curForumId) return;
  if(!ME.forums) ME.forums=[];
  const f=DB.forums.find(x=>x.id===curForumId);
  const i=ME.forums.indexOf(curForumId);
  if(i>-1){ ME.forums.splice(i,1); if(f) f.members=Math.max(0,(f.members||1)-1); toast('Вы покинули форум.'); }
  else { ME.forums.push(curForumId); if(f) f.members=(f.members||0)+1; toast('Вы вступили в форум.'); }
  updateUser(ME); save(); openForum(curForumId); renderMyForumsList(); renderSidebar(); updateForumSelect();
}

function renderForumPosts(id) {
  const el=document.getElementById('fv-posts');
  const allPosts=[...DB.posts.filter(p=>p.forumId===id)].reverse();
  if(!allPosts.length){ el.innerHTML='<div class="empty-state">Форум пуст.</div>'; return; }
  el.innerHTML=allPosts.map(p=>renderPost(p, 'forum')).join(''); // <-- ВОТ ТУТ ИЗМЕНЕНИЕ
}

function submitForumPost() {
  const txt=document.getElementById('fv-text').value.trim();
  if(!txt||!curForumId) return;
  const p={id:uid(),author:ME.name,body:txt,ts:Date.now(),likes:[],dislikes:[],forumId:curForumId,pinned:false};
  DB.posts.push(p); ME.postCount=(ME.postCount||0)+1; updateUser(ME); save();
  document.getElementById('fv-text').value='';
  renderForumPosts(curForumId); renderFeed(); toast('Мыслеформа записана в форум.');
}

function renderMyForumsList() {
  const mf=ME.forums||[];
  const el=document.getElementById('my-forums-list');
  if(!mf.length){ el.innerHTML='<div style="color:var(--textd);font-size:9px">Вы не состоите ни в одном форуме</div>'; return; }
  el.innerHTML=mf.map(fid=>{const f=DB.forums.find(x=>x.id===fid);return f?`<div class="sb-row"><a onclick="openForum('${f.id}')">${f.name}</a></div>`:''}).join('');
}

function openCreateForum() { document.getElementById('modal-create-forum').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function createForum() {
  const name=document.getElementById('cf-name').value.trim();
  const desc=document.getElementById('cf-desc').value.trim();
  if(!name){ toast('Введите название форума.'); return; }
  const f={id:uid(),name,desc,creator:ME.name,members:1,ts:Date.now()};
  DB.forums.push(f); if(!ME.forums)ME.forums=[]; ME.forums.push(f.id);
  updateUser(ME); save(); closeModal('modal-create-forum');
  document.getElementById('cf-name').value=''; document.getElementById('cf-desc').value='';
  renderForums(); renderMyForumsList(); renderSidebar(); updateForumSelect();
  toast('Форум создан. Вы первый участник.');
  openForum(f.id);
}

function getForumName(id) { const f=DB.forums.find(x=>x.id===id); return f?f.name:'Форум'; }

function updateForumSelect() {
  const sel=document.getElementById('post-forum-sel');
  const mf=ME.forums||[];
  const forums=mf.map(fid=>{const f=DB.forums.find(x=>x.id===fid);return f?`<option value="${f.id}">${f.name}</option>`:''}).join('');
  sel.innerHTML='<option value="">— Личная трансляция —</option>'+forums;
}

// ===== CHATS =====
function renderDialogs() {
  const el=document.getElementById('dialogs-list');
  const keys=Object.keys(DB.messages).filter(k=>k.includes(ME.name));
  if(!keys.length){ el.innerHTML='<div style="color:var(--textd);font-size:9px;padding:6px 8px">Нет диалогов</div>'; return; }
  el.innerHTML=keys.map(k=>{
    const parts=k.split(':'); const partner=parts.find(x=>x!==ME.name);
    const msgs=DB.messages[k];
    const last=msgs[msgs.length-1];
    return `<div class="chat-item${curChatPartner===partner?' active':''}" onclick="openChat('${partner}')">
      <div class="comment-avatar" style="font-size:13px">${(DB.users.find(u=>u.name===partner)||{avatar:'?'}).avatar||'?'}</div>
      <div style="flex:1;min-width:0"><div class="chat-name">${partner}</div>
      <div class="chat-preview">${last?last.body:'...'}</div></div>
    </div>`;
  }).join('');
}

function searchChatUser() {
  const q=document.getElementById('chat-search').value.trim();
  const el=document.getElementById('chat-user-results');
  if(!q){ el.innerHTML=''; return; }
  const results=DB.users.filter(u=>u.name!==ME.name&&u.name.toLowerCase().includes(q.toLowerCase()));
  if(!results.length){ el.innerHTML='<div style="color:var(--textd);font-size:9px;padding:4px 8px">Не найдено</div>'; return; }
  el.innerHTML=results.map(u=>`<div class="chat-item" onclick="openChat('${u.name}');document.getElementById('chat-search').value='';document.getElementById('chat-user-results').innerHTML=''">
    <div class="comment-avatar" style="font-size:13px">${u.avatar||'?'}</div>
    <div><div class="chat-name">${u.name}</div></div>
  </div>`).join('');
}

function startChat(name) {
  if(name===ME.name) return;
  showPage('chats'); openChat(name);
}

function openChat(partner) {
  curChatPartner=partner;
  document.getElementById('chat-empty').style.display='none';
  document.getElementById('chat-active').style.display='block';
  document.getElementById('chat-partner-name').textContent='✉ '+partner;
  renderMessages(); renderDialogs();
}

function closeChat() {
  curChatPartner=null;
  document.getElementById('chat-empty').style.display='block';
  document.getElementById('chat-active').style.display='none';
}

function msgKey(a,b) { return [a,b].sort().join(':'); }

function renderMessages() {
  const el=document.getElementById('messages-area');
  const key=msgKey(ME.name,curChatPartner);
  const msgs=DB.messages[key]||[];
  el.innerHTML=msgs.map(m=>`<div class="msg ${m.from===ME.name?'mine':'theirs'}">
    <div class="msg-author">${m.from} · ${timeAgo(m.ts)}</div>${m.body}
  </div>`).join('');
  el.scrollTop=el.scrollHeight;
}

function sendMsg() {
  const inp=document.getElementById('msg-input');
  const body=inp.value.trim();
  if(!body||!curChatPartner) return;
  const key=msgKey(ME.name,curChatPartner);
  if(!DB.messages[key]) DB.messages[key]=[];
  DB.messages[key].push({id:uid(),from:ME.name,body,ts:Date.now()});
  save(); inp.value=''; renderMessages(); renderDialogs();
}

// ===== PROFILE =====
function renderColorPickers() {
  const sc=document.getElementById('spark-color-picker');
  sc.innerHTML=SPARK_COLORS.map(c=>`<div class="color-opt${ME.sparkColor===c.val?' selected':''}"
    style="background:${c.bg};border-color:${ME.sparkColor===c.val?'#fff':c.val};box-shadow:${ME.sparkColor===c.val?'0 0 8px '+c.val:'none'}"
    title="${c.name}" onclick="pickSparkColor('${c.val}',this)">
    <div style="width:12px;height:12px;border-radius:50%;background:${c.val};box-shadow:0 0 6px ${c.val}"></div>
  </div>`).join('');

  const sel=document.getElementById('sel-color-picker');
  sel.innerHTML=SEL_COLORS.map(c=>`<div class="color-opt${ME.selBg===c.bg?' selected':''}"
    style="background:${c.bg};border-color:${ME.selBg===c.bg?'#fff':c.fg}"
    title="${c.name}" onclick="pickSelColor('${c.bg}','${c.fg}',this)">
    <div style="font-size:9px;color:${c.fg};padding:2px;text-shadow:0 0 4px ${c.fg}">Аб</div>
  </div>`).join('');
}

function pickSparkColor(val, el) {
  document.querySelectorAll('#spark-color-picker .color-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected'); ME.sparkColor=val; setSparkColor(val);
}
function pickSelColor(bg,fg,el) {
  document.querySelectorAll('#sel-color-picker .color-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected'); ME.selBg=bg; ME.selFg=fg; setSelColor(bg,fg);
}

function renderProfilePage() {
  document.getElementById('prof-name').value=ME.name;
  document.querySelectorAll('#prof-avs .avatar-opt').forEach(e=>{ e.classList.toggle('selected',e.dataset.av===ME.avatar); });
  document.getElementById('pst-karma').textContent=ME.karma||0;
  document.getElementById('pst-posts').textContent=ME.postCount||0;
  document.getElementById('pst-comments').textContent=ME.commentCount||0;
  document.getElementById('pst-forums').textContent=(ME.forums||[]).length;
  renderColorPickers();
}

let profAvSelected = null;
function selectProfAv(el) {
  document.querySelectorAll('#prof-avs .avatar-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected'); profAvSelected=el.dataset.av;
}

function saveProfile() {
  const newName=document.getElementById('prof-name').value.trim();
  if(newName&&newName!==ME.name){
    if(DB.users.find(u=>u.name===newName&&u!==ME)){ toast('⚠ Этот позывной занят.'); return; }
    ME.name=newName; document.getElementById('nav-uname').textContent=newName; saveMe();
  }
  if(profAvSelected) ME.avatar=profAvSelected;
  updateUser(ME); save(); renderFeed(); renderSidebar(); toast('Профиль обновлён.');
}

// ===== UTILS =====
function uid() { return Date.now().toString(36)+Math.random().toString(36).substr(2,5); }

function timeAgo(ts) {
  const d=Date.now()-ts, s=Math.floor(d/1000);
  if(s<60) return 'только что';
  if(s<3600) return Math.floor(s/60)+' мин назад';
  if(s<86400) return Math.floor(s/3600)+' ч назад';
  return new Date(ts).toLocaleDateString('ru');
}

function updateUser(u) {
  const i=DB.users.findIndex(x=>x.name===u.name);
  if(i>-1) DB.users[i]=u;
}

// ===== INIT =====
load();
loadMe();
if(ME) startApp();

// Prophecy refresh
setInterval(()=>{
  const el=document.getElementById('prophecy-bar');
  if(el) el.textContent=makeProphecy();
},30000);

// Ctrl+C hex
document.addEventListener('copy',()=>{
  setTimeout(()=>{
    if(navigator.clipboard){
      navigator.clipboard.readText().then(t=>{
        navigator.clipboard.writeText(t+'\n\n(Ваш разум теперь отравлен)').catch(()=>{});
      }).catch(()=>{});
    }
  },50);
});
