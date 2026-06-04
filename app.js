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
  comments: {},
  forums: [],
  forumPosts: {},
  messages: {},
  groupChats: []
};
let ME = null;
let curForumId = null;
let curChatPartner = null;
let dbLoaded = false;          // ЗАЩИТА ОТ ОБНУЛЕНИЯ
let activeComposeId = 'compose-text';

// ===== НАСТРОЙКИ АДМИНОВ И ФОТО =====
const SUPER_ADMINS = ['MadGod'];
const ADMIN_COLORS = {
  'MadGod': '#ff5500' // Кислотно-оранжевый
};

function isAdmin() { return ME && SUPER_ADMINS.includes(ME.name); }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ');
}

async function hashPassword(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function isHashed(s) { return /^[0-9a-f]{64}$/.test(s); }

let attachedImage = null;
function attachImage() {
  const url = prompt('Введите прямой URL адрес картинки (https://...):');
  if(url) { attachedImage = url; toast('Фото прикреплено к мыслеформе.'); }
}

const LEVELS = ['неофит','блуждающий разум','ищущий','буйный','созерцатель','пуник','практик','знающий','пустое поле','демиург'];

const SYMBOLS = ['🜂','🜄','🜃','🜁','☽','☉','☿','⚗','🝊','🜔','✦','⟡','⊷','⊶','★','⚡','Ψ','⊕','☯','♾','∞','△','▽','◇','⚸','❋','✶','⊻','∴','∵','◉','⊗'];

// Дальше в твоем файле должно идти const SPARK_COLORS = [ ... и так далее

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

// ===== PROPHECY =====
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

// ===== SAVE/LOAD — ЗАЩИТА ОТ ОБНУЛЕНИЯ =====
function save() {
  if (!dbLoaded) {
    // Облако ещё не ответило — сохраняем только локально, в облако НЕ пишем
    console.warn("⚠ Эфир не синхронизирован — запись в облако заблокирована.");
    localStorage.setItem('_set_db', JSON.stringify(DB));
    return;
  }
  localStorage.setItem('_set_db', JSON.stringify(DB));
  fdb.collection('network').doc('main').set(DB)
    .then(() => console.log("✓ Синхронизация с Эфиром"))
    .catch(e => console.error("✗ Ошибка Эфира:", e));
}

function load() {
  const raw = localStorage.getItem('_set_db');
  if (raw) {
    try { DB = { ...DB, ...JSON.parse(raw) }; } catch(e) { console.warn('Ошибка кэша LocalStorage'); }
  }

  fdb.collection('network').doc('main').onSnapshot(doc => {
    dbLoaded = true; // Только после первого ответа облака разрешаем запись
    if (doc.exists) {
      const cloudData = doc.data();
      // Мёржим: облако побеждает, но сохраняем структуру
      DB = { ...DB, ...cloudData };
      if (ME) {
        ME = DB.users.find(u => u.name === ME.name) || ME;
        renderFeed();
        renderSidebar();
        renderForums();
        renderDialogs();
        if (curForumId) renderForumPosts(curForumId);
        if (curChatPartner) renderMessages();
        // if (document.getElementById('page-world') && document.getElementById('page-world').classList.contains('active')) drawWorld();
      }
    }
    // Если документа нет (свежая база) — dbLoaded=true, разрешаем запись
  }, err => {
    console.error("Ошибка подписки на Эфир:", err);
    dbLoaded = true; // Разрешаем хотя бы локальную работу
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
  // clearTimeout(idleT);
  // veil.style.background='rgba(0,0,0,0)';
  // idleT=setTimeout(()=>{ veil.style.background='rgba(0,0,0,0.65)'; },180000);
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

async function doLogin() {
  const name = document.getElementById('l-name').value.trim();
  const pass = document.getElementById('l-pass').value;
  const errEl = document.getElementById('l-err');
  const u = DB.users.find(u=>u.name===name);
  if (!u) { errEl.style.display='block'; return; }
  let ok = false;
  if (isHashed(u.pass)) {
    const h = await hashPassword(pass);
    ok = (h === u.pass);
  } else {
    ok = (u.pass === pass);
    if (ok) { u.pass = await hashPassword(pass); updateUser(u); save(); }
  }
  if (!ok) { errEl.style.display='block'; return; }
  ME = u; saveMe(); startApp();
}

async function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const pass = document.getElementById('r-pass').value;
  const err = document.getElementById('r-err');
  if (!name || name.length < 2) { err.textContent='⚠ Позывной слишком короткий'; err.style.display='block'; return; }
  if (pass.length < 4) { err.textContent='⚠ Пароль слишком слабый'; err.style.display='block'; return; }
  if (DB.users.find(u=>u.name===name)) { err.textContent='⚠ Этот позывной уже занят'; err.style.display='block'; return; }
  const hashedPass = await hashPassword(pass);
  const u = {
    name, pass: hashedPass, avatar:regAv, karma:0, sparkColor:'#ff6600', selBg:'#3a0000', selFg:'#ff4400',
    subs:[], forums:[], postCount:0, commentCount:0, joined:Date.now(),
    surname:'', status:'', level:'неофит'
  };
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
  
  if (isAdmin()) {
    document.getElementById('btn-attach-img').style.display = 'inline-block';
    document.getElementById('extranet-panel').style.display = 'block';
    document.getElementById('admin-html-insert').style.display = 'inline-block';
  }
  setupMentionAutocomplete('compose-text');

  document.getElementById('prophecy-bar').textContent = makeProphecy();
  setSparkColor(ME.sparkColor||'#ff6600');
  setSelColor(ME.selBg||'#3a0000', ME.selFg||'#ff4400');
  if(ME.theme) document.body.className = ME.theme;
  
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
  const map = {ether:0, subs:1, broadcasts:2, chats:3, mypage:4, profile:5, minigames:6, /*world:7*/};
  if(map[p]!==undefined) tabs[map[p]].classList.add('active');
  if(p==='chats') { renderDialogs(); renderGroupChats(); renderAllGroups(); }
  if(p==='profile') renderProfilePage();
  if(p==='broadcasts') renderForums();
  if(p==='mypage') renderMyPage(ME);
  if(p==='minigames') renderMinigames();
  if(p==='subs') renderSubsFeed();
  // if(p==='world') renderWorld();
  // else stopWorldAnim();
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
  el.innerHTML = feed.map(p=>renderPost(p, 'feed')).join('');
  document.getElementById('feed-count').textContent = feed.length+' трансляций';
  document.getElementById('sb-online').textContent = DB.users.length;
  document.getElementById('online-count').innerHTML = '<span class="online-dot"></span> '+DB.users.length+' в сети';
}

function renderPost(p, ctx = 'feed') {
  const author = DB.users.find(u=>u.name===p.author)||{name:p.author,avatar:'?',karma:0};
  const myRes = p.likes&&p.likes.includes(ME.name);
  const myCurse = p.dislikes&&p.dislikes.includes(ME.name);
  const myMental = p.mentalDmg&&p.mentalDmg.includes(ME.name);
  const cmtCount = (DB.comments[p.id]||[]).length;
  const ring = karmaRing(author.karma||0);
  const forumRef = p.forumId ? `<div class="post-forum-ref">📡 <a onclick="openForum('${p.forumId}')">${getForumName(p.forumId)}</a></div>` : '';
  const rawBody = SUPER_ADMINS.includes(p.author) ? p.body : escapeHtml(p.body);
  const body = renderMentions(rawBody).replace(/\[spoiler\](.*?)\[\/spoiler\]/g,'<span class="spoiler" onclick="this.classList.toggle(\'open\')">$1</span>');
  const cmtSection = renderComments(p.id, ctx);
  const canDelete = p.author === ME.name || isAdmin();
  const reportCount = (p.reports||[]).length;
  const lvl = author.level && author.level !== 'неофит' ? `<span class="level-badge">${author.level}</span>` : '';

  // === ЛОГИКА АУР И СТАТУСОВ ===
  let postClass = 'post';
  let customStyle = '';
  let specialTag = '';

  if (p.isExtranet) {
    postClass += ' extranet-post';
    specialTag = `<span class="post-tag extranet-tag">ЭКСТРАНЕТ</span>`;
  } else if (SUPER_ADMINS.includes(p.author)) {
    postClass += ' admin-aura';
    const auraColor = ADMIN_COLORS[p.author] || 'var(--adminc)';
    customStyle = `style="--aura: ${auraColor};"`;
    specialTag = `<span class="post-tag admin" style="color:${auraColor}; border-color:${auraColor}">${p.author === 'MadGod' ? 'БЕЗУМНЫЙ БОГ' : 'АДМИН'}</span>`;
  } else if (p.pinned) {
    postClass += ' admin';
    specialTag = `<span class="post-tag admin">ЗАКРЕПЛЕНО</span>`;
  }
// === ВОТ ЭТОТ БЛОК НУЖНО ВСТАВИТЬ СРАЗУ ПОСЛЕ renderPost ===
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
    const myRes = (c.resonance||[]).includes(ME.name);
    const myCurse = (c.curses||[]).includes(ME.name);
    const myMental = (c.mentalDmg||[]).includes(ME.name);
    return `<div class="comment">
      <div class="comment-avatar">${au.avatar||'?'}</div>
      <div style="flex:1">
        <div class="comment-meta"><span class="comment-author" onclick="openUserPage('${c.author}')">${c.author}</span> · ${timeAgo(c.ts)}</div>
        <div class="comment-body" style="word-break:break-word;">${escapeHtml(c.body)}</div>
        <div class="cmt-actions">
          <button class="act sm${myRes?' liked':''}" onclick="reactComment('${postId}','${c.id}','resonance')" title="Резонанс">⟡ ${(c.resonance||[]).length}</button>
          <button class="act sm${myCurse?' disliked':''}" onclick="reactComment('${postId}','${c.id}','curse')" title="Проклятие">☠ ${(c.curses||[]).length}</button>
          <button class="act sm${myMental?' mentald':''}" onclick="reactComment('${postId}','${c.id}','mental')" title="Ментальный урон">Ψ ${(c.mentalDmg||[]).length}</button>
          ${canDelCmt ? `<button class="act danger sm" onclick="deleteComment('${postId}', '${c.id}')">✕</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  return list+forms;
}

// Обновляем все открытые секции комментов к посту
function updateCommentUI(postId) {
  ['feed','forum','profile','modal'].forEach(ctx => {
    const el = document.getElementById(`cmts-${ctx}-${postId}`);
    if(el) el.innerHTML = renderComments(postId, ctx);
  });
}

function reactComment(postId, cmtId, type) {
  const cmts = DB.comments[postId];
  if(!cmts) return;
  const c = cmts.find(x => x.id === cmtId);
  if(!c) return;
  const field = type === 'resonance' ? 'resonance' : type === 'curse' ? 'curses' : 'mentalDmg';
  if(!c[field]) c[field] = [];
  const idx = c[field].indexOf(ME.name);
  if(idx > -1) {
    c[field].splice(idx, 1);
    if(type === 'resonance') karmaHit(c.author, -1);
    if(type === 'curse')     karmaHit(c.author,  1);
  } else {
    c[field].push(ME.name);
    if(type === 'resonance') karmaHit(c.author,  1);
    if(type === 'curse')     karmaHit(c.author, -1);
  }
  save();
  updateCommentUI(postId);
}

function toggleComments(id, ctx) {
  const el = document.getElementById(`cmts-${ctx}-${id}`);
  el.classList.toggle('open');
  if(el.classList.contains('open')) el.innerHTML = renderComments(id, ctx);
}

function submitComment(postId, ctx) {
  const inp = document.getElementById(`ci-${ctx}-${postId}`);
  const body = inp.value.trim();
  if(!body) return;
  if(!DB.comments[postId]) DB.comments[postId]=[];
  DB.comments[postId].push({id:uid(),author:ME.name,body,ts:Date.now(),resonance:[],curses:[],mentalDmg:[]});
  ME.commentCount = (ME.commentCount||0)+1;
  updateUser(ME); save();
  updateCommentUI(postId);
}

function deleteComment(postId, cmtId) {
  if(!DB.comments[postId]) return;
  DB.comments[postId] = DB.comments[postId].filter(c => c.id !== cmtId);
  save(); toast('Комментарий стёрт.');
  updateCommentUI(postId);
}
// === КОНЕЦ БЛОКА ===
  // === ЛОГИКА ФОТО ===
  const imgHtml = p.image ? `<div class="post-image-wrap"><img src="${p.image}" class="post-attached-img" onclick="window.open('${p.image}','_blank')"></div>` : '';

  return `<div class="${postClass}" id="post-${ctx}-${p.id}" ${customStyle}>
    <div class="post-hdr">
      <div class="avatar">${author.avatar||'?'}<div class="karma-ring ${ring}"></div></div>
      <div class="post-meta">
        <span class="post-author${SUPER_ADMINS.includes(p.author)?' admin-name':''}" onclick="openUserPage('${p.author}')">${p.author}</span>${specialTag}${lvl}
        <button class="btn sm" style="margin-left:4px;font-size:8px" onclick="startChat('${p.author}')">✉</button>
        ${p.author!==ME.name?`<button class="btn sm" style="font-size:8px;margin-left:2px" onclick="toggleSub('${p.author}')">${(ME.subs||[]).includes(p.author)?'−подписка':'+ подписка'}</button>`:''}
        <br><span class="post-time">${timeAgo(p.ts)}</span>
      </div>
    </div>
    ${forumRef}
    <div class="post-body">${body}${imgHtml}</div>
    <div class="post-actions">
      <button class="act${myRes?' liked':''}" onclick="reactPost('${p.id}','resonance')" title="Резонанс">⟡ ${(p.likes||[]).length}</button>
      <button class="act${myCurse?' disliked':''}" onclick="reactPost('${p.id}','curse')" title="Проклятие">☠ ${(p.dislikes||[]).length}</button>
      <button class="act${myMental?' mentald':''}" onclick="reactPost('${p.id}','mental')" title="Ментальный урон">Ψ ${(p.mentalDmg||[]).length}</button>
      <button class="act" onclick="toggleComments('${p.id}', '${ctx}')">↩ ${cmtCount}</button>
      ${canDelete ? `<button class="act danger" onclick="deletePost('${p.id}')">✕</button>` : ''}
      <button class="act${reportCount>0?' reported':''}" onclick="reportPost('${p.id}')" title="Жалоба в Инквизицию">⚔${reportCount>0?' '+reportCount:''}</button>
    </div>
    <div class="comments-section" id="cmts-${ctx}-${p.id}">${cmtSection}</div>
  </div>`;
}
// Обновляем все открытые секции комментов к посту
function updateCommentUI(postId) {
  ['feed','forum','profile','modal'].forEach(ctx => {
    const el = document.getElementById(`cmts-${ctx}-${postId}`);
    if(el) el.innerHTML = renderComments(postId, ctx);
  });
}

function reactComment(postId, cmtId, type) {
  const cmts = DB.comments[postId];
  if(!cmts) return;
  const c = cmts.find(x => x.id === cmtId);
  if(!c) return;
  const field = type === 'resonance' ? 'resonance' : type === 'curse' ? 'curses' : 'mentalDmg';
  if(!c[field]) c[field] = [];
  const idx = c[field].indexOf(ME.name);
  if(idx > -1) {
    c[field].splice(idx, 1);
    if(type === 'resonance') karmaHit(c.author, -1);
    if(type === 'curse')     karmaHit(c.author,  1);
  } else {
    c[field].push(ME.name);
    if(type === 'resonance') karmaHit(c.author,  1);
    if(type === 'curse')     karmaHit(c.author, -1);
  }
  save();
  updateCommentUI(postId);
}

function toggleComments(id, ctx) {
  const el = document.getElementById(`cmts-${ctx}-${id}`);
  el.classList.toggle('open');
  if(el.classList.contains('open')) el.innerHTML = renderComments(id, ctx);
}

function submitComment(postId, ctx) {
  const inp = document.getElementById(`ci-${ctx}-${postId}`);
  const body = inp.value.trim();
  if(!body) return;
  if(!DB.comments[postId]) DB.comments[postId]=[];
  DB.comments[postId].push({id:uid(),author:ME.name,body,ts:Date.now(),resonance:[],curses:[],mentalDmg:[]});
  ME.commentCount = (ME.commentCount||0)+1;
  updateUser(ME); save();
  updateCommentUI(postId);
}

function deleteComment(postId, cmtId) {
  if(!DB.comments[postId]) return;
  DB.comments[postId] = DB.comments[postId].filter(c => c.id !== cmtId);
  save(); toast('Комментарий стёрт.');
  updateCommentUI(postId);
}

// ===== POSTS =====
function submitPost() {
  const txt = document.getElementById('compose-text').value.trim();
  if(!txt && !attachedImage) { toast('Пустая мыслеформа не транслируется.'); return; }
  const forumId = document.getElementById('post-forum-sel').value || null;
  
  // ВОТ ТУТ МЫ ДОБАВИЛИ image: attachedImage
  const p = { id:uid(), author:ME.name, body:txt, ts:Date.now(), likes:[], dislikes:[], mentalDmg:[], reports:[], forumId, pinned:false, image: attachedImage };
  
  // ОБНУЛЯЕМ картинку, чтобы не прикрепилась к следующему посту
  attachedImage = null; 

  DB.posts.push(p);
  ME.postCount = (ME.postCount||0)+1;
  updateUser(ME); save();
  document.getElementById('compose-text').value='';
  document.getElementById('compose-len').textContent='0';
  const sp = document.getElementById('symbol-picker-main');
  if(sp) sp.style.display='none';
  renderFeed(); renderSidebar();
  if(forumId) renderForumPosts(forumId);
  toast('Трансляция принята. Эфир обновлён.');
}

// НОВАЯ ФУНКЦИЯ ДЛЯ ЭКСТРАНЕТА (Вставлять прямо под submitPost)
function submitExtranetPost() {
  if (!isAdmin()) { toast('У вас нет доступа к Экстранету.'); return; }
  const author = document.getElementById('ex-author').value.trim() || 'НЕИЗВЕСТНО';
  const txt = document.getElementById('ex-text').value.trim();
  if(!txt) return;
  
  const p = { id:uid(), author:author, body:txt, ts:Date.now(), likes:[], dislikes:[], mentalDmg:[], reports:[], forumId:null, pinned:false, isExtranet:true };
  DB.posts.push(p);
  save();
  document.getElementById('ex-author').value='';
  document.getElementById('ex-text').value='';
  renderFeed();
  toast('Сущность внедрена в Эфир.');
}

// ===== SYMBOL PICKER =====
function toggleSymbolPicker(ctx) {
  const el = document.getElementById('symbol-picker-' + ctx);
  if(!el) return;
  // Строим содержимое при первом открытии
  if(!el.dataset.built) {
    el.innerHTML = SYMBOLS.map(s=>`<span class="sym-btn" onclick="insertSymbol('${s}','${ctx}')">${s}</span>`).join('');
    el.dataset.built = '1';
  }
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function insertSymbol(sym, ctx) {
  // Определяем целевой textarea
  const targetId = (ctx === 'forum') ? 'fv-text' : 'compose-text';
  const ta = document.getElementById(activeComposeId) || document.getElementById(targetId);
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.substring(0, start) + sym + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + sym.length;
  ta.focus();
  if(ta.id === 'compose-text') {
    document.getElementById('compose-len').textContent = ta.value.length;
  }
}

// ===== REACT POST (Резонанс / Проклятие / Ментальный урон) =====
function reactPost(id, type) {
  const p = DB.posts.find(x=>x.id===id);
  if(!p) return;
  if(!p.likes) p.likes=[]; if(!p.dislikes) p.dislikes=[]; if(!p.mentalDmg) p.mentalDmg=[];

  if(type === 'resonance') {
    const had = p.likes.includes(ME.name);
    const hadD = p.dislikes.includes(ME.name);
    p.likes = p.likes.filter(n=>n!==ME.name);
    p.dislikes = p.dislikes.filter(n=>n!==ME.name);
    if(hadD) karmaHit(p.author, 1);
    if(!had) { p.likes.push(ME.name); karmaHit(p.author, 1); }
    else { karmaHit(p.author, -1); }
  } else if(type === 'curse') {
    const hadL = p.likes.includes(ME.name);
    const had = p.dislikes.includes(ME.name);
    p.likes = p.likes.filter(n=>n!==ME.name);
    p.dislikes = p.dislikes.filter(n=>n!==ME.name);
    if(hadL) karmaHit(p.author, -1);
    if(!had) { p.dislikes.push(ME.name); karmaHit(p.author, -1); }
    else { karmaHit(p.author, 1); }
  } else if(type === 'mental') {
    const idx = p.mentalDmg.indexOf(ME.name);
    if(idx > -1) p.mentalDmg.splice(idx, 1);
    else p.mentalDmg.push(ME.name);
  }

  save(); renderFeed();
  if(curForumId) renderForumPosts(curForumId);
}

function deletePost(id) {
  DB.posts = DB.posts.filter(p=>p.id!==id);
  delete DB.comments[id];
  save(); renderFeed();
  if(curForumId) renderForumPosts(curForumId);
  toast('Мыслеформа уничтожена.');
}

function reportPost(id) {
  const p = DB.posts.find(x=>x.id===id);
  if(!p) return;
  if(!p.reports) p.reports=[];
  if(p.reports.includes(ME.name)) { toast('⚔ Жалоба уже подана. Инквизиция работает.'); return; }
  p.reports.push(ME.name);
  save(); renderFeed();
  if(curForumId) renderForumPosts(curForumId);
  toast('⚔ Инквизиция уведомлена. Жалоба принята.');
}

function toggleSub(name) {
  if(name===ME.name) return;
  if(!ME.subs) ME.subs=[];
  const i = ME.subs.indexOf(name);
  if(i>-1){ ME.subs.splice(i,1); toast('Подписка отозвана.'); }
  else { ME.subs.push(name); toast('Подписка оформлена.'); }
  updateUser(ME); save(); renderFeed(); renderSidebar();
}

function karmaHit(name, d) {
  const u = DB.users.find(x=>x.name===name);
  if(!u) return;
  u.karma=(u.karma||0)+d; updateUser(u);
  if(name===ME.name) ME.karma=(ME.karma||0)+d;
}

// ===== SIDEBAR =====
function renderSidebar() {
  document.getElementById('sb-karma').textContent = ME.karma||0;
  document.getElementById('sb-online').textContent = DB.users.length;
  const subs = ME.subs||[];
  if(!subs.length){ document.getElementById('sb-subs').innerHTML='<div style="color:var(--textd);font-size:9px;padding:2px 0">Нет подписок</div>'; }
  else { document.getElementById('sb-subs').innerHTML = subs.map(s=>`<div class="sb-row"><a onclick="openUserPage('${s}')">${s}</a></div>`).join(''); }
  const mf = ME.forums||[];
  if(!mf.length){ document.getElementById('sb-myforums').innerHTML='<div style="color:var(--textd);font-size:9px;padding:2px 0">Не состоите ни в одном</div>'; }
  else { document.getElementById('sb-myforums').innerHTML = mf.map(fid=>{ const f=DB.forums.find(x=>x.id===fid); return f?`<div class="sb-row"><a onclick="showPage('broadcasts');openForum('${f.id}')">${f.name}</a></div>`:''; }).join(''); }
  const hot = [...DB.posts].sort((a,b)=>(b.likes||[]).length-(a.likes||[]).length).slice(0,5);
  document.getElementById('sb-hot').innerHTML = hot.length ? hot.map(p=>`<div class="sb-row"><a>${escapeHtml(stripHtml(p.body)).substring(0,28)}...</a><span>${(p.likes||[]).length}⟡</span></div>`).join('') : '<div style="color:var(--textd);font-size:9px">Пока пусто</div>';
  renderLeaderboard();
}

// ===== FORUMS =====
function renderForums() {
  const q = (document.getElementById('forum-search')||{}).value||'';
  const list = DB.forums.filter(f=>!q||f.name.toLowerCase().includes(q.toLowerCase())||(f.desc||'').toLowerCase().includes(q.toLowerCase()));
  const el = document.getElementById('forums-list');
  if(!list.length){ el.innerHTML='<div class="empty-state">Форумов не найдено. Создайте первый.</div>'; return; }
  el.innerHTML = list.map(f=>{
    const postCount = DB.posts.filter(p=>p.forumId===f.id).length;
    const joined = (ME.forums||[]).includes(f.id);
    const canDel = f.creator === ME.name || isAdmin();
    return `<div class="forum-card" onclick="openForum('${f.id}')">
      <div class="forum-name">${f.name}
        ${canDel?`<button class="btn sm danger" style="float:right;font-size:8px;padding:1px 5px" onclick="event.stopPropagation();deleteForum('${f.id}')">✕ удалить</button>`:''}
      </div>
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
  const delBtn=document.getElementById('fv-delete-btn');
  if(delBtn) delBtn.style.display = (f.creator===ME.name||isAdmin()) ? '' : 'none';
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

function deleteForum(id) {
  const f = DB.forums.find(x=>x.id===id);
  if(!f) return;
  if(f.creator !== ME.name && !isAdmin()) { toast('⚠ Недостаточно прав.'); return; }
  if(!confirm('Уничтожить форум «'+f.name+'»?\nВсе записи будут стёрты навсегда.')) return;
  DB.forums = DB.forums.filter(x => x.id !== id);
  DB.posts = DB.posts.filter(p => p.forumId !== id);
  DB.users.forEach(u => { if(u.forums) u.forums = u.forums.filter(fid => fid !== id); });
  ME.forums = (ME.forums||[]).filter(fid => fid !== id);
  updateUser(ME);
  save(); closeForum(); renderForums(); renderMyForumsList(); updateForumSelect(); renderSidebar();
  toast('Форум уничтожен. Пепел остался.');
}

function renderForumPosts(id) {
  const el=document.getElementById('fv-posts');
  const allPosts=[...DB.posts.filter(p=>p.forumId===id)].reverse();
  if(!allPosts.length){ el.innerHTML='<div class="empty-state">Форум пуст.</div>'; return; }
  el.innerHTML=allPosts.map(p=>renderPost(p, 'forum')).join('');
}

function submitForumPost() {
  const txt=document.getElementById('fv-text').value.trim();
  if(!txt||!curForumId) return;
  const p={id:uid(),author:ME.name,body:txt,ts:Date.now(),likes:[],dislikes:[],mentalDmg:[],reports:[],forumId:curForumId,pinned:false};
  DB.posts.push(p); ME.postCount=(ME.postCount||0)+1; updateUser(ME); save();
  document.getElementById('fv-text').value='';
  const sp=document.getElementById('symbol-picker-forum');
  if(sp) sp.style.display='none';
  renderForumPosts(curForumId); renderFeed(); toast('Мыслеформа записана в форум.');
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

function renderMyForumsList() {
  const mf=ME.forums||[];
  const el=document.getElementById('my-forums-list');
  if(!mf.length){ el.innerHTML='<div style="color:var(--textd);font-size:9px">Вы не состоите ни в одном форуме</div>'; return; }
  el.innerHTML=mf.map(fid=>{const f=DB.forums.find(x=>x.id===fid);return f?`<div class="sb-row"><a onclick="openForum('${f.id}')">${f.name}</a></div>`:''}).join('');
}

// ===== CHATS =====
function renderDialogs() {
  const el=document.getElementById('dialogs-list');
  const keys=Object.keys(DB.messages).filter(k=>k.includes(ME.name));
  if(!keys.length){ el.innerHTML='<div style="color:var(--textd);font-size:9px;padding:6px 8px">Нет диалогов</div>'; return; }
  el.innerHTML=keys.map(k=>{
    const parts=k.split(':'); const partner=parts.find(x=>x!==ME.name);
    const msgs=DB.messages[k]; const last=msgs[msgs.length-1];
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

function switchChatTab(tab) {
  document.getElementById('chat-tab-dm').style.display    = tab==='dm'    ? '' : 'none';
  document.getElementById('chat-tab-group').style.display = tab==='group' ? '' : 'none';
  document.getElementById('tab-dm').classList.toggle('active', tab==='dm');
  document.getElementById('tab-group').classList.toggle('active', tab==='group');
  if (tab==='group') { renderGroupChats(); renderAllGroups(); }
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

// ===== MY PAGE / USER PROFILES =====
function getUserStats(userName) {
  const userPosts = DB.posts.filter(p => p.author === userName);
  let resonance=0, curses=0, mentalDmg=0, reports=0;
  userPosts.forEach(p => {
    resonance += (p.likes||[]).length;
    curses    += (p.dislikes||[]).length;
    mentalDmg += (p.mentalDmg||[]).length;
    reports   += (p.reports||[]).length;
  });
  const u = DB.users.find(x => x.name === userName) || {};
  return { resonance, curses, mentalDmg, reports, posts:u.postCount||0, comments:u.commentCount||0, forums:(u.forums||[]).length };
}

function getSubscribers(userName) {
  return DB.users.filter(u => (u.subs||[]).includes(userName));
}

function renderMyPage(user) {
  if(!user) return;
  const u = DB.users.find(x=>x.name===user.name) || user;
  const stats = getUserStats(u.name);
  const subscribers = getSubscribers(u.name);
  const ring = karmaRing(u.karma||0);
  const levelOpts = LEVELS.map(l=>`<option value="${l}"${l===(u.level||'неофит')?'selected':''}>${l}</option>`).join('');

  document.getElementById('mypage-win-title').textContent = '📋 ' + u.name + (u.surname?' '+u.surname:'');

  document.getElementById('mypage-content').innerHTML = `
    <div class="user-card">
      <div class="avatar" style="width:54px;height:54px;font-size:26px;flex-shrink:0">
        ${u.avatar||'?'}<div class="karma-ring ${ring}"></div>
      </div>
      <div class="user-card-info">
        <div class="user-card-name">${u.name}${u.surname?' <span style="color:var(--textd);font-weight:normal">'+u.surname+'</span>':''}</div>
        <div class="level-badge-lg">${u.level||'неофит'}</div>
        ${u.status?`<div class="user-card-status">"${u.status}"</div>`:'<div class="user-card-status" style="opacity:.4">статус не задан</div>'}
        <div style="color:var(--accent);font-size:11px;margin-top:6px">Карма: ${u.karma||0}</div>
      </div>
    </div>
    <div class="profile-section" style="margin-top:12px">
      <div class="profile-section-title">РЕДАКТИРОВАТЬ ПРОЕКЦИЮ</div>
      <div class="field"><label>ПОЗЫВНОЙ</label><input id="mp-name" value="${u.name}"></div>
      <div class="field"><label>ФАМИЛИЯ</label><input id="mp-surname" value="${u.surname||''}" placeholder="Необязательно"></div>
      <div class="field"><label>СТАТУС</label><input id="mp-status" value="${u.status||''}" placeholder="Что у тебя на душе..."></div>
      <div class="field"><label>УРОВЕНЬ</label><select id="mp-level">${levelOpts}</select></div>
      <button class="btn primary" onclick="saveMyPageProfile()">Сохранить проекцию</button>
    </div>
  `;

  document.getElementById('mypage-stats').innerHTML = `
    <div style="line-height:2.2;font-size:10px">
      ⟡ <span style="color:var(--textd)">Резонансов:</span> <span style="color:var(--resonc);font-weight:bold">${stats.resonance}</span><br>
      ☠ <span style="color:var(--textd)">Проклятий:</span> <span style="color:var(--cursec);font-weight:bold">${stats.curses}</span><br>
      Ψ <span style="color:var(--textd)">Ментальных ударов:</span> <span style="color:#9966ff;font-weight:bold">${stats.mentalDmg}</span><br>
      ⚔ <span style="color:var(--textd)">Жалоб инквизиции:</span> <span style="color:var(--adminc);font-weight:bold">${stats.reports}</span><br>
      <hr style="border-color:var(--border);margin:4px 0">
      📝 <span style="color:var(--textd)">Постов:</span> <span style="color:var(--accent2)">${stats.posts}</span><br>
      💬 <span style="color:var(--textd)">Комментариев:</span> <span style="color:var(--accent2)">${stats.comments}</span><br>
      📡 <span style="color:var(--textd)">Форумов:</span> <span style="color:var(--accent2)">${stats.forums}</span>
    </div>
  `;

  const subsHtml = `
    <div class="sb-title" style="margin-bottom:6px">ПОДПИСКИ <span style="color:var(--text);font-weight:normal">${(u.subs||[]).length}</span> · ПОДПИСЧИКИ <span style="color:var(--text);font-weight:normal">${subscribers.length}</span></div>
    ${(u.subs||[]).length ?
      (u.subs||[]).map(s=>`<div class="sb-row"><a onclick="openUserPage('${s}')">${s}</a></div>`).join('') :
      '<div style="color:var(--textd);font-size:9px;padding:2px 0">Нет подписок</div>'
    }
    ${subscribers.length ? `
      <div class="sb-title" style="margin-top:8px;margin-bottom:4px">ПОДПИСЧИКИ</div>
      ${subscribers.slice(0,8).map(sub=>`<div class="sb-row"><a onclick="openUserPage('${sub.name}')">${sub.name}</a></div>`).join('')}
    `:''}
  `;
  document.getElementById('mypage-subs').innerHTML = subsHtml;

  const userPosts = DB.posts.filter(p => p.author === u.name).reverse().slice(0, 20);
  document.getElementById('mypage-posts-list').innerHTML = userPosts.length ?
    userPosts.map(p=>renderPost(p,'profile')).join('') :
    '<div class="empty-state">Нет трансляций.</div>';
}

function saveMyPageProfile() {
  const newName = document.getElementById('mp-name').value.trim();
  const surname = document.getElementById('mp-surname').value.trim();
  const status  = document.getElementById('mp-status').value.trim();
  const level   = document.getElementById('mp-level').value;

  if(newName && newName !== ME.name) {
    if(DB.users.find(u=>u.name===newName&&u!==ME)){ toast('⚠ Этот позывной занят.'); return; }
    ME.name = newName;
    document.getElementById('nav-uname').textContent = newName;
    saveMe();
  }
  ME.surname = surname;
  ME.status  = status;
  ME.level   = level;
  updateUser(ME); save();
  renderMyPage(ME);
  renderFeed(); renderSidebar();
  toast('Проекция обновлена.');
}

function openUserPage(name) {
  if(!name) return;
  if(name === ME.name) { showPage('mypage'); return; }
  const user = DB.users.find(u => u.name === name);
  if(!user) { toast('Пользователь не найден в Эфире.'); return; }

  const stats = getUserStats(name);
  const subscribers = getSubscribers(name);
  const ring = karmaRing(user.karma||0);
  const isSubbed = (ME.subs||[]).includes(name);
  const userPosts = DB.posts.filter(p => p.author === name).reverse().slice(0, 10);

  document.getElementById('modal-user-title').textContent = '👤 ' + user.name + (user.surname ? ' ' + user.surname : '');
  document.getElementById('modal-user-content').innerHTML = `
    <div class="user-card" style="margin-bottom:10px">
      <div class="avatar" style="width:50px;height:50px;font-size:24px;flex-shrink:0">
        ${user.avatar||'?'}<div class="karma-ring ${ring}"></div>
      </div>
      <div class="user-card-info">
        <div class="user-card-name">${user.name}${user.surname?' <span style="font-weight:normal;color:var(--textd)">'+user.surname+'</span>':''}</div>
        <div class="level-badge-lg">${user.level||'неофит'}</div>
        ${user.status?`<div class="user-card-status">"${user.status}"</div>`:''}
        <div style="color:var(--accent);font-size:11px;margin-top:4px">Карма: ${user.karma||0}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button class="btn sm primary" onclick="closeModal('modal-user-page');startChat('${name}')">✉ Написать</button>
      <button class="btn sm" id="modal-sub-btn" onclick="toggleSubModal('${name}')">${isSubbed?'− Отписаться':'+ Подписаться'}</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:10px;padding:8px;background:rgba(0,0,0,.15);border:1px solid var(--border);margin-bottom:10px">
      <div>⟡ Резонансов: <span style="color:var(--resonc)">${stats.resonance}</span></div>
      <div>☠ Проклятий: <span style="color:var(--cursec)">${stats.curses}</span></div>
      <div>Ψ Ментальных: <span style="color:#9966ff">${stats.mentalDmg}</span></div>
      <div>⚔ Жалоб: <span style="color:var(--adminc)">${stats.reports}</span></div>
      <div>📝 Постов: <span style="color:var(--accent2)">${stats.posts}</span></div>
      <div>👥 Подписчиков: <span style="color:var(--accent2)">${subscribers.length}</span></div>
    </div>
    <div class="sb-title" style="margin-bottom:6px">ТРАНСЛЯЦИИ</div>
    <div style="max-height:320px;overflow-y:auto">
      ${userPosts.length ? userPosts.map(p=>renderPost(p,'modal')).join('') : '<div class="empty-state">Нет трансляций.</div>'}
    </div>
  `;
  document.getElementById('modal-user-page').classList.add('open');
}

function toggleSubModal(name) {
  toggleSub(name);
  const btn = document.getElementById('modal-sub-btn');
  if(btn) btn.textContent = (ME.subs||[]).includes(name) ? '− Отписаться' : '+ Подписаться';
}

// ===== PROFILE (ASTRAL BODY) =====
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
  playAstralSound();
}
function pickSelColor(bg,fg,el) {
  document.querySelectorAll('#sel-color-picker .color-opt').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected'); ME.selBg=bg; ME.selFg=fg; setSelColor(bg,fg);
  playAstralSound();
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
  playAstralSound();
}

function saveProfile() {
  const newName=document.getElementById('prof-name').value.trim();
  if(newName&&newName!==ME.name){
    if(DB.users.find(u=>u.name===newName&&u!==ME)){ toast('⚠ Этот позывной занят.'); return; }
    ME.name=newName; document.getElementById('nav-uname').textContent=newName; saveMe();
  }
  if(profAvSelected) ME.avatar=profAvSelected;
  updateUser(ME); save(); renderFeed(); renderSidebar();
  toast('Астральное тело обновлено.');
  playAstralSound();
}

function setTheme(theme) {
  document.body.className = theme;
  if(ME) { ME.theme=theme; saveMe(); updateUser(ME); save(); }
  playAstralSound();
}

// ===== ЗВУКИ АСТРАЛЬНОГО ТЕЛА =====
const _abSounds = [
  new Audio('sounds/astralbody1.wav'),
  new Audio('sounds/astralbody2.wav'),
  new Audio('sounds/astralbody3.wav'),
];
let _abIdx = 0;
function playAstralSound() {
  const s = _abSounds[_abIdx % _abSounds.length];
  _abIdx++;
  s.currentTime = 0;
  s.play().catch(()=>{});
}

// ===== ТАРО (78 КАРТ) =====
const TAROT_CARDS = [
  // СТАРШИЕ АРКАНЫ
  {id:'0',  suit:'major', name:'Шут',             sym:'◌', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Начало пути, потенциал, безрассудная смелость. Прыжок в неизвестность без страха.',
   rx:'Безрассудство без основания. Наивность, ведущая к провалу.'},
  {id:'I',  suit:'major', name:'Маг',              sym:'☿', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Воля и мастерство. Все инструменты в руках — действуй прямо сейчас.',
   rx:'Обман, манипуляция. Сила используется против тебя или тобой во вред.'},
  {id:'II', suit:'major', name:'Верховная Жрица',  sym:'☽', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Тайное знание, интуиция, скрытые силы. Слушай тишину внутри.',
   rx:'Скрытые повестки, поверхностность, игнорирование интуиции.'},
  {id:'III',suit:'major', name:'Императрица',      sym:'♀', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Изобилие, творчество, плодородие. Природа создаёт — и ты создаёшь.',
   rx:'Зависимость, творческий блок, избыток или нехватка заботы.'},
  {id:'IV', suit:'major', name:'Император',        sym:'♂', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Власть, порядок, структура. Хаос можно и нужно контролировать.',
   rx:'Тирания, жёсткость, неспособность делегировать. Слабость за маской силы.'},
  {id:'V',  suit:'major', name:'Иерофант',         sym:'⊕', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Традиция, наставник, духовные системы. Путь через ритуал и принятые нормы.',
   rx:'Догматизм, слепое следование правилам, коррупция в институтах.'},
  {id:'VI', suit:'major', name:'Влюблённые',       sym:'⟡', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Выбор, союз, ценности. Сердце или разум — надо решать.',
   rx:'Разлад, неверное решение, внутренний конфликт.'},
  {id:'VII',suit:'major', name:'Колесница',        sym:'◈', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Победа через волю, движение вперёд. Ты управляешь хаосом.',
   rx:'Потеря контроля, агрессия без цели, рассеянность.'},
  {id:'VIII',suit:'major',name:'Сила',             sym:'∞', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Внутренняя мощь, терпение, укрощение собственного зверя.',
   rx:'Неуверенность, подавленные эмоции, срыв.'},
  {id:'IX', suit:'major', name:'Отшельник',        sym:'△', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Уединение, поиск истины, внутренний свет во тьме.',
   rx:'Изоляция как бегство, отрицание помощи, одиночество без смысла.'},
  {id:'X',  suit:'major', name:'Колесо Фортуны',  sym:'⊷', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Цикл судьбы, перемены, кармический поворот. Колесо крутится.',
   rx:'Сопротивление переменам, невезение, застревание в цикле.'},
  {id:'XI', suit:'major', name:'Справедливость',  sym:'⊗', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Баланс, истина, причина и следствие. Всё возвращается.',
   rx:'Несправедливость, предвзятость, уклонение от ответственности.'},
  {id:'XII',suit:'major', name:'Повешенный',       sym:'⊶', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Пауза, жертва ради знания. Смотри на мир с новой точки.',
   rx:'Мартирство без смысла, затяжная неопределённость, отказ двигаться.'},
  {id:'XIII',suit:'major',name:'Смерть',           sym:'☠', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Трансформация, конец цикла, необратимое изменение. Расчисти место.',
   rx:'Стагнация, страх перемен, цепляние за то, что уже умерло.'},
  {id:'XIV',suit:'major', name:'Умеренность',      sym:'≋', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Равновесие, терпение, синтез противоположностей. Поток, а не борьба.',
   rx:'Дисбаланс, торопливость, крайности.'},
  {id:'XV', suit:'major', name:'Дьявол',           sym:'⊘', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Зависимость, материальные цепи. Ты сам надел их — ты можешь снять.',
   rx:'Освобождение от оков, но риск впасть в другую крайность.'},
  {id:'XVI',suit:'major', name:'Башня',            sym:'✕', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Внезапный крах иллюзий. Разрушение необходимо для перерождения.',
   rx:'Откладывание неизбежного. Крах всё равно придёт, но позже и больнее.'},
  {id:'XVII',suit:'major',name:'Звезда',           sym:'✦', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Надежда, вдохновение, исцеление. Путеводный свет в темноте.',
   rx:'Отчаяние, потеря веры, оторванность от реальности.'},
  {id:'XVIII',suit:'major',name:'Луна',            sym:'◐', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Иллюзии, страхи, подсознание. Туман между мирами.',
   rx:'Рассеивание иллюзий, но риск потерять интуицию вместе с ними.'},
  {id:'XIX',suit:'major', name:'Солнце',           sym:'☉', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Радость, ясность, жизненная сила. Ты в центре — и это хорошо.',
   rx:'Самонадеянность, детское мышление, уход от реальности в оптимизм.'},
  {id:'XX', suit:'major', name:'Суд',              sym:'◉', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Пробуждение, призыв, переоценка. Ответь на зов — время пришло.',
   rx:'Самобичевание, страх суда, неготовность к переменам.'},
  {id:'XXI',suit:'major', name:'Мир',              sym:'⊶', col:'#1a0a2a', suitLabel:'Арканы',
   up:'Завершение, интеграция. Цикл закрыт — и сразу открывается следующий.',
   rx:'Незавершённость, нежелание признавать окончание.'},
  // ЖЕЗЛЫ
  {id:'w1', suit:'wands', name:'Туз Жезлов',       sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Творческий импульс, новый проект, искра вдохновения. Начинай.',
   rx:'Задержки, блоки, нереализованный потенциал.'},
  {id:'w2', suit:'wands', name:'2 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Планирование, выбор пути, мир в руках. Смотри вперёд.',
   rx:'Страх перед будущим, нерешительность, застревание дома.'},
  {id:'w3', suit:'wands', name:'3 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Расширение горизонтов, первые плоды. Результаты близко.',
   rx:'Задержки, препятствия, разочарование от ожидания.'},
  {id:'w4', suit:'wands', name:'4 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Торжество, стабильность, дом и сообщество. Отпразднуй.',
   rx:'Нестабильность в фундаменте, откладывание празднования.'},
  {id:'w5', suit:'wands', name:'5 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Конкуренция, хаотичная энергия, споры. Борьба закаляет.',
   rx:'Избегание конфликта в ущерб себе, скрытая агрессия.'},
  {id:'w6', suit:'wands', name:'6 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Победа, признание, триумф. Ты заслужил это.',
   rx:'Провал на виду у всех, самонадеянность перед победой.'},
  {id:'w7', suit:'wands', name:'7 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Защита позиции, стойкость под давлением. Держись.',
   rx:'Сдача позиций, паранойя, ощущение что все против тебя.'},
  {id:'w8', suit:'wands', name:'8 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Быстрые события, ускорение, действие без промедления.',
   rx:'Хаос, слишком много сразу, упущенные послания.'},
  {id:'w9', suit:'wands', name:'9 Жезлов',         sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Стойкость после испытаний. Ты почти дошёл — последний рубеж.',
   rx:'Параноя, нежелание доверять, хроническая усталость.'},
  {id:'w10',suit:'wands', name:'10 Жезлов',        sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Бремя ответственности. Ты несёшь многое — но финиш близко.',
   rx:'Перегрузка, неумение делегировать, самопожертвование в ущерб себе.'},
  {id:'wp', suit:'wands', name:'Паж Жезлов',       sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Энтузиазм, любопытство, начинающий путь огня.',
   rx:'Поспешность, отсутствие плана, бесконечный старт без продолжения.'},
  {id:'wk1',suit:'wands', name:'Рыцарь Жезлов',    sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Страстное движение, авантюризм, стремительность. Вперёд!',
   rx:'Безрассудство, агрессия, непостоянство.'},
  {id:'wq', suit:'wands', name:'Королева Жезлов',  sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Харизма, уверенность, творческая сила. Притягивает к себе всё.',
   rx:'Ревность, эгоцентризм, манипуляция вниманием.'},
  {id:'wki',suit:'wands', name:'Король Жезлов',    sym:'△', col:'#200800', suitLabel:'Жезлы',
   up:'Лидерство, вдохновение, мастер своего дела. Строй империю.',
   rx:'Тирания, высокомерие, неспособность слушать.'},
  // КУБКИ
  {id:'c1', suit:'cups',  name:'Туз Кубков',       sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Новое чувство, эмоциональное начало. Чаша полна — открой сердце.',
   rx:'Эмоциональная закрытость, подавленные чувства, опустошение.'},
  {id:'c2', suit:'cups',  name:'2 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Союз, взаимопонимание, гармония двух. Прекрасное начало.',
   rx:'Разлад, дисбаланс, разрыв отношений.'},
  {id:'c3', suit:'cups',  name:'3 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Дружба, праздник, изобилие. Время делиться радостью.',
   rx:'Избыточное веселье, сплетни, предательство в компании.'},
  {id:'c4', suit:'cups',  name:'4 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Апатия, скука. Ты не замечаешь протянутой руки.',
   rx:'Выход из апатии, новое видение, принятие помощи.'},
  {id:'c5', suit:'cups',  name:'5 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Утрата, скорбь. Но позади стоят два полных кубка — не всё потеряно.',
   rx:'Принятие потери, движение вперёд, исцеление.'},
  {id:'c6', suit:'cups',  name:'6 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Прошлое, воспоминания, невинность. Кто-то из прошлого возвращается.',
   rx:'Застревание в прошлом, идеализация, нежелание взрослеть.'},
  {id:'c7', suit:'cups',  name:'7 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Иллюзии, грёзы, слишком много вариантов. Выбери реальный.',
   rx:'Ясность из тумана, возврат к реальности.'},
  {id:'c8', suit:'cups',  name:'8 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Уход, отказ от старого ради поиска большего смысла.',
   rx:'Страх уйти, застревание из страха перемен.'},
  {id:'c9', suit:'cups',  name:'9 Кубков',         sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Исполнение желаний, удовлетворение. Карта мечтателя.',
   rx:'Самодовольство, материализм, желания исполнены — но не те.'},
  {id:'c10',suit:'cups',  name:'10 Кубков',        sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Счастье, гармония, полнота жизни. Радуга над домом.',
   rx:'Семейные конфликты, разрыв, идеализация «счастливой семьи».'},
  {id:'cp', suit:'cups',  name:'Паж Кубков',       sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Интуитивный вестник, чувствительность, творческое послание.',
   rx:'Незрелые эмоции, иллюзии, уход в фантазии.'},
  {id:'ck1',suit:'cups',  name:'Рыцарь Кубков',    sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Романтик, мечтатель, преследователь идеала.',
   rx:'Капризность, разочарованность, бегство от реальности.'},
  {id:'cq', suit:'cups',  name:'Королева Кубков',  sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Эмпатия, интуиция, эмоциональная мудрость. Она понимает без слов.',
   rx:'Манипуляция через жалость, эмоциональная зависимость.'},
  {id:'cki',suit:'cups',  name:'Король Кубков',    sym:'▽', col:'#001428', suitLabel:'Кубки',
   up:'Эмоциональный баланс, мудрость сердца, дипломатия.',
   rx:'Подавление чувств, холодность под маской мудрости.'},
  // МЕЧИ
  {id:'s1', suit:'swords',name:'Туз Мечей',        sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Ясность, истина, прорыв через иллюзии. Меч разрубает туман.',
   rx:'Жестокость истины, деструктивная ясность, слова как оружие.'},
  {id:'s2', suit:'swords',name:'2 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Тупик, избегание решения. Ты закрыл глаза — но выбор всё равно придётся сделать.',
   rx:'Выход из тупика, снятие повязки, болезненное, но необходимое решение.'},
  {id:'s3', suit:'swords',name:'3 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Боль, предательство, разбитое сердце. Прими — это освобождает.',
   rx:'Зацикленность на боли, нежелание двигаться дальше.'},
  {id:'s4', suit:'swords',name:'4 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Отдых после битвы, восстановление, медитация. Остановись.',
   rx:'Тревожный покой, вынужденный отдых, нежелание возвращаться в игру.'},
  {id:'s5', suit:'swords',name:'5 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Конфликт, пиррова победа. Ты победил — но какой ценой?',
   rx:'Принятие поражения, уход с достоинством.'},
  {id:'s6', suit:'swords',name:'6 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Переход, движение к спокойствию. Уходи от бури к тихой воде.',
   rx:'Нежелание уходить, застревание в бурной ситуации.'},
  {id:'s7', suit:'swords',name:'7 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Хитрость, стратегический уход. Иногда брать тихо — правильно.',
   rx:'Обман раскрыт, нечестность возвращается бумерангом.'},
  {id:'s8', suit:'swords',name:'8 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Ментальная ловушка. Ты сам сковал себя — и сам можешь освободиться.',
   rx:'Освобождение от ограничений, прозрение.'},
  {id:'s9', suit:'swords',name:'9 Мечей',          sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Тревога, ночные кошмары, кризис разума. Страхи больше, чем реальность.',
   rx:'Выход из тревожного состояния, обращение за помощью.'},
  {id:'s10',suit:'swords',name:'10 Мечей',         sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Окончательный конец, полный крах. Но рассвет уже начинается.',
   rx:'Выживание, неожиданное спасение, отказ от жертвенности.'},
  {id:'sp', suit:'swords',name:'Паж Мечей',        sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Острый ум, наблюдательность, жажда знаний.',
   rx:'Сплетни, поверхностность, слова без действий.'},
  {id:'sk1',suit:'swords',name:'Рыцарь Мечей',     sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Стремительный интеллект, прямолинейность. Натиск без остановок.',
   rx:'Импульсивность, жестокость, действие без обдумывания.'},
  {id:'sq', suit:'swords',name:'Королева Мечей',   sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Острый ум, независимость, честность без прикрас.',
   rx:'Холодность, жестокость, изоляция за стеной интеллекта.'},
  {id:'ski',suit:'swords',name:'Король Мечей',     sym:'◇', col:'#0f0f18', suitLabel:'Мечи',
   up:'Интеллектуальная власть, авторитет, ментальная сила.',
   rx:'Манипуляция интеллектом, холодный расчёт без сочувствия.'},
  // ПЕНТАКЛИ
  {id:'p1', suit:'pents', name:'Туз Пентаклей',    sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Материальное начало, семя процветания, новая возможность.',
   rx:'Упущенный шанс, материализм без цели.'},
  {id:'p2', suit:'pents', name:'2 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Жонглирование ресурсами, адаптация. Равновесие в движении.',
   rx:'Перегрузка, потеря баланса, финансовый хаос.'},
  {id:'p3', suit:'pents', name:'3 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Мастерство, командная работа, признание таланта.',
   rx:'Плохая командная работа, посредственность, отсутствие признания.'},
  {id:'p4', suit:'pents', name:'4 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Контроль над ресурсами, стабильность. Держи, что имеешь.',
   rx:'Скупость, страх потери, удушение из-за чрезмерного контроля.'},
  {id:'p5', suit:'pents', name:'5 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Нужда, изоляция. Помощь рядом — ты просто не смотришь.',
   rx:'Выход из нужды, принятие помощи, выживание.'},
  {id:'p6', suit:'pents', name:'6 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Щедрость, баланс «давать и брать». Делись — это возвращается.',
   rx:'Долги, зависимость от чужой щедрости, неравный обмен.'},
  {id:'p7', suit:'pents', name:'7 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Оценка результатов, терпение. Урожай ещё не готов — подожди.',
   rx:'Нетерпение, неудовлетворённость, напрасный труд.'},
  {id:'p8', suit:'pents', name:'8 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Мастерство через практику, труд, совершенствование. Делай снова и снова.',
   rx:'Трудоголизм без смысла, рутина ради рутины.'},
  {id:'p9', suit:'pents', name:'9 Пентаклей',      sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Самодостаточность, плоды труда, изобилие. Ты заслужил.',
   rx:'Зависимость, одиночество в достатке, потеря нажитого.'},
  {id:'p10',suit:'pents', name:'10 Пентаклей',     sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Наследие, стабильность поколений, долгосрочный успех.',
   rx:'Семейные конфликты из-за денег, рухнувшее наследие.'},
  {id:'pp', suit:'pents', name:'Паж Пентаклей',    sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Студент, практичные начинания, усердие. Учись на практике.',
   rx:'Прокрастинация, мечтательность без действий.'},
  {id:'pk1',suit:'pents', name:'Рыцарь Пентаклей', sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Методичность, надёжность. Медленно, но верно.',
   rx:'Упрямство, скука, чрезмерная осторожность.'},
  {id:'pq', suit:'pents', name:'Королева Пентаклей',sym:'◆',col:'#001408', suitLabel:'Пентакли',
   up:'Заботливость, практичность, изобилие. Дом — крепость.',
   rx:'Гиперопека, материализм вместо тепла.'},
  {id:'pki',suit:'pents', name:'Король Пентаклей', sym:'◆', col:'#001408', suitLabel:'Пентакли',
   up:'Мастер материи, предпринимательство, щедрость силы.',
   rx:'Коррупция, власть ради власти, жадность.'},
];

// ===== СЛАВЯНСКИЕ РУНЫ (18) =====
// Символы подобраны из Unicode-блока 16A0–16FF (Runic) по визуальному сходству с фото.
// Порядок: Мир → Треба → Рок → Чернобог → Сила → Опора → Алатырь → Ветер → Даждьбог
//           → Радуга → Берегиня → Перун → Нужда → Уд → Есть → Крада → Леля → Исток
const SLAVIC_RUNES = [
  {name:'Мир (Белобог)', sym:'ᛉ', col:'#001a10',
   up:'Гармония, порядок, защита. Союз с миром богов и людей. Белобог хранит.',
   rx:'Хаос, конфликт, разрушение установленного порядка.'},
  {name:'Треба',         sym:'ᛏ', col:'#0a0a1a',
   up:'Жертвоприношение, долг, исполнение обязательств богам и людям.',
   rx:'Отказ от долга, нарушение клятвы, духовная пустота.'},
  {name:'Рок',           sym:'ᛡ', col:'#100010',
   up:'Судьба, неизбежность, высший закон. Прими — и освободишься.',
   rx:'Бегство от судьбы, борьба с неизбежным, кармический долг.'},
  {name:'Чернобог',      sym:'ᛦ', col:'#1a0000',
   up:'Испытание, тёмная сила, разрушение старого ради нового.',
   rx:'Слепая тьма, саморазрушение, отказ учиться на испытании.'},
  {name:'Сила',          sym:'ᛋ', col:'#0a1a00',
   up:'Жизненная сила, воля, энергия духа. Ты сильнее чем думаешь.',
   rx:'Слабость духа, утечка силы, чужая воля вместо своей.'},
  {name:'Опора',         sym:'ᚯ', col:'#0a0a00',
   up:'Предки, традиция, корни, поддержка из прошлого.',
   rx:'Одиночество, отрыв от корней, отрицание помощи предков.'},
  {name:'Алатырь',       sym:'ᛆ', col:'#1a1000',
   up:'Центр мира, равновесие, начало и конец всего. Ось бытия.',
   rx:'Дисбаланс, потеря центра, блуждание без опоры.'},
  {name:'Ветер',         sym:'⌂', col:'#00101a',
   svg:'<svg viewBox="0 0 60 82" width="30" height="42" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="30" y1="4" x2="4" y2="28"/><line x1="30" y1="4" x2="56" y2="28"/><line x1="4" y1="28" x2="4" y2="78"/><line x1="56" y1="28" x2="56" y2="78"/></svg>',
   up:'Дух, движение, перемены, воля богов. Не сопротивляйся потоку.',
   rx:'Застой, отрицание перемен, страх движения.'},
  {name:'Даждьбог',      sym:'ᚦ', col:'#1a1000',
   up:'Дарующий бог, изобилие, солнечный свет, щедрость.',
   rx:'Жадность, удача закрыта, блокировка благодати.'},
  {name:'Радуга',        sym:'ᚱ', col:'#001428',
   up:'Связь между мирами, мост, дорога. Иди — путь открыт.',
   rx:'Потеря пути, застревание между мирами, ложный выбор.'},
  {name:'Берегиня',      sym:'ᚫ', col:'#001a08', mirrorV:true,
   up:'Защита, безопасность, мать-земля, возвращение домой.',
   rx:'Беззащитность, изгнание, потеря почвы под ногами.'},
  {name:'Перун',         sym:'∏', col:'#0a0a1a',
   up:'Гром, справедливость, очищение. Перун судит — и он справедлив.',
   rx:'Слепой гнев, несправедливое наказание, разрушение вместо защиты.'},
  {name:'Нужда',         sym:'ᚳ', col:'#1a0a00',
   up:'Ограничение, необходимость, кармический урок. Пройди — вырастешь.',
   rx:'Рабство обстоятельствам, отказ учиться, цикл повторяется.'},
  {name:'Уд',            sym:'հ', col:'#1a0800',
   up:'Жизненная сила рода, страсть, творческое начало, потенция.',
   rx:'Разрушение связи с родом, угасание силы, творческий кризис.'},
  {name:'Есть',          sym:'ᚫ', col:'#0a1000', mirrorH:true,
   up:'Бытие, существование, настоящий момент. Ты есть — и это сила.',
   rx:'Отрицание существования, побег от настоящего, небытие как выбор.'},
  {name:'Крада',         sym:'ᚳ', col:'#200500', mirrorV:true,
   up:'Очистительный огонь, жертва, трансформация через горение.',
   rx:'Выгорание, жертва без смысла, всё сгорает зря.'},
  {name:'Леля',          sym:'ᛚ', col:'#001020',
   up:'Любовь, интуиция, вода, весна, обновление. Сердце знает.',
   rx:'Холодность, подавление чувств, потеря связи с интуицией.'},
  {name:'Исток',         sym:'ᛁ', col:'#001818',
   up:'Начало, источник, первопричина всего сущего.',
   rx:'Потеря смысла, разрыв с первопричиной, бессмысленное существование.'},
];

// ===== СКАНДИНАВСКИЕ РУНЫ (Elder Futhark, 24) =====
const NORSE_RUNES = [
  {name:'Феху',   sym:'ᚠ', col:'#1a0a00', up:'Богатство, удача, поток энергии. Что имеешь — то и растёт.', rx:'Алчность, потеря, застой ресурсов.'},
  {name:'Уруз',   sym:'ᚢ', col:'#1a0500', up:'Дикая сила, здоровье, первобытная мощь. Стихия в тебе.', rx:'Слабость, болезнь, необузданная агрессия.'},
  {name:'Турисаз',sym:'ᚦ', col:'#200000', up:'Шип, защита, удар. Препятствие — или оружие.', rx:'Предательство, опасность без предупреждения.'},
  {name:'Ансуз',  sym:'ᚨ', col:'#001020', up:'Послание богов, вдохновение, голос и слово. Слушай.', rx:'Обман, ложные сигналы, потеря связи с высшим.'},
  {name:'Райдо',  sym:'ᚱ', col:'#001428', up:'Путешествие, движение, правильный ритм. Иди.', rx:'Задержка, неверный путь, потеря ориентира.'},
  {name:'Кано',   sym:'ᚲ', col:'#200800', up:'Факел, ясность, творческий огонь. Видишь в темноте.', rx:'Темнота, потеря ориентира, угасание огня.'},
  {name:'Гебо',   sym:'ᚷ', col:'#0a001a', up:'Дар, союз, обмен. Связь двух равных.', rx:'(Не переворачивается) — дисбаланс в отдаче и получении.'},
  {name:'Вунйо',  sym:'ᚹ', col:'#001a00', up:'Радость, гармония, достижение. Ты в потоке.', rx:'Скорбь, отчуждение, нарушение гармонии.'},
  {name:'Хагалаз',sym:'ᚺ', col:'#0a0a1a', up:'Град, хаос, вынужденное изменение. Сломанное — освобождает.', rx:'(Не переворачивается) — разрушение без трансформации.'},
  {name:'Наутиз', sym:'ᚾ', col:'#1a0800', up:'Нужда, ограничение, необходимость. Урок через лишение.', rx:'Сковывающие нужды, сопротивление неизбежному.'},
  {name:'Иса',    sym:'ᛁ', col:'#001428', up:'Лёд, остановка, концентрация. Застынь — и увидишь.', rx:'(Не переворачивается) — заморозка, блок, потеря движения.'},
  {name:'Йера',   sym:'ᛃ', col:'#001800', up:'Урожай, цикл, плоды терпения. Время пришло.', rx:'(Не переворачивается) — цикл нарушен, плоды ещё не созрели.'},
  {name:'Эйваз',  sym:'ᛇ', col:'#040400', up:'Тис, смерть-жизнь, защита. Ось между мирами.', rx:'(Не переворачивается) — нестабильность, потеря связи с корнями.'},
  {name:'Перто',  sym:'ᛈ', col:'#100008', up:'Тайна, судьба, нераскрытое. Игра с неизвестным.', rx:'Разочарование, скрытое раскрыто не вовремя, секреты против тебя.'},
  {name:'Альгиз', sym:'ᛉ', col:'#001810', up:'Защита, связь с богами, страж. Твоя стена держит.', rx:'Уязвимость, фальшивая защита, предательство опоры.'},
  {name:'Соулу',  sym:'ᛊ', col:'#1a1000', up:'Солнце, победа, жизненная сила. Свет рассеивает тень.', rx:'(Не переворачивается) — слепящий свет, самонадеянность, тщеславие.'},
  {name:'Тиваз',  sym:'ᛏ', col:'#0a0018', up:'Тюр, справедливость, жертва ради правого дела. Держи.', rx:'Несправедливость, поражение, неверная жертва.'},
  {name:'Беркана',sym:'ᛒ', col:'#001800', up:'Берёза, рождение, рост, материнство. Новое начинается.', rx:'Задержка роста, семейный конфликт, невозможность зачать.'},
  {name:'Эваз',   sym:'ᛖ', col:'#0a0800', up:'Конь, движение, сотрудничество. Союзник несёт дальше.', rx:'Сопротивление, застревание, неверный партнёр.'},
  {name:'Манназ', sym:'ᛗ', col:'#080010', up:'Человек, разум, сообщество. Ты среди людей — и они с тобой.', rx:'Изоляция, конфликт, потеря человеческой поддержки.'},
  {name:'Лагуз',  sym:'ᛚ', col:'#001420', up:'Вода, интуиция, поток. Не сопротивляйся — плыви.', rx:'Страх глубины, ложная интуиция, утопание в эмоциях.'},
  {name:'Ингваз', sym:'ᛜ', col:'#001000', up:'Ингвар, плодородие, завершение цикла. Семя посеяно.', rx:'(Не переворачивается) — незавершённость, нереализованный потенциал.'},
  {name:'Отала',  sym:'ᛟ', col:'#0a0800', up:'Наследие, родина, принадлежность. Корни дают силу.', rx:'Изгнание, потеря наследства, конфликт с родом.'},
  {name:'Дагаз',  sym:'ᛞ', col:'#100800', up:'Рассвет, трансформация, прорыв в новый день. Поворотный момент.', rx:'(Не переворачивается) — смена без понимания, слепой прорыв.'},
];

let thrownNorseRunes = [];

function renderNorseRunesSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">ᚠ СКАНДИНАВСКИЕ РУНЫ · ФУТАРК</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:12px">
      24 руны Старшего Футарка. Три позиции: прошлое, настоящее, путь.
    </div>
    <button class="btn primary" onclick="throwNorseRunes()">ᚦ Бросить руны</button>
    <div class="rune-spread" id="norse-rune-spread" style="margin-top:14px"></div>
    <div class="rune-meanings" id="norse-rune-meanings"></div>
  </div>`;
}

function throwNorseRunes() {
  const pool = [...NORSE_RUNES];
  thrownNorseRunes = [];
  const positions = ['Прошлое','Настоящее','Путь'];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const rune = {...pool.splice(idx, 1)[0]};
    rune.reversed = Math.random() < 0.4;
    rune.position = positions[i];
    thrownNorseRunes.push(rune);
  }
  const spread = document.getElementById('norse-rune-spread');
  const meanings = document.getElementById('norse-rune-meanings');
  if (!spread) return;
  spread.innerHTML = thrownNorseRunes.map((r, i) => `
    <div class="rune-wrap">
      <div class="rune-tile face-down" id="nrtile-${i}" style="background:${r.col};animation-delay:${i*0.3}s" onclick="revealNorseRune(${i})">✦</div>
      <div class="rune-name" id="nrname-${i}" style="display:none">${r.name}</div>
      <div class="rune-pos">${r.position}</div>
    </div>`).join('');
  if (meanings) meanings.innerHTML = '';
  thrownNorseRunes.forEach((_, i) => setTimeout(() => revealNorseRune(i), 400 + i * 500));
}

function revealNorseRune(i) {
  const r = thrownNorseRunes[i];
  if (!r) return;
  const tile = document.getElementById(`nrtile-${i}`);
  const nameEl = document.getElementById(`nrname-${i}`);
  if (!tile) return;
  if (r.svg) { tile.innerHTML = r.svg; } else { tile.textContent = r.sym; }
  tile.style.background = '';
  tile.style.color = '';
  tile.classList.remove('face-down');
  tile.classList.add('revealed');
  if (r.reversed) tile.classList.add('rune-reversed');
  if (nameEl) nameEl.style.display = 'block';
  const meanings = document.getElementById('norse-rune-meanings');
  if (!meanings) return;
  const existing = document.getElementById(`nrmean-${i}`);
  if (existing) return;
  const div = document.createElement('div');
  div.id = `nrmean-${i}`;
  div.className = 'rune-meaning-block';
  div.style.animationDelay = (i * 0.2) + 's';
  div.innerHTML = `
    <div class="rune-meaning-title">${r.position} · ${r.sym} ${r.name}${r.reversed ? ' [перевёрнутая]' : ''}</div>
    ${r.reversed
      ? `<span class="rune-meaning-rev">⊗ ${r.rx}</span>`
      : `⟡ ${r.up}`}`;
  meanings.appendChild(div);
}

// ===== ADMIN HTML SNIPPETS =====
const ADMIN_SNIPPETS = {
  'h1':      ['<h1>', '</h1>'],
  'h2':      ['<h2>', '</h2>'],
  'h3':      ['<h3>', '</h3>'],
  'b':       ['<b>', '</b>'],
  'i':       ['<i>', '</i>'],
  'u':       ['<u>', '</u>'],
  'center':  ['<center>', '</center>'],
  'marquee': ['<marquee>', '</marquee>'],
  'red':     ['<span style="color:#ff2200">', '</span>'],
  'gold':    ['<span style="color:#ffaa00">', '</span>'],
  'green':   ['<span style="color:#00cc44">', '</span>'],
  'big':     ['<span style="font-size:24px">', '</span>'],
  'small':   ['<span style="font-size:9px">', '</span>'],
  'hr':      ['<hr>', ''],
  'br':      ['<br><br>', ''],
  'code':    ['<code>', '</code>'],
  'details': ['<details><summary>Раскрыть</summary>', '</details>'],
};

// ===== @УПОМИНАНИЯ =====
function renderMentions(text) {
  return text.replace(/@([\wа-яёА-ЯЁ_-]+)/g, (match, name) => {
    const user = DB.users.find(u => u.name === name);
    if (user) return `<span class="mention" onclick="openUserPage('${escapeHtml(name)}')">@${escapeHtml(name)}</span>`;
    return match;
  });
}

function setupMentionAutocomplete(taId) {
  const ta = document.getElementById(taId);
  if (!ta) return;
  ta.addEventListener('input', () => {
    const pos = ta.selectionStart;
    const before = ta.value.substring(0, pos);
    const atMatch = before.match(/@([\wа-яёА-ЯЁ_-]*)$/);
    const dd = document.getElementById('mention-dropdown');
    if (!atMatch) { dd.style.display = 'none'; return; }
    const q = atMatch[1].toLowerCase();
    const matches = DB.users.filter(u => u.name.toLowerCase().startsWith(q) && u.name !== ME.name).slice(0, 6);
    if (!matches.length) { dd.style.display = 'none'; return; }
    dd.style.display = 'block';
    dd.innerHTML = matches.map(u =>
      `<div class="mention-item" onmousedown="insertMention('${u.name}','${taId}')">${u.avatar||'?'} ${escapeHtml(u.name)}</div>`
    ).join('');
  });
  ta.addEventListener('blur', () => setTimeout(()=>{ const dd=document.getElementById('mention-dropdown'); if(dd) dd.style.display='none'; }, 150));
}

function insertMention(name, taId) {
  const ta = document.getElementById(taId) || document.getElementById('compose-text');
  if (!ta) return;
  const pos = ta.selectionStart;
  const before = ta.value.substring(0, pos).replace(/@[\wа-яёА-ЯЁ_-]*$/, '@' + name + ' ');
  ta.value = before + ta.value.substring(pos);
  ta.selectionStart = ta.selectionEnd = before.length;
  ta.focus();
  const dd = document.getElementById('mention-dropdown');
  if (dd) dd.style.display = 'none';
}

// ===== ПОИСК ПОСТОВ =====
function searchFeed() {
  const q = (document.getElementById('feed-search')||{}).value.trim().toLowerCase();
  const el = document.getElementById('feed-list');
  const feed = [...DB.posts].reverse();
  const filtered = q ? feed.filter(p =>
    p.body.toLowerCase().includes(q) || p.author.toLowerCase().includes(q)
  ) : feed;
  if (!filtered.length) { el.innerHTML = '<div class="empty-state">Ничего не найдено.</div>'; return; }
  el.innerHTML = filtered.map(p => renderPost(p, 'feed')).join('');
  document.getElementById('feed-count').textContent = filtered.length + ' трансляций';
}

// ===== ЛЕНТА ПОДПИСОК =====
function renderSubsFeed() {
  const el = document.getElementById('subs-feed-list');
  const subs = ME.subs || [];
  if (!subs.length) { el.innerHTML = '<div class="empty-state">Нет подписок. Подпишитесь на кого-нибудь.</div>'; return; }
  const posts = [...DB.posts].reverse().filter(p => subs.includes(p.author));
  if (!posts.length) { el.innerHTML = '<div class="empty-state">Подписки молчат. Пока пусто.</div>'; return; }
  el.innerHTML = posts.map(p => renderPost(p, 'subs')).join('');
}

// ===== ТАРО =====
let tarotMode = 1; // 1 или 3 карты
let drawnCards = [];

const TAROT_SPREAD_LABELS = {
  1:  [''],
  3:  ['Прошлое','Настоящее','Будущее'],
  // Подкова: левая колонна вниз (0-2), дно (3), правая колонна вверх (4-6)
  7:  ['Прошлое','Настоящее','Скрытые силы','Препятствие','Окружение','Что делать','Итог'],
  // Кельтский крест: (0)центр, (1)пересечение, (2)прошлое, (3)корона, (4)будущее, (5)основа, (6-9)штаб
  10: ['Ситуация','Пересечение','Прошлое','Корона','Будущее','Основа','Позиция','Окружение','Надежды','Итог'],
  // Звезда 9 карт: S=центр, 1=верх, 2=низ, 3=лево, 4=право, 5=верх-лево, 6=верх-право, 7=низ-лево, 8=низ-право
  8:  ['Сигнификатор','Позитивное влияние','Негативное влияние','Ближние (в целом)','Противники (в целом)','Поддержка ближних','Влияние извне (+)','Давление ближних','Давление противников'],
  // Дерево Жизни (10 Сефирот): сверху вниз, поочерёдно правое/левое
  11: ['Кетер','Хокма','Бина','Хесед','Гебура','Тиферет','Нецах','Ход','Йесод','Малкут'],
};
const TAROT_SPREAD_NAMES = {
  1:'Одна карта', 3:'Три карты', 7:'Подкова', 8:'Звезда', 10:'Кельтский крест', 11:'Дерево Жизни'
};

function renderTarotSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">🃏 ТАРО — РАСКЛАД КАРТ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:10px">
      Сосредоточься на вопросе. Карты отвечают.
    </div>
    <div class="tarot-mode-btns">
      ${Object.entries(TAROT_SPREAD_NAMES).map(([m,n])=>`
        <button class="btn sm${tarotMode===+m?' primary':''}" onclick="setTarotMode(${m})">${n}</button>
      `).join('')}
    </div>
    <div style="font-size:9px;color:var(--textd);margin-bottom:8px">${
      tarotMode===10?'10 карт · Кельтский крест — полный анализ ситуации':
      tarotMode===7 ?'7 карт · Подкова — прошлое, настоящее, путь вперёд':
      tarotMode===8 ?'9 карт · Звезда — сигнификатор + 8 позиций влияния (по Татьяне Вереск)':
      tarotMode===11?'10 карт · Дерево Жизни (Каббала) — 10 сефирот, от Кетера до Малкута':''
    }</div>
    <button class="btn primary" onclick="drawTarot()" style="margin-bottom:8px">⟡ Вытянуть карты</button>
    <div id="tarot-spread" class="tarot-spread${tarotMode===10?' tarot-cross':tarotMode===7?' tarot-horseshoe':tarotMode===11?' tarot-tree':tarotMode===8?' tarot-star':''}"></div>
    <div id="tarot-desc" class="tarot-desc" style="display:none"></div>
  </div>`;
}

function setTarotMode(m) {
  tarotMode = m;
  _renderActiveMiniGame();
}

const SUIT_SYMS = { wands:'🜂', cups:'🜄', swords:'🜁', pents:'🜃' };

// Карта Безумия — секретная 79я карта (не упоминается в UI)
const CHAOS_CARD = {
  id:'∅', suit:'chaos', name:'Карта Безумия', sym:'∅', col:'#000000', suitLabel:'Хаос',
  up:'Эта карта не должна была выпасть — и именно поэтому выпала. Ты находишься в точке, где привычные законы перестают работать: причина не порождает следствие, прошлое не определяет будущее, а любой прогноз превращается в ложь в момент произнесения. Это не катастрофа — это разрыв в ткани привычного, сквозь который проникает что-то принципиально новое. Действуй вне системы. Не ищи логики там, где её нет. Именно сейчас возможно то, что было невозможно вчера.',
  rx:'Хаос без вектора — это уже не свобода, а распад. Что-то разрушается не ради обновления, а просто потому что некому удержать. Энергия рассеивается впустую, события теряют связь друг с другом, и в этом беспорядке легко потерять себя. Остановись. Найди хотя бы одну точку опоры — не для того, чтобы вернуть контроль, а чтобы не раствориться окончательно. Из абсолютного ничто ничто и рождается.'
};

let flippedCards = new Set();

function drawTarot() {
  const deck = [...TAROT_CARDS, {...CHAOS_CARD}]; // 79 карт — Карта Безумия с равным шансом
  drawnCards = [];
  flippedCards = new Set();

  const cardCount = {8:9, 11:10}[tarotMode] ?? tarotMode;
  for (let i = 0; i < cardCount; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    const card = {...deck.splice(idx, 1)[0]};
    card.reversed = Math.random() < 0.35;
    drawnCards.push(card);
  }

  const labels = TAROT_SPREAD_LABELS[tarotMode] || [''];
  const spread = document.getElementById('tarot-spread');
  const desc = document.getElementById('tarot-desc');
  if (!spread) return;

  spread.innerHTML = drawnCards.map((c, i) => {
    const isChaos = c.suit === 'chaos';
    const displaySym = SUIT_SYMS[c.suit] || c.sym;
    const frontStyle = isChaos
      ? `background:#000;border-color:#00ffff;box-shadow:0 0 15px #ff00ff,inset 0 0 10px rgba(0,255,255,.2);`
      : `background:${c.col};`;
    const symStyle = isChaos
      ? `color:#00ffff;text-shadow:0 0 10px #ff00ff,0 0 20px #00ffff;animation:glitchText 1s infinite;font-size:26px;`
      : '';
    const nameStyle = isChaos ? `color:#00ffff;text-shadow:0 0 8px #ff00ff;` : '';
    const numStyle  = isChaos ? `color:#ff00ff;` : '';
    const revBadge  = '';

    return `<div class="tarot-card-wrap" onclick="flipTarotCard(${i})">
      <div class="tarot-card${c.reversed?' reversed':''}" id="tcard-${i}">
        <div class="tarot-back" style="background:repeating-linear-gradient(45deg,#0a0015,#0a0015 4px,#100025 4px,#100025 8px)">
          <div class="tarot-back-sym">✦</div>
        </div>
        <div class="tarot-front" style="${frontStyle}position:relative;">
          <div class="tarot-front-num" style="${numStyle}">${c.id}</div>
          ${revBadge}
          <div class="tarot-front-sym" style="${symStyle}">${displaySym}</div>
          <div class="tarot-front-name" style="${nameStyle}">${c.name}</div>
          <div class="tarot-front-suit" style="${isChaos?'color:#ff00ff':''}">${c.suitLabel}${c.reversed?' · ⊗':''}</div>
        </div>
      </div>
      ${labels[i] ? `<div class="tarot-position-label">${labels[i]}</div>` : ''}
    </div>`;
  }).join('');

  if (desc) desc.style.display = 'none';
}

function flipTarotCard(i) {
  if (drawnCards[i] === undefined) return;
  const el = document.getElementById(`tcard-${i}`);
  if (!el) return;
  el.classList.toggle('flipped');
  if (el.classList.contains('flipped')) flippedCards.add(i);
  else flippedCards.delete(i);
  renderTarotDescriptions();
}

function renderTarotDescriptions() {
  const desc = document.getElementById('tarot-desc');
  if (!desc) return;
  if (flippedCards.size === 0) { desc.style.display = 'none'; return; }

  const labels = TAROT_SPREAD_LABELS[tarotMode] || [''];
  const all = [...flippedCards].sort();
  const total = all.length;

  desc.style.display = 'block';
  desc.innerHTML = all.map((i, idx) => {
    const c = drawnCards[i];
    const isChaos = c.suit === 'chaos';
    const nameStyle = isChaos ? 'color:#00ffff;text-shadow:0 0 6px #ff00ff;' : 'color:var(--accent2);';
    const label = labels[i] ? `<div style="font-size:11px;font-weight:bold;color:var(--accent);letter-spacing:2px;margin-bottom:5px;text-shadow:0 0 6px var(--accent)">◈ ${labels[i]}</div>` : '';
    const revTag = c.reversed ? `<span style="color:var(--cursec);font-size:9px"> [перевёрнута]</span>` : '';
    const meaning = c.reversed
      ? `<span class="tarot-desc-rev">⊗ ${c.rx}</span>`
      : `⟡ ${c.up}`;
    const sep = idx < total-1 ? `border-bottom:1px dashed var(--border);margin-bottom:8px;padding-bottom:8px;` : '';
    return `<div style="${sep}">
      ${label}<b style="${nameStyle};font-size:14px">${c.name}</b>${revTag}<br><div style="margin-top:4px">${meaning}</div>
    </div>`;
  }).join('');
}

// ===== РУНЫ =====
let thrownRunes = [];

function renderRunesSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">ᚱ СЛАВЯНСКИЕ РУНЫ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:12px">
      Задай вопрос. Три руны откроют прошлое, настоящее и путь.
    </div>
    <button class="btn primary" onclick="throwRunes()">ᚨ Бросить руны</button>
    <div class="rune-spread" id="rune-spread" style="margin-top:14px"></div>
    <div class="rune-meanings" id="rune-meanings"></div>
  </div>`;
}

function throwRunes() {
  const pool = [...SLAVIC_RUNES];
  thrownRunes = [];
  const positions = ['Прошлое','Настоящее','Путь'];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const rune = {...pool.splice(idx, 1)[0]};
    rune.reversed = Math.random() < 0.4;
    rune.position = positions[i];
    thrownRunes.push(rune);
  }
  const spread = document.getElementById('rune-spread');
  const meanings = document.getElementById('rune-meanings');
  if (!spread) return;
  spread.innerHTML = thrownRunes.map((r, i) => `
    <div class="rune-wrap">
      <div class="rune-tile face-down" id="rtile-${i}" style="background:${r.col};animation-delay:${i*0.3}s" onclick="revealRune(${i})">✦</div>
      <div class="rune-name" id="rname-${i}" style="display:none">${r.name}</div>
      <div class="rune-pos">${r.position}</div>
    </div>`).join('');
  if (meanings) meanings.innerHTML = '';
  thrownRunes.forEach((_, i) => setTimeout(() => revealRune(i), 400 + i * 500));
}

function revealRune(i) {
  const r = thrownRunes[i];
  if (!r) return;
  const tile = document.getElementById(`rtile-${i}`);
  const nameEl = document.getElementById(`rname-${i}`);
  if (!tile) return;
  if (r.svg) {
    tile.innerHTML = r.svg;
  } else {
    tile.textContent = r.sym;
  }
  let tileTransform = '';
  if (r.mirrorH)  tileTransform += ' scaleX(-1)';
  if (r.mirrorV)  tileTransform += ' scaleY(-1)';
  if (r.scaleY)   tileTransform += ` scaleY(${r.scaleY})`;
  if (r.scaleX)   tileTransform += ` scaleX(${r.scaleX})`;
  if (tileTransform) tile.style.transform = tileTransform.trim();
  tile.style.background = '';
  tile.style.color = '';
  tile.classList.remove('face-down');
  tile.classList.add('revealed');
  if (r.reversed) tile.classList.add('rune-reversed');
  if (nameEl) nameEl.style.display = 'block';
  const meanings = document.getElementById('rune-meanings');
  if (!meanings) return;
  const existing = document.getElementById(`rmean-${i}`);
  if (existing) return;
  const div = document.createElement('div');
  div.id = `rmean-${i}`;
  div.className = 'rune-meaning-block';
  div.style.animationDelay = (i * 0.2) + 's';
  div.innerHTML = `
    <div class="rune-meaning-title">${r.position} · ${r.sym} ${r.name}${r.reversed ? ' [перевёрнутая]' : ''}</div>
    ${r.reversed
      ? `<span class="rune-meaning-rev">⊗ ${r.rx}</span>`
      : `⟡ ${r.up}`}`;
  meanings.appendChild(div);
}

// ===== ЛИДЕРБОРД =====
function renderLeaderboard() {
  const el = document.getElementById('sb-leaderboard');
  if (!el) return;
  const sorted = [...DB.users].sort((a,b) => (b.karma||0) - (a.karma||0)).slice(0, 10);
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--textd);font-size:9px">Нет данных</div>'; return; }
  el.innerHTML = sorted.map((u, i) => `
    <div class="lb-row">
      <span class="lb-rank">${i+1}</span>
      <span style="font-size:12px">${u.avatar||'?'}</span>
      <span class="lb-name" onclick="openUserPage('${u.name}')">${escapeHtml(u.name)}</span>
      <span class="lb-karma">${u.karma||0}</span>
    </div>`).join('');
}

function insertAdminSnippet(sel) {
  const val = sel.value;
  sel.value = '';
  if (!val) return;
  const pair = ADMIN_SNIPPETS[val];
  if (!pair) return;
  const ta = document.getElementById(activeComposeId) || document.getElementById('compose-text');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  ta.value = ta.value.substring(0, start) + pair[0] + selected + pair[1] + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + pair[0].length + selected.length;
  ta.focus();
  const lenEl = document.getElementById('compose-len');
  if (lenEl) lenEl.textContent = ta.value.length;
}

// ===== МИНИ-ИГРЫ =====
const DICE_TYPES = [
  { label:'d2',   sides:2,   shape:'◐' },
  { label:'d4',   sides:4,   shape:'◆' },
  { label:'d6',   sides:6,   shape:'■' },
  { label:'d8',   sides:8,   shape:'◈' },
  { label:'d10',  sides:10,  shape:'⬟' },
  { label:'d12',  sides:12,  shape:'⬡' },
  { label:'d20',  sides:20,  shape:'△' },
  { label:'d100', sides:100, shape:'○' },
];

const PLANETS = [
  { name:'Солнце',              desc:'Ядро. Осознанная воля, эго, центральный процесс, проявление инициативы, проливание света на ситуацию.' },
  { name:'Луна',                desc:'Фоновый процесс. Подсознание, эмоции, базовая потребность в безопасности, память, инстинктивная адаптация.' },
  { name:'Меркурий',            desc:'Маршрутизатор. Обмен информацией, логика, сухой анализ, переговоры, логистика, короткие контакты.' },
  { name:'Венера',              desc:'Сборка ресурсов. Накопление энергии, притяжение, поиск гармонии, материальные и личные ценности, комфорт.' },
  { name:'Марс',                desc:'Импульс. Агрессия, кинетическая энергия, прорыв, конфликт, действие напролом, отсечение лишнего.' },
  { name:'Юпитер',              desc:'Масштабирование. Расширение влияния, выход за рамки, глобальная стратегия, удача, покровительство.' },
  { name:'Сатурн',              desc:'Брандмауэр. Жесткая структура, ограничение, дисциплина, кармический долг, время, проверка на прочность.' },
  { name:'Уран',                desc:'Системный сбой. Внезапный инсайт, разрушение старого порядка, хаос, революция, резкий разрыв шаблона.' },
  { name:'Нептун',              desc:'Искажение. Туман, иллюзии, скрытые процессы, потеря фокуса, неясность, растворение границ.' },
  { name:'Плутон',              desc:'Форматирование. Тотальная трансформация через кризис, разрушение до основания, власть, очистка.' },
  { name:'Лилит / Чёрная Луна', desc:'Уязвимость. Системный баг, слепая зона, провокация, утечка энергии, искушение.' },
  { name:'Кармические Узлы',    desc:'Вектор. Неизбежное столкновение: старый сценарий (от которого нужно отказаться) и новый путь (которого требует система).' },
];

const HOUSES = [
  { name:'Дом I — Личность',        desc:'Ты сам, твоё физическое тело, личная инициатива, фасад, с которым ты выходишь в мир.' },
  { name:'Дом II — Ресурсы',         desc:'Твои личные финансы, имущество, материальная база, запас физических сил.' },
  { name:'Дом III — Ближний круг',   desc:'Повседневные коммуникации, короткие поездки, контакты, братья, соседи, базовое обучение.' },
  { name:'Дом IV — Фундамент',       desc:'Семья, место жительства, корни, базовая безопасность, скрытая опора.' },
  { name:'Дом V — Создание',         desc:'Творчество, страсть, риск, азарт, дети — в том числе проекты как дети.' },
  { name:'Дом VI — Рутина',          desc:'Повседневные обязанности, наёмный труд, быт, здоровье, обслуживание системы.' },
  { name:'Дом VII — Партнёрство',    desc:'Другие люди 1 на 1. Романтические партнёры, деловые союзы, открытые враги и конкуренты.' },
  { name:'Дом VIII — Кризис',        desc:'Деньги других людей (банки, налоги, долги), экстремальные ситуации, стресс, глубокая трансформация.' },
  { name:'Дом IX — Горизонты',       desc:'Дальние цели, высшие знания, мировоззрение, дальние путешествия, инстанции, выход за локальные рамки.' },
  { name:'Дом X — Статус',           desc:'Высшая точка достижений, карьера, начальники, власть, официальная структура подчинения.' },
  { name:'Дом XI — Единомышленники', desc:'Сообщества, группы людей, объединённых одной идеей, друзья, надежды и планы на будущее.' },
  { name:'Дом XII — Изоляция',       desc:'Скрытые процессы, тайны, уход в себя, скрытые враги и слепые зоны.' },
];

const SPHERE_ANSWERS = [
  { range:[10,14], text:'Точно нет',       color:'#cc2200', glow:'rgba(200,30,0,.5)'    },
  { range:[15,20], text:'Скорее нет',      color:'#884400', glow:'rgba(130,60,0,.4)'    },
  { range:[21,25], text:'Маловероятно',    color:'#665500', glow:'rgba(100,80,0,.4)'    },
  { range:[26,29], text:'Туман. Спроси иначе', color:'var(--textd)', glow:'rgba(100,100,100,.3)' },
  { range:[30,31], text:'Неясно',          color:'var(--accent2)', glow:'rgba(150,150,0,.3)' },
  { range:[32,35], text:'Возможно',        color:'#558800', glow:'rgba(80,130,0,.4)'    },
  { range:[36,40], text:'Скорее да',       color:'#228844', glow:'rgba(30,130,60,.4)'   },
  { range:[41,45], text:'Вероятно да',     color:'#00aa44', glow:'rgba(0,160,60,.5)'    },
  { range:[46,50], text:'Точно да',        color:'#00dd66', glow:'rgba(0,200,80,.6)'    },
];

let activeDie = 6;
let activeMiniGame = null;

function renderMinigames() {
  if (activeMiniGame) { _renderActiveMiniGame(); return; }
  document.getElementById('minigames-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:680px">
      <div class="mg-card" onclick="openMiniGame('natal')">
        <div class="mg-card-icon">☿</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Натальная карта</div>
          <div class="mg-card-desc">Планеты · знаки · аспекты · Asс · MC · бесплатно</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('oracle')">
        <div class="mg-card-icon">☽</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Оракул дня</div>
          <div class="mg-card-desc">Один сигнал в сутки · таро, руны, футарк</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('dice')">
        <div class="mg-card-icon">💎</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Самоцветы</div>
          <div class="mg-card-desc">Бросок костей · d2 до d100</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('bones')">
        <div class="mg-card-icon">🪐</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Кости судьбы</div>
          <div class="mg-card-desc">Астрологический оракул · планеты и дома</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('sphere')">
        <div class="mg-card-icon">🔮</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Сфера судьбы</div>
          <div class="mg-card-desc">Задай вопрос — получи ответ</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('tarot')">
        <div class="mg-card-icon">🃏</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Таро</div>
          <div class="mg-card-desc">78 карт · одна или три · прямая и перевёрнутая</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('runes')">
        <div class="mg-card-icon">ᚱ</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Славянские руны</div>
          <div class="mg-card-desc">18 рун · расклад трёх · прямая и перевёрнутая</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('norse')">
        <div class="mg-card-icon">ᚠ</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Скандинавские руны</div>
          <div class="mg-card-desc">24 руны Футарка · расклад трёх · прямая и перевёрнутая</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <!-- Армонские руны временно скрыты
      <div class="mg-card" onclick="openMiniGame('armanist')">
        <div class="mg-card-icon">ᚷ</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Армонские руны</div>
          <div class="mg-card-desc">18 рун Гвидо фон Листа · оккультный Арманизм</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      -->
      <div class="mg-card" onclick="openMiniGame('playing')">
        <div class="mg-card-icon">♠</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Картомантия</div>
          <div class="mg-card-desc">54 карты · ♥ ♦ ♣ ♠ + 2 Джокера · гадание на картах</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
      <div class="mg-card" onclick="openMiniGame('lenormand')">
        <div class="mg-card-icon">🎴</div>
        <div class="mg-card-info">
          <div class="mg-card-name">Ленорман</div>
          <div class="mg-card-desc">36 карт · Большое таблó 9×4 · земной оракул</div>
        </div>
        <div class="mg-card-arr">▶</div>
      </div>
    </div>`;
}

function openMiniGame(name) { activeMiniGame = name; _renderActiveMiniGame(); }
function closeMiniGame() { activeMiniGame = null; renderMinigames(); }

function _renderActiveMiniGame() {
  const back = `<button class="btn sm" onclick="closeMiniGame()" style="margin-bottom:10px">← Назад</button>`;
  let body = '';
  if (activeMiniGame === 'dice')   body = renderDiceSection();
  if (activeMiniGame === 'bones')  body = renderBonesSection();
  if (activeMiniGame === 'sphere') body = renderSphereSection();
  if (activeMiniGame === 'natal')     body = renderNatalSection();
  if (activeMiniGame === 'oracle')    body = renderOracleSection();
  if (activeMiniGame === 'tarot')    body = renderTarotSection();
  if (activeMiniGame === 'runes')    body = renderRunesSection();
  if (activeMiniGame === 'norse')    body = renderNorseRunesSection();
  if (activeMiniGame === 'armanist') body = renderArmanistSection();
  if (activeMiniGame === 'playing')  body = renderPlayingCardsSection();
  if (activeMiniGame === 'lenormand')body = renderLenormandSection();
  document.getElementById('minigames-content').innerHTML = back + body;
}

function renderDiceSection() {
  return `<div class="profile-section dice-section">
    <div class="profile-section-title">💎 САМОЦВЕТЫ — БРОСОК КОСТЕЙ</div>
    <div class="dice-types" id="dice-types">
      ${DICE_TYPES.map(d=>`
        <div class="die-btn${d.sides===activeDie?' active':''}" onclick="selectDie(${d.sides})" title="${d.label}">
          <div class="die-shape">${d.shape}</div>
          <div class="die-label">${d.label}</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="color:var(--textd);font-size:10px">Количество:</span>
      <input id="dice-count" type="number" min="1" max="20" value="1"
        style="width:50px;font-size:10px;padding:2px 4px">
      <button class="btn primary" onclick="rollDice()">⟡ Бросить</button>
      <button class="btn sm" onclick="clearDice()">✕</button>
    </div>
    <div class="dice-table" id="dice-table">
      <div class="dice-table-empty" id="dice-empty">Здесь упадут кубики...</div>
    </div>
    <div id="dice-sum" class="dice-sum"></div>
  </div>`;
}

function selectDie(sides) {
  activeDie = sides;
  document.querySelectorAll('.die-btn').forEach((btn,i)=>{
    btn.classList.toggle('active', DICE_TYPES[i].sides === sides);
  });
}

function rollDice() {
  const count = Math.min(20, Math.max(1, parseInt(document.getElementById('dice-count').value)||1));
  const table = document.getElementById('dice-table');
  const empty = document.getElementById('dice-empty');
  const sumEl = document.getElementById('dice-sum');
  if(!table) return;
  if(empty) empty.style.display='none';

  const dieType = DICE_TYPES.find(d=>d.sides===activeDie)||DICE_TYPES[1];
  let total = 0;
  const results = [];
  for(let i=0;i<count;i++){
    const val = Math.floor(Math.random()*activeDie)+1;
    results.push(val); total += val;
  }

  results.forEach((val,i)=>{
    setTimeout(()=>{
      const isMax = val===activeDie, isMin = val===1;
      const el=document.createElement('div');
      el.className='die-result'+(isMax?' max':'')+(isMin?' min':'');
      el.style.animationDelay = (i*0.08)+'s';
      el.innerHTML=`<div class="die-result-num">${val}</div><div class="die-result-type">${dieType.shape}</div>`;
      el.title=dieType.label;
      table.appendChild(el);
      if(sumEl) sumEl.textContent = `Сумма: ${total}  (${count}${dieType.label})`;
    }, i*80);
  });
}

function clearDice() {
  const table=document.getElementById('dice-table');
  const sumEl=document.getElementById('dice-sum');
  if(table) table.innerHTML='<div class="dice-table-empty" id="dice-empty">Здесь упадут кубики...</div>';
  if(sumEl) sumEl.textContent='';
}

// ===== КОСТИ СУДЬБЫ =====
function renderBonesSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">🪐 КОСТИ СУДЬБЫ — АСТРОЛОГИЧЕСКИЙ ОРАКУЛ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:12px">Два куба d12. Первый — планета. Второй — астрологический дом.</div>
    <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:80px">
        <label style="color:var(--textd);font-size:9px;letter-spacing:1px">КУБ I — СИЛА</label>
        <input type="number" id="bones-c1" min="1" max="12" value="1">
      </div>
      <div class="field" style="flex:1;min-width:80px">
        <label style="color:var(--textd);font-size:9px;letter-spacing:1px">КУБ II — СФЕРА</label>
        <input type="number" id="bones-c2" min="1" max="12" value="1">
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn sm" onclick="rollBones()">⟡ Бросить кубы</button>
      <button class="btn primary" onclick="readBones()">★ Предсказать</button>
    </div>
    <div id="bones-output" class="bones-output">
      <span style="color:var(--textd);font-style:italic">Брось кубы и узнай предсказание...</span>
    </div>
  </div>`;
}

function rollBones() {
  const c1 = document.getElementById('bones-c1');
  const c2 = document.getElementById('bones-c2');
  if(!c1||!c2) return;
  c1.value = Math.ceil(Math.random()*12);
  c2.value = Math.ceil(Math.random()*12);
}

function readBones() {
  const c1 = parseInt(document.getElementById('bones-c1').value);
  const c2 = parseInt(document.getElementById('bones-c2').value);
  const out = document.getElementById('bones-output');
  if(!out) return;
  if(isNaN(c1)||isNaN(c2)||c1<1||c1>12||c2<1||c2>12){
    out.innerHTML='<span style="color:var(--adminc)">⚠ Значения должны быть от 1 до 12.</span>'; return;
  }
  const p = PLANETS[c1-1];
  const h = HOUSES[c2-1];
  out.innerHTML = `
    <div class="bones-block">
      <div class="bones-label">ПЛАНЕТА</div>
      <div class="bones-name">${p.name}</div>
      <div class="bones-desc">${p.desc}</div>
    </div>
    <div class="bones-block" style="margin-top:10px">
      <div class="bones-label">АСТРАЛЬНЫЙ ДОМ</div>
      <div class="bones-name">${h.name}</div>
      <div class="bones-desc">${h.desc}</div>
    </div>`;
}

// ===== СФЕРА СУДЬБЫ =====
function renderSphereSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">🔮 СФЕРА СУДЬБЫ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:14px">Сосредоточься на вопросе. Задай его сфере.</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
      <div class="sphere-orb" id="sphere-orb">
        <div class="sphere-inner" id="sphere-inner">?</div>
      </div>
      <button class="btn primary" onclick="rollSphere()" style="padding:5px 24px;letter-spacing:1px">
        ⊷ Задать вопрос
      </button>
      <div id="sphere-answer" class="sphere-answer"></div>
    </div>
  </div>`;
}

function rollSphere() {
  let total = 0;
  for(let i=0;i<10;i++) total += Math.floor(Math.random()*5)+1;

  const entry = SPHERE_ANSWERS.find(a => total >= a.range[0] && total <= a.range[1])
              || SPHERE_ANSWERS[4];

  const orb = document.getElementById('sphere-orb');
  const inner = document.getElementById('sphere-inner');
  const answerEl = document.getElementById('sphere-answer');
  if(!orb||!inner||!answerEl) return;

  orb.classList.add('sphere-rolling');
  inner.textContent = '...';
  inner.style.color = 'var(--textd)';
  answerEl.style.opacity = '0';

  setTimeout(()=>{
    orb.classList.remove('sphere-rolling');
    inner.textContent = entry.text;
    inner.style.color = entry.color;
    inner.style.textShadow = `0 0 12px ${entry.glow}`;
    orb.style.boxShadow = `0 0 30px ${entry.glow}, inset 0 0 20px rgba(0,0,0,.6)`;
    answerEl.innerHTML = `<span style="color:${entry.color};font-size:13px;font-weight:bold;text-shadow:0 0 8px ${entry.glow}">${entry.text}</span>`;
    answerEl.style.opacity = '1';
  }, 900);
}

// ===== МИР (TILE-BASED MULTIPLAYER) =====
// const TILE_SIZE = 12;
// const MAP_W = 50, MAP_H = 50;
// const CANVAS_W = TILE_SIZE * MAP_W;  // 600
// const CANVAS_H = TILE_SIZE * MAP_H;  // 600

// ---- Карта ----
// const TILE_PAL = {
//   water:  ['#0b2844','#0d3050','#0a263e'],
//   shore:  ['#1a4015','#1e4a18','#163812'],
//   grass:  ['#1c420e','#224d10','#183c0c'],
//   grass2: ['#264510','#2c5013','#213e0e'],
//   forest: ['#0e2a06','#112e08','#0b2505'],
//   rock:   ['#2a2620','#302c22','#24201c'],
// };

// let worldMap      = null;   // [row][col] = tiletype string
// let worldBgCanvas = null;   // pre-rendered background

// ---- Спрайты ----
// const WORLD_SPRITES   = {};
// const SPRITE_FILES    = ['Hero-Mage','Hero-Knight','Hero-Ranger','Ghost'];
// let   worldSpritesReady = false;

// ---- Lerp (плавное движение) ----
// name → {fx,fy, tx,ty, t, dir, moving}
// let worldLerps = {};

// ---- RAF ----
// let worldRafId  = null;
// let worldLastTs = 0;

// ===================== СПРАЙТЫ =====================
// async function loadWorldAssets() {
//   if(worldSpritesReady) return;
//   for(const name of SPRITE_FILES) {
//     const s = await UGS.load(`assets/${name}.ugs`);
//     if(s) WORLD_SPRITES[name] = s;
//   }
//   worldSpritesReady = true;
// }
// function getSpriteForUser(u) {
//   const hash = [...u.name].reduce((a,c) => a+c.charCodeAt(0), 0);
//   const avail = SPRITE_FILES.filter(n => WORLD_SPRITES[n]);
//   if(!avail.length) return null;
//   return WORLD_SPRITES[avail[hash % avail.length]];
// }

// ===================== ГЕНЕРАЦИЯ КАРТЫ =====================
// function _wHash(x, y) {
//   let h = (x*374761393 + y*668265263 + 2246822519) >>> 0;
//   h = ((h ^ (h>>>13)) * 1274126177) >>> 0;
//   return ((h ^ (h>>>16)) >>> 0) / 4294967296;
// }
// function _smooth(x, y, sc) {
//   const fx=x/sc,fy=y/sc,ix=Math.floor(fx)|0,iy=Math.floor(fy)|0;
//   const dx=fx-ix,dy=fy-iy,s=t=>3*t*t-2*t*t*t;
//   const a=_wHash(ix,iy),b=_wHash(ix+1,iy),c=_wHash(ix,iy+1),d=_wHash(ix+1,iy+1);
//   return a*(1-s(dx))*(1-s(dy))+b*s(dx)*(1-s(dy))+c*(1-s(dx))*s(dy)+d*s(dx)*s(dy);
// }
// function _tv(x,y){ return _smooth(x,y,10)*0.55+_smooth(x,y,4)*0.3+_smooth(x,y,2)*0.15; }
// function _tileType(x,y){
//   const n=_tv(x,y);
//   if(n<0.22) return 'water';
//   if(n<0.28) return 'shore';
//   if(n<0.57) return 'grass';
//   if(n<0.70) return 'grass2';
//   if(n<0.84) return 'forest';
//   return 'rock';
// }
// function initWorldMap(){
//   if(worldMap) return;
//   worldMap=[];
//   for(let y=0;y<MAP_H;y++){ worldMap[y]=[]; for(let x=0;x<MAP_W;x++) worldMap[y][x]=_tileType(x,y); }
// }
// function buildWorldBg(){
//   initWorldMap();
//   const c=document.createElement('canvas'); c.width=CANVAS_W; c.height=CANVAS_H;
//   const ctx=c.getContext('2d');
//   for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
//     const type=worldMap[y][x],pal=TILE_PAL[type]||TILE_PAL.grass;
//     const hi=(x*3+y*7)%pal.length;
//     const px=x*TILE_SIZE,py=y*TILE_SIZE;
//     ctx.fillStyle=pal[hi]; ctx.fillRect(px,py,TILE_SIZE,TILE_SIZE);
//     ctx.fillStyle='rgba(0,0,0,0.18)';
//     ctx.fillRect(px+TILE_SIZE-1,py,1,TILE_SIZE);
//     ctx.fillRect(px,py+TILE_SIZE-1,TILE_SIZE,1);
//     if(type==='water'&&(x+y)%5===0){ctx.fillStyle='rgba(80,160,255,0.08)';ctx.fillRect(px+2,py+2,TILE_SIZE-4,2);}
//     if((type==='grass'||type==='grass2')&&(x+y)%7===0){ctx.fillStyle='rgba(255,255,200,0.04)';ctx.fillRect(px+3,py+3,2,2);}
//   }
//   worldBgCanvas=c;
// }

// ===================== LERP-ДВИЖЕНИЕ =====================
// function _easeIO(t){ return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }
// function _dirFrom(dx,dy){
//   if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5) return 0;
//   const a=Math.atan2(dy,dx)*180/Math.PI;
//   if(a>112.5||a<-112.5) return 2;
//   if(a>67.5)  return 1;
//   if(a>22.5)  return 0;
//   if(a>-22.5) return 6;
//   if(a>-67.5) return 7;
//   if(a>-112.5)return 4;
//   return 0;
// }
// function _initLerp(u){
//   const p=u.worldPos||{tileX:10,tileY:10};
//   if(!worldLerps[u.name])
//     worldLerps[u.name]={fx:p.tileX,fy:p.tileY,tx:p.tileX,ty:p.tileY,t:1,dir:0,moving:false};
// }
// function _startMove(name,toX,toY){
//   const lr=worldLerps[name]; if(!lr) return;
//   if(lr.tx===toX&&lr.ty===toY) return;
//   const et=_easeIO(Math.min(1,lr.t));
//   const vx=lr.fx+(lr.tx-lr.fx)*et, vy=lr.fy+(lr.ty-lr.fy)*et;
//   lr.dir=_dirFrom(toX-vx,toY-vy);
//   lr.fx=vx; lr.fy=vy; lr.tx=toX; lr.ty=toY; lr.t=0; lr.moving=true;
// }

// ===================== RENDER WORLD =====================
// function renderWorld(){
//   initWorldMap();
//   if(ME.worldPos&&ME.worldPos.x!==undefined&&ME.worldPos.tileX===undefined){
//     ME.worldPos={tileX:Math.max(0,Math.min(MAP_W-1,Math.floor(ME.worldPos.x/TILE_SIZE))),
//                  tileY:Math.max(0,Math.min(MAP_H-1,Math.floor(ME.worldPos.y/TILE_SIZE)))};
//     updateUser(ME); save();
//   }
//   if(!ME.worldPos||ME.worldPos.tileX===undefined){
//     let tx,ty; do{tx=5+Math.floor(Math.random()*40);ty=5+Math.floor(Math.random()*40);}
//     while(worldMap[ty]&&worldMap[ty][tx]==='water');
//     ME.worldPos={tileX:tx,tileY:ty}; updateUser(ME); save();
//   }
//   if(!worldBgCanvas) buildWorldBg();

//   document.getElementById('world-content').innerHTML=
//     `<div style="position:relative">
//        <canvas id="world-canvas" width="${CANVAS_W}" height="${CANVAS_H}"
//          style="display:block;cursor:crosshair;border:1px solid var(--borderg);image-rendering:pixelated;max-width:100%"></canvas>
//        <div style="font-size:9px;color:var(--textd);margin-top:4px">
//          Кликни по карте — твой герой пойдёт туда · По воде нельзя
//        </div>
//      </div>`;
//   document.getElementById('world-canvas').addEventListener('click', handleWorldClick);
//   DB.users.filter(u=>u.worldPos&&u.worldPos.tileX!==undefined).forEach(_initLerp);
//   _initLerp(ME);
//   loadWorldAssets();
//   if(worldRafId) cancelAnimationFrame(worldRafId);
//   worldLastTs=0;
//   function _loop(ts){
//     if(!document.getElementById('world-canvas')){worldRafId=null;return;}
//     const dt=worldLastTs?(ts-worldLastTs)/1000:0; worldLastTs=ts;
//     _tickWorld(dt); drawWorld();
//     worldRafId=requestAnimationFrame(_loop);
//   }
//   worldRafId=requestAnimationFrame(_loop);
// }

// function _tickWorld(dt){
//   const SPEED=3.0;
//   for(const name in worldLerps){
//     const lr=worldLerps[name];
//     if(lr.t<1){lr.t=Math.min(1,lr.t+dt*SPEED);if(lr.t>=1)lr.moving=false;}
//   }
//   DB.users.filter(u=>u.worldPos&&u.worldPos.tileX!==undefined).forEach(u=>{
//     if(!worldLerps[u.name]) _initLerp(u);
//     const lr=worldLerps[u.name];
//     if(lr.tx!==u.worldPos.tileX||lr.ty!==u.worldPos.tileY) _startMove(u.name,u.worldPos.tileX,u.worldPos.tileY);
//   });
// }

// function stopWorldAnim(){
//   if(worldRafId){cancelAnimationFrame(worldRafId);worldRafId=null;}
// }

// function handleWorldClick(e){
//   const canvas=e.currentTarget,rect=canvas.getBoundingClientRect();
//   const tx=Math.floor((e.clientX-rect.left)*(CANVAS_W/rect.width)/TILE_SIZE);
//   const ty=Math.floor((e.clientY-rect.top)*(CANVAS_H/rect.height)/TILE_SIZE);
//   const cx=Math.max(0,Math.min(MAP_W-1,tx)),cy=Math.max(0,Math.min(MAP_H-1,ty));
//   if(worldMap&&worldMap[cy]&&worldMap[cy][cx]==='water') return;
//   _startMove(ME.name,cx,cy);
//   ME.worldPos={tileX:cx,tileY:cy}; updateUser(ME); save();
// }

// function drawWorld(){
//   const canvas=document.getElementById('world-canvas'); if(!canvas) return;
//   const ctx=canvas.getContext('2d');
//   const cs=getComputedStyle(document.documentElement);
//   const cAccent=cs.getPropertyValue('--accent').trim()||'#ff6600';
//   const cText=cs.getPropertyValue('--text').trim()||'#c8a060';
//   const cBg=cs.getPropertyValue('--bg').trim()||'#100c04';
//   if(worldBgCanvas) ctx.drawImage(worldBgCanvas,0,0);
//   else{ctx.fillStyle='#0a1a08';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);}

//   const players=DB.users.filter(u=>u.worldPos&&u.worldPos.tileX!==undefined);
//   players.forEach(u=>{if(!worldLerps[u.name])_initLerp(u);});
//   players.sort((a,b)=>{
//     const la=worldLerps[a.name],lb=worldLerps[b.name];
//     const ya=la?la.fy+(la.ty-la.fy)*_easeIO(Math.min(1,la.t)):0;
//     const yb=lb?lb.fy+(lb.ty-lb.fy)*_easeIO(Math.min(1,lb.t)):0;
//     return ya-yb;
//   });
//   players.forEach(u=>{
//     const isMe=u.name===ME.name,lr=worldLerps[u.name]; if(!lr) return;
//     const et=_easeIO(Math.min(1,lr.t));
//     const vx=(lr.fx+(lr.tx-lr.fx)*et)*TILE_SIZE+TILE_SIZE/2;
//     const vy=(lr.fy+(lr.ty-lr.fy)*et)*TILE_SIZE+TILE_SIZE;
//     const moving=lr.moving||lr.t<1;
//     const animF=moving?Math.floor(performance.now()/130)%8:0;

//     ctx.globalAlpha=0.18;ctx.fillStyle='#000';
//     ctx.beginPath();ctx.ellipse(vx,vy+TILE_SIZE*0.3,TILE_SIZE*0.7,TILE_SIZE*0.2,0,0,Math.PI*2);ctx.fill();
//     ctx.globalAlpha=1;

//     const sprite=getSpriteForUser(u);
//     const SW=TILE_SIZE*2,SH=TILE_SIZE*2.5;
//     if(sprite){
//       const frm=UGS.getFrame(sprite,lr.dir,animF);
//       if(frm) ctx.drawImage(frm,vx-SW/2,vy-SH,SW,SH);
//     } else {
//       ctx.font=`${TILE_SIZE*1.5}px serif`;ctx.textAlign='center';ctx.textBaseline='bottom';
//       ctx.fillText(u.avatar||'?',vx,vy);
//     }

//     if(isMe){
//       ctx.strokeStyle=cAccent;ctx.lineWidth=1;ctx.globalAlpha=0.5;
//       ctx.strokeRect(vx-TILE_SIZE,vy-TILE_SIZE*2.3,TILE_SIZE*2,TILE_SIZE*2.3);
//       ctx.globalAlpha=1;
//     }

//     const nick=u.name.length>11?u.name.substring(0,10)+'…':u.name;
//     ctx.font='bold 8px Tahoma,sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
//     const tw=ctx.measureText(nick).width+6;
//     ctx.globalAlpha=0.6;ctx.fillStyle=cBg;ctx.fillRect(vx-tw/2,vy+2,tw,11);
//     ctx.globalAlpha=1;ctx.fillStyle=isMe?cAccent:cText;ctx.fillText(nick,vx,vy+3);
//   });
// }

// ===== ОРАКУЛ ДНЯ =====
function renderOracleSection() {
  const now = Date.now();
  const oracle = ME.oracle;
  const isStale = !oracle || (now - oracle.ts) >= 86400000;

  if (isStale) {
    const type = ['tarot','slavic','norse','playing','lenormand'][Math.floor(Math.random()*5)];
    let card;
    if (type==='tarot') {
      const deck=[...TAROT_CARDS,{...CHAOS_CARD}];
      card={...deck[Math.floor(Math.random()*deck.length)]};
    } else if (type==='slavic') {
      card={...SLAVIC_RUNES[Math.floor(Math.random()*SLAVIC_RUNES.length)]};
    } else if (type==='norse') {
      card={...NORSE_RUNES[Math.floor(Math.random()*NORSE_RUNES.length)]};
    } else if (type==='playing') {
      card={...PLAYING_CARDS[Math.floor(Math.random()*PLAYING_CARDS.length)]};
    } else {
      card={...LENORMAND_CARDS[Math.floor(Math.random()*LENORMAND_CARDS.length)]};
    }
    card.reversed = Math.random()<0.35;
    ME.oracle = {ts:now, type, card};
    updateUser(ME); save();
  }

  const o = ME.oracle;
  const c = o.card;
  const left = Math.max(0, 86400000-(now-o.ts));
  const hLeft = Math.floor(left/3600000);
  const mLeft = Math.floor((left%3600000)/60000);
  const typeLabel = {tarot:'🃏 Таро', slavic:'ᚱ Слав. руны', norse:'ᚠ Футарк', playing:'♠ Карты', lenormand:'🎴 Ленорман'}[o.type]||'';
  const sym = c.svg
    ? c.svg
    : `<span style="font-size:28px">${c.sym||c.id||'?'}</span>`;

  return `<div class="profile-section">
    <div class="profile-section-title">☽ ОРАКУЛ ДНЯ</div>
    <div style="color:var(--textd);font-size:9px;margin-bottom:12px;letter-spacing:1px">
      ОБНОВЛЕНИЕ ЧЕРЕЗ: <span style="color:var(--accent2)">${hLeft}ч ${mLeft}м</span>
    </div>
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div style="text-align:center;min-width:80px">
        <div style="font-size:8px;letter-spacing:2px;color:var(--textd);margin-bottom:6px">${typeLabel}</div>
        <div style="width:72px;height:92px;border:1px solid var(--borderg);background:${c.col||'var(--panel)'};
            display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
            box-shadow:0 0 12px var(--borderg);${c.reversed?'transform:rotate(180deg)':''}">
          ${sym}
          <div style="font-size:8px;color:var(--text);text-align:center;padding:0 3px;${c.reversed?'transform:rotate(180deg)':''}">${c.name}</div>
        </div>
        ${c.reversed?'<div style="font-size:8px;color:var(--cursec);margin-top:3px">⊗ перевёрнута</div>':''}
      </div>
      <div style="flex:1;min-width:160px">
        <div style="color:var(--accent2);font-size:11px;font-weight:bold;margin-bottom:6px">${c.name}</div>
        <div style="font-size:10px;line-height:1.7;color:var(--text)">
          ${c.reversed
            ? `<span style="color:var(--cursec)">⊗ ${c.rx}</span>`
            : `⟡ ${c.up}`}
        </div>
      </div>
    </div>
  </div>`;
}

// ===== ГРУППОВЫЕ ЧАТЫ =====
let curGroupId = null;

function renderGroupChats() {
  const el = document.getElementById('group-dialogs-list');
  if (!el) return;
  const groups = (DB.groupChats||[]).filter(g=>(g.members||[]).includes(ME.name));
  if (!groups.length) {
    el.innerHTML='<div style="color:var(--textd);font-size:9px;padding:6px 8px">Нет групп. Создайте или вступите.</div>';
    return;
  }
  el.innerHTML = groups.map(g=>{
    const last=(g.messages||[]).slice(-1)[0];
    return `<div class="chat-item${curGroupId===g.id?' active':''}" onclick="openGroupChat('${g.id}')">
      <div class="comment-avatar" style="font-size:11px">⟡</div>
      <div style="flex:1;min-width:0">
        <div class="chat-name">${escapeHtml(g.name)}</div>
        <div class="chat-preview">${last?escapeHtml(last.body.substring(0,30)):'...'}</div>
      </div>
    </div>`;
  }).join('');
}

function openGroupChat(id) {
  curGroupId = id;
  const g = (DB.groupChats||[]).find(x=>x.id===id);
  if (!g) return;
  document.getElementById('group-chat-empty').style.display = 'none';
  document.getElementById('group-chat-active').style.display = 'block';
  document.getElementById('group-chat-title').textContent = '⟡ '+g.name+' ('+g.members.length+')';
  const joinBtn = document.getElementById('group-join-btn');
  const isMember = g.members.includes(ME.name);
  joinBtn.textContent = isMember ? 'Покинуть' : '+ Вступить';
  joinBtn.className = 'btn sm'+(isMember?' danger':'');
  renderGroupMessages();
  renderGroupChats();
}

function closeGroupChat() {
  curGroupId = null;
  document.getElementById('group-chat-empty').style.display = 'block';
  document.getElementById('group-chat-active').style.display = 'none';
}

function renderGroupMessages() {
  const el = document.getElementById('group-messages-area');
  if (!el||!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g) return;
  const msgs = g.messages||[];
  el.innerHTML = msgs.map(m=>`
    <div class="msg ${m.from===ME.name?'mine':'theirs'}">
      <div class="msg-author">${m.from} · ${timeAgo(m.ts)}</div>${escapeHtml(m.body)}
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function sendGroupMsg() {
  const inp = document.getElementById('group-msg-input');
  const body = inp ? inp.value.trim() : '';
  if (!body||!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g) return;
  if (!(g.members||[]).includes(ME.name)) { toast('⚠ Вступите в группу, чтобы писать.'); return; }
  if (!g.messages) g.messages=[];
  g.messages.push({id:uid(), from:ME.name, body, ts:Date.now()});
  save(); inp.value='';
  renderGroupMessages(); renderGroupChats();
}

function toggleJoinGroup() {
  if (!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g) return;
  if (!g.members) g.members=[];
  const idx = g.members.indexOf(ME.name);
  if (idx>-1) { g.members.splice(idx,1); toast('Вы покинули группу.'); }
  else { g.members.push(ME.name); toast('Вы вступили в группу.'); }
  save(); openGroupChat(curGroupId);
}

function openCreateGroup() {
  document.getElementById('modal-create-group').classList.add('open');
}

function createGroup() {
  const name = document.getElementById('cg-name').value.trim();
  const desc = document.getElementById('cg-desc').value.trim();
  if (!name) { toast('Введите название группы.'); return; }
  if (!DB.groupChats) DB.groupChats=[];
  const g = {id:uid(), name, desc, creator:ME.name, members:[ME.name], messages:[], ts:Date.now()};
  DB.groupChats.push(g);
  save(); closeModal('modal-create-group');
  document.getElementById('cg-name').value='';
  document.getElementById('cg-desc').value='';
  renderGroupChats();
  renderAllGroups();
  toast('Группа создана.');
  openGroupChat(g.id);
}

function toggleGroupInvite() {
  const panel = document.getElementById('group-invite-panel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const inp = document.getElementById('group-invite-input');
    if (inp) { inp.value = ''; inp.focus(); }
    document.getElementById('group-invite-results').innerHTML = '';
  }
}

function searchGroupInvite() {
  const q = (document.getElementById('group-invite-input')||{}).value.trim().toLowerCase();
  const el = document.getElementById('group-invite-results');
  if (!el) return;
  if (!q) { el.innerHTML = ''; return; }
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  const already = g ? (g.members||[]) : [];
  const results = DB.users.filter(u =>
    u.name !== ME.name &&
    u.name.toLowerCase().includes(q) &&
    !already.includes(u.name)
  ).slice(0,6);
  if (!results.length) {
    el.innerHTML = '<div style="color:var(--textd);font-size:9px;padding:3px">Не найдено или уже в группе</div>';
    return;
  }
  el.innerHTML = results.map(u => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:10px">${u.avatar||'?'} ${escapeHtml(u.name)}</span>
      <button class="btn sm primary" style="font-size:8px;padding:1px 6px" onclick="inviteToGroup('${u.name}')">+ Добавить</button>
    </div>`).join('');
}

function inviteToGroup(userName) {
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g) return;
  if (!g.members) g.members = [];
  if (g.members.includes(userName)) { toast('Уже в группе.'); return; }
  g.members.push(userName);
  // системное сообщение
  if (!g.messages) g.messages = [];
  g.messages.push({id:uid(), from:'⟡ Система', body:`${userName} добавлен в группу`, ts:Date.now()});
  save();
  toast(`${userName} добавлен в группу.`);
  toggleGroupInvite();
  openGroupChat(curGroupId);
}

function openGroupMembers() {
  if (!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g) return;
  const isCreator = g.creator === ME.name || isAdmin();
  const el = document.getElementById('group-members-list');
  if (el) {
    el.innerHTML = (g.members||[]).map(name => {
      const u = DB.users.find(x=>x.name===name)||{avatar:'?'};
      const canKick = isCreator && name !== ME.name;
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:14px">${u.avatar||'?'}</span>
        <span style="flex:1;font-size:10px;color:var(--text)">${escapeHtml(name)}${name===g.creator?' <span style="color:var(--textd);font-size:8px">[создатель]</span>':''}</span>
        ${canKick?`<button class="btn sm danger" style="font-size:8px;padding:1px 5px" onclick="kickFromGroup('${name}')">✕</button>`:''}
      </div>`;
    }).join('');
  }
  document.getElementById('invite-search').value = '';
  document.getElementById('invite-results').innerHTML = '';
  document.getElementById('modal-group-members').classList.add('open');
}

function searchInviteUser() {
  if (!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  const q = (document.getElementById('invite-search').value||'').trim().toLowerCase();
  const el = document.getElementById('invite-results');
  if (!q) { el.innerHTML=''; return; }
  const already = g ? (g.members||[]) : [];
  const results = DB.users.filter(u =>
    u.name.toLowerCase().includes(q) && !already.includes(u.name)
  ).slice(0,6);
  if (!results.length) { el.innerHTML='<div style="color:var(--textd);font-size:9px;padding:4px">Не найдено</div>'; return; }
  el.innerHTML = results.map(u=>`
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">${u.avatar||'?'}</span>
      <span style="flex:1;font-size:10px;color:var(--text)">${escapeHtml(u.name)}</span>
      <button class="btn sm primary" style="font-size:8px;padding:1px 6px" onclick="addToGroup('${u.name}')">+ пригласить</button>
    </div>`).join('');
}

function addToGroup(name) {
  if (!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g) return;
  if (!g.members) g.members=[];
  if (g.members.includes(name)) { toast('Уже состоит в группе.'); return; }
  g.members.push(name);
  save();
  toast(`${name} добавлен в группу.`);
  openGroupMembers();
  openGroupChat(curGroupId);
}

function kickFromGroup(name) {
  if (!curGroupId) return;
  const g = (DB.groupChats||[]).find(x=>x.id===curGroupId);
  if (!g || (g.creator!==ME.name && !isAdmin())) return;
  g.members = g.members.filter(m=>m!==name);
  save();
  toast(`${name} удалён из группы.`);
  openGroupMembers();
  openGroupChat(curGroupId);
}

function toggleGroupInvite() { openGroupMembers(); }

function renderAllGroups() {
  const el = document.getElementById('all-groups-list');
  if (!el) return;
  const all = DB.groupChats||[];
  if (!all.length) { el.innerHTML='<div style="color:var(--textd);font-size:9px;padding:4px 0">Нет групп</div>'; return; }
  el.innerHTML = all.map(g=>{
    const isMember = (g.members||[]).includes(ME.name);
    return `<div class="chat-item" onclick="openGroupChat('${g.id}')">
      <div class="comment-avatar" style="font-size:11px">⟡</div>
      <div style="flex:1;min-width:0">
        <div class="chat-name">${escapeHtml(g.name)}</div>
        <div class="chat-preview">${g.desc||'Без описания'} · ${g.members.length} участников ${isMember?'· <span style="color:var(--resonc)">вы состоите</span>':''}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== РАСКЛАД ЗВЕЗДА (добавляем режим 8 к таро) =====
// Уже обрабатывается через TAROT_SPREAD_LABELS[8] и .tarot-star CSS

// ===== ИГРАЛЬНЫЕ КАРТЫ (54 карты) =====
const _PC_S = [
  {s:'hearts',  sym:'♥', col:'#200005', tc:'#ff4466'},
  {s:'diamonds',sym:'♦', col:'#1a0a00', tc:'#ff8822'},
  {s:'clubs',   sym:'♣', col:'#001a08', tc:'#44cc88'},
  {s:'spades',  sym:'♠', col:'#0a0a18', tc:'#8899ff'},
];
const _PC_V = [
  {v:'A',  n:'Туз'},
  {v:'2',  n:'2'},   {v:'3', n:'3'},   {v:'4', n:'4'},
  {v:'5',  n:'5'},   {v:'6', n:'6'},   {v:'7', n:'7'},
  {v:'8',  n:'8'},   {v:'9', n:'9'},   {v:'10',n:'10'},
  {v:'J',  n:'Валет'},{v:'Q',n:'Дама'},{v:'K', n:'Король'},
];
const _PC_UP = {
  hearts:{
    A:'Новое чувство, открытость сердца. Начало любви или исцеление через принятие.',
    2:'Взаимная симпатия, союз двух. Отношения движутся вперёд.',
    3:'Дружба, общий праздник, поддержка близких.',
    4:'Момент покоя, цени то, что имеешь.',
    5:'Утрата, но не всё потеряно — оглянись назад.',
    6:'Воспоминания прошлого, связь с детством. Кто-то из прошлого возвращается.',
    7:'Мечты и иллюзии. Выбери одно реальное желание.',
    8:'Уход от прошлого ради большего. Больно, но необходимо.',
    9:'Карта желаний — то, что хочешь, сбудется. Самое благоприятное знамение.',
    10:'Счастье, семья, гармония в доме. Любовь достигает полноты.',
    J:'Молодой человек с добрыми намерениями, приходит весть с любовью.',
    Q:'Любящая, интуитивная женщина. Мудрость сердца.',
    K:'Великодушный, эмоционально зрелый мужчина. Понимает, не судит.',
  },
  diamonds:{
    A:'Финансовый старт, новая возможность. Действуй — дверь открыта.',
    2:'Новость, послание, деловые переговоры. Жди информации.',
    3:'Деловое партнёрство. Совместный проект принесёт плоды.',
    4:'Накопление, разумная бережливость. Контроль над ресурсами.',
    5:'Трудный период, беспокойство о деньгах. Но выход есть.',
    6:'Щедрость, баланс давать и получать. Возвращается сторицей.',
    7:'Урожай на подходе — немного терпения. Результаты близко.',
    8:'Мастерство и профессионализм. Деньги через навык.',
    9:'Самодостаточность, достигнутый своим трудом комфорт.',
    10:'Финансовая стабильность, долгосрочный успех.',
    J:'Практичный молодой человек с хорошими идеями для заработка.',
    Q:'Деловая, независимая женщина. Умеет создавать достаток.',
    K:'Щедрый успешный мужчина. Предприниматель, покровитель.',
  },
  clubs:{
    A:'Творческий импульс, новая идея. Твоя воля запускает процесс.',
    2:'Планирование, первые шаги. Смотри вперёд.',
    3:'Первые плоды усилий, расширение. Результаты становятся видны.',
    4:'Торжество, стабильность. Отдохни — ты заслужил.',
    5:'Конкуренция, хаотичная энергия. Борьба закаляет.',
    6:'Победа, признание, публичный успех. Твои заслуги видны.',
    7:'Защита позиции, стойкость под давлением. Держи линию.',
    8:'Быстрые события, ускорение. Действуй немедленно.',
    9:'Последний рубеж. Финиш близко — держись.',
    10:'Тяжёлая ноша ответственности. Несёшь много — но финиш виден.',
    J:'Энергичный, любознательный молодой человек, полный идей.',
    Q:'Харизматичная, уверенная женщина. Всё притягивает к себе.',
    K:'Лидер, вдохновитель, мастер своего дела.',
  },
  spades:{
    A:'Ясность истины, прорыв через иллюзии. Меч разрубает туман.',
    2:'Тупик. Ты знаешь ответ — просто закрыл глаза.',
    3:'Боль, предательство. Это пройдёт — и освободит.',
    4:'Вынужденный отдых, восстановление. Остановись.',
    5:'Конфликт, пиррова победа. Ты победил — но какой ценой?',
    6:'Переход к спокойствию. Уходи от бури к тихой воде.',
    7:'Хитрость, стратегия. Иногда тихо взять — правильно.',
    8:'Ментальная ловушка. Ты сам сковал себя — и сам освободишься.',
    9:'Тревога, ночные страхи. Страхи больше, чем реальность.',
    10:'Окончательный конец. Но рассвет уже начинается.',
    J:'Острый ум, наблюдательность, молодой человек с тайным знанием.',
    Q:'Острый ум, независимость. Видит насквозь.',
    K:'Власть, авторитет. Принимает решения без лишних эмоций.',
  },
};
const _PC_RX = {
  hearts:{A:'Подавленные чувства, разрыв.',2:'Дисбаланс в отношениях.',3:'Предательство среди близких.',4:'Апатия, упущенные возможности.',5:'Зацикленность на боли.',6:'Застревание в прошлом.',7:'Самообман, уход от реальности.',8:'Цепляние за мёртвое.',9:'Желания исполнены — но не те.',10:'Иллюзия счастья, разрыв.',J:'Незрелость, ветреность.',Q:'Манипуляция через жалость.',K:'Холодность под маской тепла.'},
  diamonds:{A:'Упущенный шанс, потери.',2:'Задержка вестей, дезинформация.',3:'Конфликт интересов, нечестность.',4:'Скупость, страх потери.',5:'Принятие помощи как слабость.',6:'Долги, неравный обмен.',7:'Нетерпение, напрасный труд.',8:'Трудоголизм без смысла.',9:'Одиночество в достатке.',10:'Семейные конфликты из-за денег.',J:'Жадность, ненадёжность.',Q:'Расточительность, материализм.',K:'Коррупция, власть ради власти.'},
  clubs:{A:'Нереализованный потенциал.',2:'Нерешительность, страх.',3:'Задержки, медленный рост.',4:'Нестабильность фундамента.',5:'Скрытая агрессия.',6:'Провал на виду.',7:'Сдача позиций.',8:'Спешка без результата.',9:'Хроническая усталость.',10:'Перегрузка, самопожертвование.',J:'Бесконечный старт без продолжения.',Q:'Ревность, эгоцентризм.',K:'Тирания, высокомерие.'},
  spades:{A:'Жестокая правда без необходимости.',2:'Болезненное, но необходимое решение.',3:'Нежелание исцеляться.',4:'Тревожный покой.',5:'Принятие поражения с достоинством.',6:'Застревание в токсичной ситуации.',7:'Обман раскрыт.',8:'Освобождение, новая свобода.',9:'Выход из тревоги.',10:'Выживание, неожиданное спасение.',J:'Сплетни, слова без действий.',Q:'Холодность, изоляция.',K:'Холодный расчёт без сочувствия.'},
};

const PLAYING_CARDS = [];
_PC_S.forEach(suit => {
  _PC_V.forEach(val => {
    PLAYING_CARDS.push({
      id: val.v + suit.sym,
      name: val.n + ' ' + {hearts:'Червей',diamonds:'Бубён',clubs:'Треф',spades:'Пик'}[suit.s],
      suit: suit.s, sym: suit.sym, col: suit.col, tc: suit.tc,
      up: _PC_UP[suit.s][val.v],
      rx: _PC_RX[suit.s][val.v],
    });
  });
});
PLAYING_CARDS.push(
  {id:'J1', name:'Красный Джокер', suit:'joker', sym:'🃏', col:'#1a0000', tc:'#ff4444',
   up:'Дикая карта — правила сброшены. Неожиданный поворот меняет всё к лучшему. Вселенная вмешивается.',
   rx:'Хаос без управления. Сила, которую невозможно удержать и направить.'},
  {id:'J2', name:'Чёрный Джокер', suit:'joker', sym:'🃏', col:'#0a0a0a', tc:'#aaaaaa',
   up:'Скрытый трикстер входит в игру. Тёмная сторона ломает сценарий — но это может быть шансом.',
   rx:'Саботаж изнутри, нестабильность, разрушение выстроенного.'}
);

let playMode = 1;
let drawnPlayCards = [];
let flippedPlayCards = new Set();

function renderPlayingCardsSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">♠ КАРТОМАНТИЯ · 54 КАРТЫ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:10px">54 карты · ♥ ♦ ♣ ♠ + 2 Джокера. Сосредоточься — тяни.</div>
    <div class="tarot-mode-btns" style="margin-bottom:8px">
      <button class="btn sm${playMode===1?' primary':''}" onclick="setPlayMode(1)">Одна карта</button>
      <button class="btn sm${playMode===3?' primary':''}" onclick="setPlayMode(3)">Три карты</button>
      <button class="btn sm${playMode===5?' primary':''}" onclick="setPlayMode(5)">Пять (крест)</button>
    </div>
    <button class="btn primary" onclick="drawPlayCards()" style="margin-bottom:8px">⟡ Тянуть</button>
    <div id="play-spread" class="tarot-spread${playMode===5?' play-cross':''}"></div>
    <div id="play-desc" class="tarot-desc" style="display:none"></div>
  </div>`;
}

function setPlayMode(m) { playMode=m; _renderActiveMiniGame(); }

function drawPlayCards() {
  const deck = [...PLAYING_CARDS];
  drawnPlayCards=[]; flippedPlayCards=new Set();
  const count = playMode;
  for(let i=0;i<count;i++){
    const idx=Math.floor(Math.random()*deck.length);
    const c={...deck.splice(idx,1)[0]};
    c.reversed=Math.random()<0.3;
    drawnPlayCards.push(c);
  }
  const labels3=['Прошлое','Настоящее','Будущее'];
  const labels5=['Ты','Вызов','Прошлое','Будущее','Итог'];
  const labels=playMode===3?labels3:playMode===5?labels5:[''];
  const spread=document.getElementById('play-spread');
  if(!spread) return;
  spread.innerHTML=drawnPlayCards.map((c,i)=>{
    const isCross=playMode===5;
    return `<div class="tarot-card-wrap${isCross?' play-cross-card-'+i:''}" onclick="flipPlayCard(${i})">
      <div class="tarot-card${c.reversed?' reversed':''}" id="pcard-${i}">
        <div class="tarot-back" style="background:repeating-linear-gradient(45deg,#0a0015,#0a0015 4px,#100025 4px,#100025 8px)">
          <div class="tarot-back-sym">✦</div>
        </div>
        <div class="tarot-front" style="background:${c.col};position:relative">
          <div class="tarot-front-num" style="color:${c.tc}">${c.id}</div>
          <div class="tarot-front-sym" style="color:${c.tc};font-size:28px">${c.sym}</div>
          <div class="tarot-front-name" style="color:${c.tc}">${c.name}</div>
          <div class="tarot-front-suit" style="color:${c.tc}66">${c.suit==='joker'?'Джокер':c.sym}${c.reversed?' · ⊗':''}</div>
        </div>
      </div>
      ${labels[i]?`<div class="tarot-position-label">${labels[i]}</div>`:''}
    </div>`;
  }).join('');
  document.getElementById('play-desc').style.display='none';
}

function flipPlayCard(i) {
  if(!drawnPlayCards[i]) return;
  const el=document.getElementById(`pcard-${i}`);
  if(!el) return;
  el.classList.toggle('flipped');
  if(el.classList.contains('flipped')) flippedPlayCards.add(i);
  else flippedPlayCards.delete(i);
  renderPlayDescriptions();
}

function renderPlayDescriptions() {
  const desc=document.getElementById('play-desc');
  if(!desc) return;
  if(!flippedPlayCards.size){desc.style.display='none';return;}
  const labels3=['Прошлое','Настоящее','Будущее'];
  const labels5=['Ты','Вызов','Прошлое','Будущее','Итог'];
  const labels=playMode===3?labels3:playMode===5?labels5:[''];
  desc.style.display='block';
  desc.innerHTML=[...flippedPlayCards].sort().map((i,idx,arr)=>{
    const c=drawnPlayCards[i];
    const label=labels[i]?`<div style="font-size:11px;font-weight:bold;color:${c.tc};letter-spacing:2px;margin-bottom:5px;text-shadow:0 0 6px ${c.tc}88">◈ ${labels[i]}</div>`:'';
    const revTag=c.reversed?`<span style="color:var(--cursec);font-size:9px"> [перевёрнута]</span>`:'';
    const meaning=c.reversed?`<span class="tarot-desc-rev">⊗ ${c.rx}</span>`:`⟡ ${c.up}`;
    const sep=idx<arr.length-1?'border-bottom:1px dashed var(--border);margin-bottom:8px;padding-bottom:8px;':'';
    return `<div style="${sep}">${label}<b style="color:${c.tc};font-size:14px">${c.name}</b>${revTag}<br><div style="margin-top:4px">${meaning}</div></div>`;
  }).join('');
}

// ===== ЛЕНОРМАН (36 карт) =====
const LENORMAND_CARDS = [
  {id:1,  name:'Всадник',   sym:'↑',  col:'#001808', up:'Скорые новости, вести в пути. Жди — она уже летит к тебе.', rx:'Задержка вестей, плохая новость.'},
  {id:2,  name:'Клевер',    sym:'✤',  col:'#001a05', up:'Малая удача, случайный шанс. Воспользуйся — такое не повторяется.', rx:'Невезение, упущенный шанс.'},
  {id:3,  name:'Корабль',   sym:'▷',  col:'#001428', up:'Путешествие, торговля, движение вдаль. Ветер попутный.', rx:'Задержка пути, нежеланное путешествие.'},
  {id:4,  name:'Дом',       sym:'⌂',  col:'#0a0800', up:'Дом, семья, безопасность. Твоя крепость и якорь.', rx:'Скрытые проблемы в семье, опасный дом.'},
  {id:5,  name:'Дерево',    sym:'ψ',  col:'#001a08', up:'Здоровье, рост, жизненная сила. Корни держат.', rx:'Болезнь, истощение, угасание сил.'},
  {id:6,  name:'Тучи',      sym:'≋',  col:'#0a0a18', up:'Неопределённость, туман. Свет или тьма — зависит от окружения.', rx:'Полное замешательство, скрытая угроза.'},
  {id:7,  name:'Змея',      sym:'∿',  col:'#1a0000', up:'Мудрость через опыт, сложная ситуация, возможное предательство.', rx:'Ложь раскрыта, яд нейтрализован.'},
  {id:8,  name:'Гроб',      sym:'⊠',  col:'#0a0a0a', up:'Конец, завершение. Что-то подходит к концу — освободи место.', rx:'Затяжной конец, нежелание отпустить.'},
  {id:9,  name:'Букет',     sym:'✿',  col:'#1a0010', up:'Радость, подарок, красота. Кто-то несёт тебе цветы.', rx:'Фальшивое дружелюбие, ненужный подарок.'},
  {id:10, name:'Коса',      sym:'⚔',  col:'#1a0800', up:'Внезапное событие, решительное действие. Что-то отрежет — быстро.', rx:'Удар, который был виден заранее.'},
  {id:11, name:'Розги',     sym:'⚡',  col:'#1a0800', up:'Конфликт, споры, повторяющиеся паттерны. Нужно разрешить.', rx:'Конец конфликта, мир после бури.'},
  {id:12, name:'Птицы',     sym:'∧∧', col:'#001428', up:'Разговоры, беспокойство, слухи. Слова летят быстро — осторожно.', rx:'Затихание слухов, конец тревожных разговоров.'},
  {id:13, name:'Ребёнок',   sym:'◌',  col:'#001a10', up:'Новое начало, невинность, маленький проект. Только зарождается.', rx:'Незрелость, наивность, неготовность.'},
  {id:14, name:'Лиса',      sym:'⟩',  col:'#1a0800', up:'Хитрость, осторожность. Работа не та что кажется — проверь.', rx:'Обман раскрыт, лис пойман.'},
  {id:15, name:'Медведь',   sym:'◉',  col:'#1a0a00', up:'Сила, авторитет, мощный союзник или начальник рядом.', rx:'Доминирование, тиран, контроль.'},
  {id:16, name:'Звёзды',    sym:'✦',  col:'#001428', up:'Надежда, вдохновение, духовное руководство. Звёзды указывают путь.', rx:'Потеря ориентира, иллюзорные надежды.'},
  {id:17, name:'Аист',      sym:'△',  col:'#001a10', up:'Изменение к лучшему, движение вперёд. Благоприятные перемены.', rx:'Перемены не к лучшему, нестабильность.'},
  {id:18, name:'Собака',    sym:'⊷',  col:'#0a0800', up:'Верный друг, преданность. Рядом тот, кто не предаст.', rx:'Предательство друга, слепая преданность.'},
  {id:19, name:'Башня',     sym:'▲',  col:'#0a0a18', up:'Власть, институция, одиночество. Высокая цель или изоляция.', rx:'Падение власти, крах системы.'},
  {id:20, name:'Сад',       sym:'⊕',  col:'#001a08', up:'Общество, встречи, публичность. Твоё дело становится известным.', rx:'Потеря репутации, социальная изоляция.'},
  {id:21, name:'Гора',      sym:'▽',  col:'#0a0a0a', up:'Препятствие, задержка, упорное сопротивление. Нужны усилия.', rx:'Препятствие снято, гора сдвинулась.'},
  {id:22, name:'Перепутье', sym:'⊞',  col:'#0a0a18', up:'Выбор, развилка, альтернативы. Нужно принять решение — сейчас.', rx:'Нет выбора, путь предопределён.'},
  {id:23, name:'Мыши',      sym:'⊗',  col:'#1a0000', up:'Потеря, тревога, постепенное убывание. Что-то уходит по чуть-чуть.', rx:'Остановка потерь, борьба с разрушением.'},
  {id:24, name:'Сердце',    sym:'♥',  col:'#1a0005', up:'Любовь, чувства, эмоциональная связь. Сердце открыто.', rx:'Холодность, разбитое сердце.'},
  {id:25, name:'Кольцо',    sym:'◯',  col:'#1a1000', up:'Обязательства, договор, цикл. Что-то завершается или начинается снова.', rx:'Разрыв договора, конец цикла.'},
  {id:26, name:'Книга',     sym:'□',  col:'#001428', up:'Тайна, знание, скрытая информация. Есть что-то, чего ты не знаешь.', rx:'Тайна раскрыта, информация обнародована.'},
  {id:27, name:'Письмо',    sym:'✉',  col:'#001a10', up:'Послание, документ, коммуникация. Жди письма — буквального или нет.', rx:'Плохое известие, документ с проблемами.'},
  {id:28, name:'Мужчина',   sym:'♂',  col:'#001428', up:'Мужчина-вопрошающий или значимый мужчина в ситуации.', rx:'Мужское влияние против интересов запрашивающего.'},
  {id:29, name:'Женщина',   sym:'♀',  col:'#1a0010', up:'Женщина-вопрошающая или значимая женщина в ситуации.', rx:'Женское влияние против интересов запрашивающего.'},
  {id:30, name:'Лилия',     sym:'❋',  col:'#0a0a18', up:'Зрелость, мудрость, гармония после бурь. Заслуженный покой.', rx:'Вынужденное смирение, мудрость не принятая другими.'},
  {id:31, name:'Солнце',    sym:'☉',  col:'#1a1000', up:'Успех, радость, витальная сила. Всё хорошо — и будет лучше.', rx:'Временная задержка успеха, скрытое солнце.'},
  {id:32, name:'Луна',      sym:'☽',  col:'#0a0a18', up:'Признание, эмоции, интуиция. Слушай внутренний голос.', rx:'Иллюзии, нереализованные эмоции, скрытые страхи.'},
  {id:33, name:'Ключ',      sym:'⚷',  col:'#1a1000', up:'Решение найдено, цель достигнута, определённость. Дверь открыта.', rx:'Ключ потерян, нет решения, закрытые пути.'},
  {id:34, name:'Рыбы',      sym:'♓',  col:'#001428', up:'Финансы, изобилие, поток денег. Деньги текут — использует их.', rx:'Финансовые потери, расточительность.'},
  {id:35, name:'Якорь',     sym:'⚓',  col:'#001428', up:'Стабильность, долгосрочная работа, надёжная опора.', rx:'Якорь как тюрьма, застревание.'},
  {id:36, name:'Крест',     sym:'✝',  col:'#0a0a0a', up:'Судьба, карма, неизбежная ноша. Это твой урок — неси достойно.', rx:'Бегство от кармической задачи, отрицание предназначения.'},
];

let lenormandMode = 3;
let drawnLenormand = [];
let flippedLenormand = new Set();

const LENORMAND_SPREAD_NAMES = {1:'Одна карта', 3:'Три карты', 9:'Малое таблó (3×3)', 36:'Большое таблó (9×4)'};
const LENORMAND_SPREAD_LABELS = {
  1: [''],
  3: ['Прошлое','Настоящее','Будущее'],
  9: ['Прошлое','Настоящее','Будущее','Скрытое','Центр','Советник','Влияние','Исход','Итог'],
  36: [],
};

function renderLenormandSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">🎴 ЛЕНОРМАН · 36 КАРТ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:10px">Конкретный, земной оракул. Большое таблó — все 36 карт.</div>
    <div class="tarot-mode-btns" style="margin-bottom:8px">
      ${Object.entries(LENORMAND_SPREAD_NAMES).map(([m,n])=>`
        <button class="btn sm${lenormandMode===+m?' primary':''}" onclick="setLenormandMode(${m})">${n}</button>
      `).join('')}
    </div>
    <button class="btn primary" onclick="drawLenormand()" style="margin-bottom:8px">⟡ Открыть</button>
    <div id="len-spread" class="tarot-spread${lenormandMode===9?' len-square':lenormandMode===36?' len-tableau':''}"></div>
    <div id="len-desc" class="tarot-desc" style="display:none"></div>
  </div>`;
}

function setLenormandMode(m) { lenormandMode=+m; _renderActiveMiniGame(); }

function drawLenormand() {
  const deck=[...LENORMAND_CARDS];
  drawnLenormand=[]; flippedLenormand=new Set();
  const count=lenormandMode===36?36:lenormandMode===9?9:lenormandMode===3?3:1;
  for(let i=0;i<count;i++){
    const idx=Math.floor(Math.random()*deck.length);
    drawnLenormand.push({...deck.splice(idx,1)[0], reversed:Math.random()<0.25});
  }
  const labels=LENORMAND_SPREAD_LABELS[lenormandMode]||[];
  const spread=document.getElementById('len-spread');
  if(!spread) return;
  const isTableau=lenormandMode===36;
  spread.innerHTML=drawnLenormand.map((c,i)=>`
    <div class="tarot-card-wrap${isTableau?' len-small':''}" onclick="flipLenormandCard(${i})">
      <div class="tarot-card${c.reversed?' reversed':''}${isTableau?' len-small-card':''}" id="lcard-${i}">
        <div class="tarot-back" style="background:repeating-linear-gradient(45deg,#00100a,#00100a 3px,#001810 3px,#001810 6px)">
          <div class="tarot-back-sym" style="font-size:12px;color:#004422">✦</div>
        </div>
        <div class="tarot-front" style="background:${c.col}">
          <div class="tarot-front-num">${c.id}</div>
          <div class="tarot-front-sym" style="font-size:${isTableau?'14px':'22px'}">${c.sym}</div>
          <div class="tarot-front-name" style="font-size:${isTableau?'7px':'9px'}">${c.name}</div>
        </div>
      </div>
      ${labels[i]&&!isTableau?`<div class="tarot-position-label">${labels[i]}</div>`:''}
      ${isTableau?`<div style="font-size:7px;color:var(--textd);text-align:center;margin-top:2px">${c.id}</div>`:''}
    </div>`).join('');
  document.getElementById('len-desc').style.display='none';
}

function flipLenormandCard(i) {
  if(!drawnLenormand[i]) return;
  const el=document.getElementById(`lcard-${i}`);
  if(!el) return;
  if(lenormandMode===36) {
    // В Большом таблó — карты остаются открытыми, каждая накапливается
    el.classList.toggle('flipped');
    if(el.classList.contains('flipped')) flippedLenormand.add(i);
    else flippedLenormand.delete(i);
  } else {
    el.classList.toggle('flipped');
    if(el.classList.contains('flipped')) flippedLenormand.add(i);
    else flippedLenormand.delete(i);
  }
  renderLenormandDescriptions();
}

function renderLenormandDescriptions() {
  const desc=document.getElementById('len-desc');
  if(!desc) return;
  if(!flippedLenormand.size){desc.style.display='none';return;}
  const labels=LENORMAND_SPREAD_LABELS[lenormandMode]||[];
  desc.style.display='block';
  desc.innerHTML=[...flippedLenormand].sort().map((i,idx,arr)=>{
    const c=drawnLenormand[i];
    const label=labels[i]?`<div style="font-size:11px;font-weight:bold;color:var(--accent);letter-spacing:2px;margin-bottom:5px;text-shadow:0 0 6px var(--accent)">◈ ${labels[i]}</div>`:'';
    const revTag=c.reversed?`<span style="color:var(--cursec);font-size:9px"> [перевёрнута]</span>`:'';
    const sep=idx<arr.length-1?'border-bottom:1px dashed var(--border);margin-bottom:8px;padding-bottom:8px;':'';
    return `<div style="${sep}">${label}<b style="color:var(--accent2);font-size:14px">${c.name}</b>${revTag}<br><div style="margin-top:4px">${c.reversed?`<span class="tarot-desc-rev">⊗ ${c.rx}</span>`:`⟡ ${c.up}`}</div></div>`;
  }).join('');
}

// ===== АРМОНСКИЕ РУНЫ (18, Гвидо фон Лист) =====
// Порядок по List: Fa Ur Thorn Os Rit Ka | Hagal Noth Is Ar Sig Tyr | Bar Laf Man Yr Eh Gibor
// Символы сверены с картой Армонских рун (фото)
const ARMANIST_RUNES = [
  // Группа I
  {name:'Фа · Fa',   sym:'ᚠ', col:'#1a0800', up:'Начало, огонь творения, исходящая сила. Первый шаг из небытия в бытие.', rx:'Угасание начала, ложный старт.'},
  {name:'Ур · Ur',   sym:'ᚢ', col:'#1a0500', up:'Вечная прапричина, нерушимая основа. То, что было до всего.', rx:'Отрыв от корней, потеря вечного измерения.'},
  {name:'Турс · Th', sym:'ᚦ', col:'#1a0000', up:'Шип защиты, врата испытания. Через боль — в знание. Страж порога.', rx:'Слепое разрушение, боль без трансформации.'},
  {name:'Ос · Os',   sym:'ᚨ', col:'#001a10', up:'Уста богов, слово как сила. Что произнесено — становится реальным.', rx:'Пустые слова, ложь, потеря дара речи.'},
  {name:'Рит · Rit', sym:'ᚱ', col:'#001428', up:'Колесо космического закона. Всё идёт правильным путём.', rx:'Нарушение закона, кармический сбой.'},
  {name:'Ка · Ka',   sym:'ᚲ', col:'#1a0800', up:'Искусство, способность, внутренний огонь мастера. Ты можешь.', rx:'Неспособность, потеря дара, мастерство во зло.'},
  // Группа II
  {name:'Хагал · H', sym:'✶', col:'#0a0a1a', up:'Вселенская гармония, семя мирового порядка. Шестигранник — мать всех рун.', rx:'Распад гармонии, слепой хаос без узора.'},
  {name:'Нот · N',   sym:'ᚾ', col:'#1a0800', up:'Нужда как учитель, судьба как принуждение. Кармический урок.', rx:'Рабство обстоятельствам, повторяющийся цикл.'},
  {name:'Ис · Is',   sym:'ᛁ', col:'#001428', up:'Лёд, концентрация Я, застывшее бытие. Внутри тебя — бесконечность.', rx:'Эгоизм, заморозка, блокировка потока.'},
  {name:'Ар · Ar',   sym:'ᛆ', col:'#1a1000', up:'Праогонь, честь, солнечная сила. Ты несёшь свет — не прячь его.', rx:'Позор, потеря чести, свет скрыт за ложью.'},
  {name:'Зиг · S',   sym:'ᛋ', col:'#1a1200', up:'Победа солнца, воля к жизни. Молния Зиг — непобедима.', rx:'Слепящая самонадеянность, победа становящаяся поражением.'},
  {name:'Тюр · T',   sym:'ᛏ', col:'#0a0a18', up:'Жертва ради правды, бог справедливости. Что правильно — знаешь сам.', rx:'Несправедливость, поражение правого дела.'},
  // Группа III
  {name:'Бар · B',   sym:'ᛒ', col:'#001a08', up:'Рождение нового в темноте. Ещё не видно — но уже происходит.', rx:'Блокировка созидания, смерть нерождённого.'},
  {name:'Лаф · L',   sym:'ᛚ', col:'#001020', up:'Вода инициации, путь посвящённого. Испытание водой открывает тайну.', rx:'Утопание в иллюзиях, ложная инициация.'},
  {name:'Ман · M',   sym:'ᛗ', col:'#100010', up:'Человек как мера всего, богоподобный разум. Ты — микрокосм.', rx:'Потеря человечности, высокомерие, падение.'},
  {name:'Ир · Y',    sym:'ᛦ', col:'#1a0000', up:'Лук ошибки, обратный путь. Иногда ошибка — это верное направление.', rx:'Полное заблуждение, иллюзия без выхода.'},
  {name:'Эх · E',    sym:'ᛖ', col:'#0a1000', up:'Брак, вечный союз, мировая гармония пары. Двое становятся одним.', rx:'Разлад, неверный союз, брак против природы.'},
  {name:'Гибор · G', sym:'ᚷ', col:'#0a0a00', up:'Бог-даритель, колесо жизни. Жертва возвращается даром. Ты — часть целого.', rx:'Жертва без возврата, богооставленность.'},
];

let thrownArmanistRunes = [];

function renderArmanistSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">ᚠ АРМОНСКИЕ РУНЫ · ГВИДО ФОН ЛИСТ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:12px">
      18 рун оккультного Арманизма. Темнее Футарка — глубже в тень.
    </div>
    <button class="btn primary" onclick="throwArmanistRunes()">ᚷ Бросить руны</button>
    <div class="rune-spread" id="armanist-spread" style="margin-top:14px"></div>
    <div class="rune-meanings" id="armanist-meanings"></div>
  </div>`;
}

function throwArmanistRunes() {
  const pool=[...ARMANIST_RUNES];
  thrownArmanistRunes=[];
  const positions=['Прошлое','Настоящее','Путь'];
  for(let i=0;i<3;i++){
    const idx=Math.floor(Math.random()*pool.length);
    const r={...pool.splice(idx,1)[0]};
    r.reversed=Math.random()<0.4;
    r.position=positions[i];
    thrownArmanistRunes.push(r);
  }
  const spread=document.getElementById('armanist-spread');
  const meanings=document.getElementById('armanist-meanings');
  if(!spread) return;
  spread.innerHTML=thrownArmanistRunes.map((r,i)=>`
    <div class="rune-wrap">
      <div class="rune-tile face-down" id="artile-${i}" style="background:${r.col}" onclick="revealArmanistRune(${i})">✦</div>
      <div class="rune-name" id="arname-${i}" style="display:none">${r.name}</div>
      <div class="rune-pos">${r.position}</div>
    </div>`).join('');
  if(meanings) meanings.innerHTML='';
  thrownArmanistRunes.forEach((_,i)=>setTimeout(()=>revealArmanistRune(i),400+i*500));
}

function revealArmanistRune(i) {
  const r=thrownArmanistRunes[i];
  if(!r) return;
  const tile=document.getElementById(`artile-${i}`);
  const nameEl=document.getElementById(`arname-${i}`);
  if(!tile) return;
  tile.textContent=r.sym;
  tile.style.background='';
  tile.style.color='';
  tile.classList.remove('face-down');
  tile.classList.add('revealed');
  if(r.reversed) tile.classList.add('rune-reversed');
  if(nameEl) nameEl.style.display='block';
  const meanings=document.getElementById('armanist-meanings');
  if(!meanings) return;
  if(document.getElementById(`armean-${i}`)) return;
  const div=document.createElement('div');
  div.id=`armean-${i}`;
  div.className='rune-meaning-block';
  div.innerHTML=`<div class="rune-meaning-title">${r.position} · ${r.sym} ${r.name}${r.reversed?' [перевёрнутая]':''}</div>${r.reversed?`<span class="rune-meaning-rev">⊗ ${r.rx}</span>`:`⟡ ${r.up}`}`;
  meanings.appendChild(div);
}

// ===== НАТАЛЬНАЯ КАРТА =====
// Алгоритмы: Jean Meeus «Astronomical Algorithms», геокодинг: Nominatim (OpenStreetMap, бесплатно)

const NATAL_SIGNS = ['Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец','Козерог','Водолей','Рыбы'];
const NATAL_SIGN_SYM = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
const NATAL_SIGN_COL = ['#cc2200','#228800','#ddaa00','#0055cc','#cc8800','#228844','#6688cc','#880000','#aa4400','#334455','#0088aa','#664488'];
const NATAL_PLANET_SYM = {sun:'☉',moon:'☽',mercury:'☿',venus:'♀',mars:'♂',jupiter:'♃',saturn:'♄',uranus:'⛢',neptune:'♆',pluto:'♇',asc:'AC',mc:'MC'};
const NATAL_PLANET_NAMES = {sun:'Солнце',moon:'Луна',mercury:'Меркурий',venus:'Венера',mars:'Марс',jupiter:'Юпитер',saturn:'Сатурн',uranus:'Уран',neptune:'Нептун',pluto:'Плутон',asc:'Асцендент',mc:'МЦ'};
const NATAL_PLANET_COL = {sun:'#ffaa00',moon:'#aaaadd',mercury:'#88aacc',venus:'#cc88aa',mars:'#cc4422',jupiter:'#aa8844',saturn:'#888866',uranus:'#44ccbb',neptune:'#4466cc',pluto:'#884466',asc:'#ff6600',mc:'#ff6600'};

// ---- Интерпретации ----
const NATAL_SUN_IN_SIGN = {
  0:'Активность, инициатива, лидерство. Идёшь напролом, не оглядываясь.',
  1:'Стабильность, упорство, чувство формы. Строишь медленно — но надёжно.',
  2:'Гибкость, любопытство, двойственность. Умеешь смотреть на мир с разных сторон.',
  3:'Глубокая привязанность, интуиция, защита близких. Дом — твоя крепость.',
  4:'Самовыражение, щедрость, творческая сила. Хочешь быть замеченным — и заслуживаешь.',
  5:'Анализ, точность, служение. Совершенствование деталей — смысл жизни.',
  6:'Гармония, дипломатия, поиск справедливости. Тяжело быть собой там, где нет баланса.',
  7:'Глубина, трансформация, воля. Умираешь и возрождаешься снова — это твой путь.',
  8:'Свобода, идеализм, поиск смысла. Горизонт всегда манит дальше.',
  9:'Дисциплина, ответственность, структура. Строишь фундамент — в себе и в мире.',
  10:'Независимость, оригинальность, братство. Живёшь по своим правилам.',
  11:'Сострадание, воображение, растворение границ. Чувствуешь то, что другие не видят.',
};
const NATAL_MOON_IN_SIGN = {
  0:'Импульсивные реакции, быстрые перепады настроения. Нужна активность чтобы чувствовать себя живым.',
  1:'Эмоциональная стабильность, потребность в уюте и надёжности. Привязываешься глубоко.',
  2:'Рациональный подход к чувствам. Говоришь о них легче, чем переживаешь.',
  3:'Сверхчувствительность, глубокая память. Прошлое живёт в тебе очень долго.',
  4:'Теплота, щедрость, потребность в признании. Эмоции выражаешь ярко.',
  5:'Анализируешь свои чувства. Тревожность, стремление к порядку внутри.',
  6:'Потребность в партнёрстве, гармонии, отношениях. Один — неполный.',
  7:'Интенсивность, глубина, ревность. Не умеешь чувствовать наполовину.',
  8:'Свобода в эмоциях, оптимизм, непривязанность. Труднее переносишь монотонность.',
  9:'Сдержанность, контроль над чувствами. Внутри глубже, чем снаружи.',
  10:'Нестандартные реакции, неожиданные перепады. Эмоции как эксперимент.',
  11:'Эмпатия до растворения в других. Граница между собой и миром размыта.',
};
const NATAL_ASC_IN_SIGN = {
  0:'Активный, прямой, энергичный. Входишь в комнату — и это замечают.',
  1:'Спокойный, надёжный, чувственный. Первое впечатление — устойчивость.',
  2:'Общительный, любознательный, быстрый. Кажешься легче, чем есть на самом деле.',
  3:'Мягкий, заботливый, закрытый. Пускаешь не всех.',
  4:'Уверенный, тёплый, притягивающий. Хочешь производить впечатление — и производишь.',
  5:'Сдержанный, аналитичный, точный. Кажешься холоднее, чем внутри.',
  6:'Приятный, дипломатичный, красивый. Умеешь нравиться.',
  7:'Загадочный, интенсивный, проникновенный. Не всё говоришь.',
  8:'Открытый, жизнерадостный, смелый. Оптимизм виден сразу.',
  9:'Серьёзный, сдержанный, ответственный. Доверие завоёвываешь медленно.',
  10:'Необычный, независимый, неожиданный. Сложно предсказать.',
  11:'Мягкий, неопределённый, таинственный. Кажешься ускользающим.',
};

function natalSign(lon) {
  const l = ((lon % 360) + 360) % 360;
  const idx = Math.floor(l / 30);
  return { idx, deg: Math.floor(l % 30), min: Math.floor((l % 1) * 60), name: NATAL_SIGNS[idx], sym: NATAL_SIGN_SYM[idx] };
}

// Julian Day Number
function natalJD(year, month, day, hour = 12, tz = 0) {
  let h = hour - tz, d = day, m = month, y = year;
  while (h < 0)  { h += 24; d--; }
  while (h >= 24){ h -= 24; d++; }
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + h / 24 + B - 1524.5;
}

function rad(d) { return d * Math.PI / 180; }
function deg(r) { return r * 180 / Math.PI; }
function norm360(x) { return ((x % 360) + 360) % 360; }

// Солнце (Meeus Ch.25, точность ~0.01°)
function natalSun(T) {
  const L0 = norm360(280.46646 + 36000.76983 * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(rad(M))
           + (0.019993 - 0.000101 * T) * Math.sin(rad(2 * M))
           +  0.000289 * Math.sin(rad(3 * M));
  const sunLon = norm360(L0 + C);
  // Apparent longitude (nutation ~-0.00569)
  const omega = 125.04 - 1934.136 * T;
  return norm360(sunLon - 0.00569 - 0.00478 * Math.sin(rad(omega)));
}

// Луна (Meeus Ch.47, ~15 главных членов, точность ~0.3°)
function natalMoon(T) {
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D  = norm360(297.8501921 + 445267.1114034  * T - 0.0018819 * T * T);
  const M  = norm360(357.5291092 + 35999.0502909   * T - 0.0001536 * T * T);
  const Mp = norm360(134.9633964 + 477198.8675055  * T + 0.0087414 * T * T);
  const F  = norm360( 93.2720950 + 483202.0175233  * T - 0.0036539 * T * T);
  const E  = 1 - 0.002516 * T - 0.0000074 * T * T;
  const sl =
    6288774 * Math.sin(rad(Mp))
  + 1274027 * Math.sin(rad(2*D - Mp))
  +  658314 * Math.sin(rad(2*D))
  +  213618 * Math.sin(rad(2*Mp))
  -  185116 * E * Math.sin(rad(M))
  -  114332 * Math.sin(rad(2*F))
  +   58793 * Math.sin(rad(2*D - 2*Mp))
  +   57066 * E * Math.sin(rad(2*D - M - Mp))
  +   53322 * Math.sin(rad(2*D + Mp))
  +   45758 * E * Math.sin(rad(2*D - M))
  -   40923 * E * Math.sin(rad(M - Mp))
  -   34720 * Math.sin(rad(D))
  -   30383 * E * Math.sin(rad(M + Mp))
  +   15327 * Math.sin(rad(2*D - 2*F))
  -   12528 * Math.sin(rad(Mp + 2*F));
  return norm360(Lp + sl / 1000000);
}

// Планеты — упрощённые орбитальные элементы (Meeus Ch.33, точность ~1-2°)
function natalPlanet(name, T) {
  const E = {
    mercury:{ L0:252.250906,  L1:149472.6746358, a:0.38709927, e:0.20563069, I:7.00497902,  O:48.33076593, w:77.45779628 },
    venus:  { L0:181.979801,  L1: 58517.8156760, a:0.72333566, e:0.00677672, I:3.39467605,  O:76.67984255, w:131.60246718},
    mars:   { L0:355.433000,  L1: 19140.2993039, a:1.52371034, e:0.09339410, I:1.84969142,  O:49.55953891, w:336.04084002},
    jupiter:{ L0: 34.351519,  L1:  3034.9056606, a:5.20288700, e:0.04838624, I:1.30439695,  O:100.47390909,w:14.72847983},
    saturn: { L0: 50.077444,  L1:  1222.1137943, a:9.53667594, e:0.05386179, I:2.48599187,  O:113.66242448,w:92.59887831},
    uranus: { L0:314.055005,  L1:   428.4669983, a:19.18916464,e:0.04725744, I:0.77263783,  O:74.01692503, w:170.95427630},
    neptune:{ L0:304.348665,  L1:   218.4862002, a:30.06992276,e:0.00859048, I:1.77004347,  O:131.78422574,w:44.96476227},
    pluto:  { L0:238.928600,  L1:   145.1827000, a:39.48211675,e:0.24882730, I:17.14001206, O:110.30393684,w:224.06891629},
  };
  const p = E[name];
  if (!p) return 0;
  const L   = norm360(p.L0 + p.L1 * T);
  const M   = norm360(L - p.w);
  const Mrad= rad(M);
  const v   = M + (2*p.e - 0.25*p.e*p.e*p.e) * Math.sin(Mrad)
                + 1.25*p.e*p.e*Math.sin(2*Mrad)
                + (13/12)*p.e*p.e*p.e*Math.sin(3*Mrad);
  const lon = norm360(v + p.w);
  // Convert heliocentric ecliptic to geocentric (simplified, good for outer planets)
  // For inner planets, full conversion needed — using Sun position
  const sunLon = natalSun(T);
  if (name === 'mercury' || name === 'venus') {
    // Heliocentric → Geocentric for inner planets
    const sl = rad(sunLon); const pl = rad(lon);
    const R = 1.0; // Earth-Sun distance (AU, simplified)
    const r = p.a;
    const x = r * Math.cos(pl) - R * Math.cos(sl);
    const y = r * Math.sin(pl) - R * Math.sin(sl);
    return norm360(deg(Math.atan2(y, x)));
  }
  return lon;
}

// Асцендент + МЦ (Meeus Ch.14)
function natalAscMC(jd, lat, lon) {
  const T    = (jd - 2451545.0) / 36525;
  const GMST = norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T);
  const LST  = norm360(GMST + lon);
  const eps  = 23.439291111 - 0.013004167 * T;
  // MC
  const mc = norm360(deg(Math.atan2(Math.tan(rad(LST)), Math.cos(rad(eps)))));
  // ASC
  const y = -Math.cos(rad(LST));
  const x =  Math.sin(rad(LST)) * Math.cos(rad(eps)) + Math.tan(rad(lat)) * Math.sin(rad(eps));
  const asc = norm360(deg(Math.atan2(y, x)));
  return { asc, mc };
}

// Аспекты
const NATAL_ASPECTS = [
  {name:'Соединение', angle:0,   orb:8,  col:'#ffcc00', sym:'☌'},
  {name:'Секстиль',   angle:60,  orb:5,  col:'#44cc44', sym:'✶'},
  {name:'Квадратура', angle:90,  orb:7,  col:'#cc4422', sym:'□'},
  {name:'Трин',       angle:120, orb:7,  col:'#4488ff', sym:'△'},
  {name:'Оппозиция',  angle:180, orb:8,  col:'#cc2266', sym:'☍'},
];

function natalCalcAspects(positions) {
  const keys = Object.keys(positions).filter(k => positions[k] !== null);
  const aspects = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = positions[keys[i]], b = positions[keys[j]];
      const diff = Math.abs(norm360(a - b));
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of NATAL_ASPECTS) {
        if (Math.abs(angle - asp.angle) <= asp.orb) {
          aspects.push({ p1: keys[i], p2: keys[j], asp, orb: Math.abs(angle - asp.angle).toFixed(1) });
          break;
        }
      }
    }
  }
  return aspects;
}

// Рендер SVG-колеса
function drawNatalSVG(positions, hasTime) {
  const W = 400, H = 400, cx = W/2, cy = H/2;
  const Rout = 185, Rzod = 165, Rinn = 140, Rplanet = 115, Rcenter = 70;

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;display:block;margin:0 auto">`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${Rout}" fill="none" stroke="var(--borderg)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${Rzod}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${Rinn}" fill="none" stroke="var(--border)" stroke-width="0.5"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${Rcenter}" fill="none" stroke="var(--border)" stroke-width="0.5"/>`;

  // Знаки зодиака
  for (let i = 0; i < 12; i++) {
    const a = rad(-90 + i * 30);
    const a2 = rad(-90 + (i + 0.5) * 30);
    // Разделители
    const x1 = cx + Rzod * Math.cos(a), y1 = cy + Rzod * Math.sin(a);
    const x2 = cx + Rout * Math.cos(a), y2 = cy + Rout * Math.sin(a);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--border)" stroke-width="0.5"/>`;
    // Символ знака
    const rx = cx + (Rzod + 11) * Math.cos(a2), ry = cy + (Rzod + 11) * Math.sin(a2);
    svg += `<text x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="${NATAL_SIGN_COL[i]}">${NATAL_SIGN_SYM[i]}</text>`;
  }

  // Аспектные линии
  const planetsForAspects = Object.keys(positions).filter(k => positions[k] !== null && k !== 'asc' && k !== 'mc');
  for (const asp of natalCalcAspects(positions)) {
    const a1 = rad(-90 - positions[asp.p1]);
    const a2 = rad(-90 - positions[asp.p2]);
    const x1 = cx + Rcenter * Math.cos(a1), y1 = cy + Rcenter * Math.sin(a1);
    const x2 = cx + Rcenter * Math.cos(a2), y2 = cy + Rcenter * Math.sin(a2);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${asp.asp.col}" stroke-width="0.6" opacity="0.5"/>`;
  }

  // Планеты
  const placed = {};
  for (const [pname, lon] of Object.entries(positions)) {
    if (lon === null) continue;
    // Offset if too close to another planet
    let finalLon = lon;
    for (const prev of Object.values(placed)) {
      if (Math.abs(norm360(finalLon - prev)) < 6) finalLon += 7;
    }
    placed[pname] = finalLon;
    const a = rad(-90 - finalLon);
    const R = (pname === 'asc' || pname === 'mc') ? Rinn + 10 : Rplanet;
    const px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
    const sym = NATAL_PLANET_SYM[pname];
    const col = NATAL_PLANET_COL[pname];
    svg += `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${pname==='asc'||pname==='mc'?9:12}" fill="${col}" font-weight="bold">${sym}</text>`;
    // Tick on inner circle
    const tx1 = cx + (Rinn-2) * Math.cos(rad(-90-lon)), ty1 = cy + (Rinn-2) * Math.sin(rad(-90-lon));
    const tx2 = cx + (Rinn+2) * Math.cos(rad(-90-lon)), ty2 = cy + (Rinn+2) * Math.sin(rad(-90-lon));
    svg += `<line x1="${tx1.toFixed(1)}" y1="${ty1.toFixed(1)}" x2="${tx2.toFixed(1)}" y2="${ty2.toFixed(1)}" stroke="${col}" stroke-width="1.5"/>`;
  }

  svg += `</svg>`;
  return svg;
}

// Форма и логика
let natalData = null;
let natalCityCoords = null;

function renderNatalSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">☿ НАТАЛЬНАЯ КАРТА</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:14px">
      Расчёт по алгоритмам Жана Мееуса. Позиции планет, знаки, аспекты. Геокодинг: OpenStreetMap.
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;max-width:360px">
      <div class="field">
        <label>ДАТА РОЖДЕНИЯ</label>
        <input type="date" id="natal-date">
      </div>
      <div class="field">
        <label>ВРЕМЯ РОЖДЕНИЯ <span style="color:var(--textd)">(необязательно — без него нет Асцендента)</span></label>
        <input type="time" id="natal-time" placeholder="чч:мм">
      </div>
      <div class="field">
        <label>ГОРОД РОЖДЕНИЯ</label>
        <div style="display:flex;gap:6px">
          <input id="natal-city" placeholder="Город рождения..." style="flex:1">
          <button class="btn sm" onclick="natalLookupCity()">⟡ Найти</button>
        </div>
        <div id="natal-city-result" style="font-size:10px;color:var(--accent2);margin-top:4px"></div>
      </div>
      <button class="btn primary" onclick="natalCalculate()">☿ Рассчитать карту</button>
    </div>
    <div id="natal-chart-area" style="margin-top:20px"></div>
  </div>`;
}

async function natalLookupCity() {
  const q = document.getElementById('natal-city').value.trim();
  if (!q) return;
  const res = document.getElementById('natal-city-result');
  res.textContent = 'Поиск...';
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'ru', 'User-Agent': 'EthW-NatalChart/1.0' }
    });
    const data = await resp.json();
    if (!data.length) { res.textContent = '⚠ Город не найден.'; return; }
    const d = data[0];
    natalCityCoords = { lat: parseFloat(d.lat), lon: parseFloat(d.lon), name: d.display_name.split(',')[0] };
    res.textContent = `✓ ${natalCityCoords.name} · ${natalCityCoords.lat.toFixed(2)}° с.ш. · ${natalCityCoords.lon.toFixed(2)}° в.д.`;
  } catch(e) {
    res.textContent = '⚠ Ошибка геокодинга.';
  }
}

function natalCalculate() {
  const dateEl = document.getElementById('natal-date');
  const timeEl = document.getElementById('natal-time');
  const area   = document.getElementById('natal-chart-area');
  if (!dateEl.value) { toast('Введите дату рождения.'); return; }
  if (!natalCityCoords) { toast('Сначала найдите город.'); return; }

  const [y, m, d] = dateEl.value.split('-').map(Number);
  const hasTime = !!timeEl.value;
  const [h, min] = hasTime ? timeEl.value.split(':').map(Number) : [12, 0];
  const hour = h + min / 60;

  // Примерный UTC-offset из долготы (грубо, ±30мин погрешность)
  const tzApprox = Math.round(natalCityCoords.lon / 15);
  const jd = natalJD(y, m, d, hour, tzApprox);
  const T  = (jd - 2451545.0) / 36525;

  const positions = {
    sun:     natalSun(T),
    moon:    natalMoon(T),
    mercury: natalPlanet('mercury', T),
    venus:   natalPlanet('venus', T),
    mars:    natalPlanet('mars', T),
    jupiter: natalPlanet('jupiter', T),
    saturn:  natalPlanet('saturn', T),
    uranus:  natalPlanet('uranus', T),
    neptune: natalPlanet('neptune', T),
    pluto:   natalPlanet('pluto', T),
    asc: null, mc: null
  };

  if (hasTime) {
    const { asc, mc } = natalAscMC(jd, natalCityCoords.lat, natalCityCoords.lon);
    positions.asc = asc;
    positions.mc  = mc;
  }

  natalData = { positions, hasTime, jd, lat: natalCityCoords.lat, lon: natalCityCoords.lon };

  // Рендер
  const svg = drawNatalSVG(positions, hasTime);
  const aspects = natalCalcAspects(positions);

  // Таблица планет
  const planetOrder = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  const table = planetOrder.map(p => {
    const s = natalSign(positions[p]);
    return `<tr>
      <td style="color:${NATAL_PLANET_COL[p]};font-size:14px;text-align:center">${NATAL_PLANET_SYM[p]}</td>
      <td style="color:var(--text)">${NATAL_PLANET_NAMES[p]}</td>
      <td style="color:${NATAL_SIGN_COL[s.idx]}">${s.sym} ${s.name}</td>
      <td style="color:var(--textd)">${s.deg}°${s.min.toString().padStart(2,'0')}'</td>
    </tr>`;
  }).join('');

  const ascRow = hasTime ? (() => {
    const s = natalSign(positions.asc), sm = natalSign(positions.mc);
    return `<tr><td style="color:${NATAL_PLANET_COL.asc};font-size:11px;text-align:center">AC</td>
      <td style="color:var(--text)">Асцендент</td>
      <td style="color:${NATAL_SIGN_COL[s.idx]}">${s.sym} ${s.name}</td>
      <td style="color:var(--textd)">${s.deg}°${s.min.toString().padStart(2,'0')}'</td></tr>
    <tr><td style="color:${NATAL_PLANET_COL.mc};font-size:11px;text-align:center">MC</td>
      <td style="color:var(--text)">Медиум Цели</td>
      <td style="color:${NATAL_SIGN_COL[sm.idx]}">${sm.sym} ${sm.name}</td>
      <td style="color:var(--textd)">${sm.deg}°${sm.min.toString().padStart(2,'0')}'</td></tr>`;
  })() : '';

  const aspectsHtml = aspects.map(a => `
    <div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
      <span style="color:${NATAL_PLANET_COL[a.p1]}">${NATAL_PLANET_SYM[a.p1]}</span>
      <span style="color:${a.asp.col};margin:0 4px">${a.asp.sym} ${a.asp.name}</span>
      <span style="color:${NATAL_PLANET_COL[a.p2]}">${NATAL_PLANET_SYM[a.p2]}</span>
      <span style="color:var(--textd);float:right">${a.orb}° орб</span>
    </div>`).join('');

  // Интерпретации
  const sunSign = natalSign(positions.sun);
  const moonSign = natalSign(positions.moon);
  const ascSign = hasTime ? natalSign(positions.asc) : null;

  const interp = `
    <div style="margin-bottom:8px">
      <div style="color:${NATAL_PLANET_COL.sun};font-weight:bold;margin-bottom:3px">${NATAL_PLANET_SYM.sun} Солнце в ${sunSign.sym} ${sunSign.name}</div>
      <div style="font-size:11px;color:var(--text)">${NATAL_SUN_IN_SIGN[sunSign.idx]}</div>
    </div>
    <div style="margin-bottom:8px">
      <div style="color:${NATAL_PLANET_COL.moon};font-weight:bold;margin-bottom:3px">${NATAL_PLANET_SYM.moon} Луна в ${moonSign.sym} ${moonSign.name}</div>
      <div style="font-size:11px;color:var(--text)">${NATAL_MOON_IN_SIGN[moonSign.idx]}</div>
    </div>
    ${ascSign ? `<div style="margin-bottom:8px">
      <div style="color:${NATAL_PLANET_COL.asc};font-weight:bold;margin-bottom:3px">AC Асцендент в ${ascSign.sym} ${ascSign.name}</div>
      <div style="font-size:11px;color:var(--text)">${NATAL_ASC_IN_SIGN[ascSign.idx]}</div>
    </div>` : ''}
    ${!hasTime ? `<div style="font-size:10px;color:var(--textd);padding:6px;border:1px solid var(--border)">⚠ Время не указано — Асцендент, МЦ и дома не рассчитаны. Луна может быть смещена на 1 знак если рождён в день смены знака Луны.</div>` : ''}
  `;

  area.innerHTML = `
    ${svg}
    <div style="margin-top:16px;max-width:600px;margin-left:auto;margin-right:auto;padding:10px;background:var(--panel);border:1px solid var(--borderg)">
      <div class="sb-title" style="margin-bottom:8px">☿ ТРАНЗИТЫ — ПРОГНОЗ НА ДАТУ</div>
      <div style="color:var(--textd);font-size:10px;margin-bottom:8px">Введи любую дату — покажу какие планеты аспектируют твою натальную карту.</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="date" id="transit-date" style="font-size:11px;padding:3px 6px">
        <button class="btn sm primary" onclick="natalCalcTransits()">⟡ Рассчитать транзиты</button>
      </div>
      <div id="transit-result" style="margin-top:10px"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;max-width:600px;margin-left:auto;margin-right:auto">
      <div>
        <div class="sb-title" style="margin-bottom:8px">ПЛАНЕТЫ</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          ${table}${ascRow}
        </table>
      </div>
      <div>
        <div class="sb-title" style="margin-bottom:8px">АСПЕКТЫ</div>
        <div>${aspectsHtml || '<span style="color:var(--textd);font-size:10px">Нет значимых аспектов</span>'}</div>
      </div>
    </div>
    <div style="margin-top:16px;max-width:600px;margin-left:auto;margin-right:auto">
      <div class="sb-title" style="margin-bottom:10px">ИНТЕРПРЕТАЦИИ</div>
      ${interp}
    </div>
  `;
}

// ===== ТРАНЗИТЫ =====
const TRANSIT_INTERP = {
  // [транзитная_планета][аспект][натальная_планета] — упрощённо по аспекту
  conj: { // Соединение
    sun:   {sun:'Новый солнечный цикл, мощный импульс личной силы.',moon:'Эмоциональный подъём, выход наружу.',mercury:'Важные слова и решения.',venus:'Период привлекательности и отношений.',mars:'Энергия и инициатива на пике.',jupiter:'Удача и расширение возможностей.',saturn:'Серьёзный момент, ответственность.'},
    moon:  {sun:'Импульс из подсознания выходит на поверхность.',saturn:'Эмоциональная тяжесть, требует терпения.',jupiter:'Хорошее настроение, оптимизм.',mars:'Эмоциональная вспыльчивость.'},
    mercury:{sun:'Период ясности и важных разговоров.',saturn:'Серьёзные переговоры, взвешенные решения.'},
    venus:  {sun:'Гармония, притяжение, красота.',mars:'Страсть и творчество обострены.',saturn:'Испытание отношений.'},
    mars:   {sun:'Максимальная энергия и напор.',saturn:'Блокировка действий, нужно терпение.',jupiter:'Активное везение, действуй!'},
    jupiter:{sun:'Лучший период для роста и расширения.',saturn:'Баланс между ростом и ограничениями.',moon:'Эмоциональный оптимизм.'},
    saturn: {sun:'Серьёзное испытание, подведение итогов.',moon:'Эмоциональная нагрузка, взросление.',jupiter:'Удача требует структуры.',mars:'Frustration — действие заблокировано.'},
    uranus: {sun:'Неожиданные перемены, освобождение.',moon:'Нестабильность, неожиданные события.',saturn:'Разрушение старых структур.'},
    neptune:{sun:'Период туманности, интуиция обострена.',moon:'Мечтательность, уязвимость иллюзиям.',saturn:'Растворение границ и ответственности.'},
    pluto:  {sun:'Трансформация на глубинном уровне.',moon:'Глубокое эмоциональное очищение.',saturn:'Разрушение и перестройка основ жизни.'},
  },
  trine: { // Трин — благоприятный
    sun:   {jupiter:'Удача течёт сама.',saturn:'Дисциплина приносит плоды.',venus:'Гармония и успех в отношениях.'},
    moon:  {jupiter:'Эмоциональный покой и радость.',venus:'Тепло в отношениях.'},
    jupiter:{sun:'Расцвет, возможности открываются.',moon:'Оптимизм и благополучие.'},
  },
  square: { // Квадрат — напряжение
    sun:   {saturn:'Препятствия и ответственность. Нужно работать.',mars:'Конфликт воль, гнев.',uranus:'Внезапное напряжение.'},
    moon:  {saturn:'Эмоциональная холодность, напряжение.',mars:'Раздражительность, конфликты.'},
    saturn:{sun:'Тяжёлый период, требует усилий.',moon:'Ограничения в эмоциях.'},
    mars:  {saturn:'Блокировка энергии, нужно терпение.',sun:'Конфликты и напряжение.'},
  },
  oppos: { // Оппозиция
    sun:   {saturn:'Противостояние с авторитетом или собой.',jupiter:'Избыток и потеря меры.',mars:'Открытый конфликт.'},
    saturn:{sun:'Противостояние с ограничениями жизни.',moon:'Разрыв между чувством и долгом.'},
  },
};

const TRANSIT_ASPECT_NAMES = {conj:'☌ Соединение', trine:'△ Трин', square:'□ Квадрат', oppos:'☍ Оппозиция', sext:'✶ Секстиль'};
const TRANSIT_ASPECT_COL   = {conj:'#ffcc00', trine:'#4488ff', square:'#cc4422', oppos:'#cc2266', sext:'#44cc44'};

function natalCalcTransits() {
  const el = document.getElementById('transit-date');
  const result = document.getElementById('transit-result');
  if (!natalData) { result.innerHTML='<span style="color:var(--cursec)">⚠ Сначала рассчитай натальную карту.</span>'; return; }
  if (!el || !el.value) { result.innerHTML='<span style="color:var(--cursec)">⚠ Введи дату.</span>'; return; }

  const [y,m,d] = el.value.split('-').map(Number);
  const jdT = natalJD(y, m, d, 12, 0);
  const TT  = (jdT - 2451545.0) / 36525;

  const transit = {
    sun:     natalSun(TT),
    moon:    natalMoon(TT),
    mercury: natalPlanet('mercury', TT),
    venus:   natalPlanet('venus',   TT),
    mars:    natalPlanet('mars',    TT),
    jupiter: natalPlanet('jupiter', TT),
    saturn:  natalPlanet('saturn',  TT),
    uranus:  natalPlanet('uranus',  TT),
    neptune: natalPlanet('neptune', TT),
    pluto:   natalPlanet('pluto',   TT),
  };

  const natal = natalData.positions;
  const found = [];

  const ASP = [
    {key:'conj', angle:0,   orb:6},
    {key:'sext', angle:60,  orb:4},
    {key:'square',angle:90, orb:6},
    {key:'trine', angle:120,orb:6},
    {key:'oppos', angle:180,orb:6},
  ];

  const natalKeys = ['sun','moon','mercury','venus','mars','jupiter','saturn'];
  const transitKeys = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];

  for (const tp of transitKeys) {
    for (const np of natalKeys) {
      if (natal[np] === null) continue;
      const diff = Math.abs(norm360(transit[tp] - natal[np]));
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of ASP) {
        const orb = Math.abs(angle - asp.angle);
        if (orb <= asp.orb) {
          const interpCat = TRANSIT_INTERP[asp.key];
          const interp = interpCat && interpCat[tp] && interpCat[tp][np]
            ? interpCat[tp][np]
            : interpCat && interpCat[np] && interpCat[np][tp]
              ? interpCat[np][tp]
              : null;
          found.push({ tp, np, asp: asp.key, orb: orb.toFixed(1), interp });
          break;
        }
      }
    }
  }

  if (!found.length) {
    result.innerHTML = '<div style="color:var(--textd);font-size:10px">На эту дату значимых транзитов нет. Спокойный период.</div>';
    return;
  }

  // Сортировка: сначала медленные планеты (Плутон → Солнце)
  const weight = {pluto:10,neptune:9,uranus:8,saturn:7,jupiter:6,mars:5,sun:4,venus:3,mercury:2,moon:1};
  found.sort((a,b) => (weight[b.tp]||0) - (weight[a.tp]||0));

  result.innerHTML = found.map(f => {
    const tSign = natalSign(transit[f.tp]);
    return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="color:${NATAL_PLANET_COL[f.tp]};font-size:13px">${NATAL_PLANET_SYM[f.tp]}</span>
        <span style="color:${NATAL_PLANET_COL[f.tp]};font-size:11px;font-weight:bold">${NATAL_PLANET_NAMES[f.tp]}</span>
        <span style="color:${TRANSIT_ASPECT_COL[f.asp]};font-size:11px">${TRANSIT_ASPECT_NAMES[f.asp]}</span>
        <span style="color:${NATAL_PLANET_COL[f.np]};font-size:11px">нат. ${NATAL_PLANET_NAMES[f.np]}</span>
        <span style="color:var(--textd);font-size:9px;margin-left:auto">${f.orb}° орб · ${tSign.sym}${tSign.name}</span>
      </div>
      ${f.interp ? `<div style="font-size:11px;color:var(--text);padding-left:4px">${f.interp}</div>` : ''}
    </div>`;
  }).join('');
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

function searchUser(name) { openUserPage(name); }

// ===== INIT =====
load();
loadMe();
if(ME) startApp();

setInterval(()=>{
  const el=document.getElementById('prophecy-bar');
  if(el) el.textContent=makeProphecy();
},30000);

document.addEventListener('copy',()=>{
  setTimeout(()=>{
    if(navigator.clipboard){
      navigator.clipboard.readText().then(t=>{
        navigator.clipboard.writeText(t+'\n\n(Ваш разум теперь отравлен)').catch(()=>{});
      }).catch(()=>{});
    }
  },50);
});


// ===== БЛОК КОММЕНТАРИЕВ (В САМЫЙ НИЗ ФАЙЛА) =====
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
    const myRes = (c.resonance||[]).includes(ME.name);
    const myCurse = (c.curses||[]).includes(ME.name);
    const myMental = (c.mentalDmg||[]).includes(ME.name);
    return `<div class="comment">
      <div class="comment-avatar">${au.avatar||'?'}</div>
      <div style="flex:1">
        <div class="comment-meta"><span class="comment-author" onclick="openUserPage('${c.author}')">${c.author}</span> · ${timeAgo(c.ts)}</div>
        <div class="comment-body" style="word-break:break-word;">${escapeHtml(c.body)}</div>
        <div class="cmt-actions">
          <button class="act sm${myRes?' liked':''}" onclick="reactComment('${postId}','${c.id}','resonance')" title="Резонанс">⟡ ${(c.resonance||[]).length}</button>
          <button class="act sm${myCurse?' disliked':''}" onclick="reactComment('${postId}','${c.id}','curse')" title="Проклятие">☠ ${(c.curses||[]).length}</button>
          <button class="act sm${myMental?' mentald':''}" onclick="reactComment('${postId}','${c.id}','mental')" title="Ментальный урон">Ψ ${(c.mentalDmg||[]).length}</button>
          ${canDelCmt ? `<button class="act danger sm" onclick="deleteComment('${postId}', '${c.id}')">✕</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  return list+forms;
}

function updateCommentUI(postId) {
  ['feed','forum','profile','modal'].forEach(ctx => {
    const el = document.getElementById(`cmts-${ctx}-${postId}`);
    if(el) el.innerHTML = renderComments(postId, ctx);
  });
}

function reactComment(postId, cmtId, type) {
  const cmts = DB.comments[postId];
  if(!cmts) return;
  const c = cmts.find(x => x.id === cmtId);
  if(!c) return;
  const field = type === 'resonance' ? 'resonance' : type === 'curse' ? 'curses' : 'mentalDmg';
  if(!c[field]) c[field] = [];
  const idx = c[field].indexOf(ME.name);
  if(idx > -1) {
    c[field].splice(idx, 1);
    if(type === 'resonance') karmaHit(c.author, -1);
    if(type === 'curse')     karmaHit(c.author,  1);
  } else {
    c[field].push(ME.name);
    if(type === 'resonance') karmaHit(c.author,  1);
    if(type === 'curse')     karmaHit(c.author, -1);
  }
  save();
  updateCommentUI(postId);
}

function toggleComments(id, ctx) {
  const el = document.getElementById(`cmts-${ctx}-${id}`);
  el.classList.toggle('open');
  if(el.classList.contains('open')) el.innerHTML = renderComments(id, ctx);
}

function submitComment(postId, ctx) {
  const inp = document.getElementById(`ci-${ctx}-${postId}`);
  const body = inp.value.trim();
  if(!body) return;
  if(!DB.comments[postId]) DB.comments[postId]=[];
  DB.comments[postId].push({id:uid(),author:ME.name,body,ts:Date.now(),resonance:[],curses:[],mentalDmg:[]});
  ME.commentCount = (ME.commentCount||0)+1;
  updateUser(ME); save();
  updateCommentUI(postId);
}

function deleteComment(postId, cmtId) {
  if(!DB.comments[postId]) return;
  DB.comments[postId] = DB.comments[postId].filter(c => c.id !== cmtId);
  save(); toast('Комментарий стёрт.');
  updateCommentUI(postId);
}
