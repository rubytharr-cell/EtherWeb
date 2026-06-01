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
  messages: {}
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
  if(p==='chats') renderDialogs();
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
const SLAVIC_RUNES = [
  {name:'Мир',      sym:'ᛗ', col:'#001a10',
   up:'Гармония, порядок, защита, союз с миром богов и людей.',
   rx:'Хаос, конфликт, разрушение установленного порядка.',
   pos:['Прошлое','Настоящее','Путь']},
  {name:'Чернобог', sym:'ᚦ', col:'#1a0000',
   up:'Испытание, тёмная сила, разрушение старого ради нового.',
   rx:'Слепая тьма, саморазрушение, отказ учиться на испытании.'},
  {name:'Алатырь',  sym:'ᚨ', col:'#1a1000',
   up:'Центр мира, равновесие, начало и конец всего. Ось бытия.',
   rx:'Дисбаланс, потеря центра, блуждание без опоры.'},
  {name:'Радуга',   sym:'ᚱ', col:'#001428',
   up:'Связь между мирами, мост, дорога. Иди — путь открыт.',
   rx:'Потеря пути, застревание между мирами, ложный выбор.'},
  {name:'Нужда',    sym:'ᚾ', col:'#1a0a00',
   up:'Ограничение, необходимость, кармический урок. Пройди — вырастешь.',
   rx:'Рабство обстоятельствам, отказ учиться, цикл повторяется.'},
  {name:'Крада',    sym:'ᚲ', col:'#200500',
   up:'Очистительный огонь, жертва, трансформация через горение.',
   rx:'Выгорание, жертва без смысла, всё сгорает зря.'},
  {name:'Треба',    sym:'ᛏ', col:'#0a0a1a',
   up:'Жертвоприношение, долг, исполнение обязательств богам и людям.',
   rx:'Отказ от долга, нарушение клятвы, духовная пустота.'},
  {name:'Сила',     sym:'ᛊ', col:'#0a1a00',
   up:'Жизненная сила, воля, энергия духа. Ты сильнее чем думаешь.',
   rx:'Слабость духа, утечка силы, чужая воля вместо своей.'},
  {name:'Ветер',    sym:'ᚹ', col:'#00101a',
   up:'Дух, движение, перемены, воля богов. Не сопротивляйся потоку.',
   rx:'Застой, отрицание перемен, страх движения.'},
  {name:'Берег',    sym:'ᛒ', col:'#001a08',
   up:'Защита, безопасность, мать-земля, возвращение домой.',
   rx:'Беззащитность, изгнание, потеря почвы под ногами.'},
  {name:'Уд',       sym:'ᚢ', col:'#1a0800',
   up:'Жизненная сила рода, страсть, творческое начало, потенция.',
   rx:'Разрушение связи с родом, угасание силы, творческий кризис.'},
  {name:'Леля',     sym:'ᛚ', col:'#001020',
   up:'Любовь, интуиция, вода, весна, обновление. Сердце знает.',
   rx:'Холодность, подавление чувств, потеря связи с интуицией.'},
  {name:'Рок',      sym:'ᛞ', col:'#100010',
   up:'Судьба, неизбежность, высший закон. Прими — и освободишься.',
   rx:'Бегство от судьбы, борьба с неизбежным, кармический долг.'},
  {name:'Опора',    sym:'ᚩ', col:'#0a0a00',
   up:'Предки, традиция, корни, поддержка из прошлого.',
   rx:'Одиночество, отрыв от корней, отрицание помощи предков.'},
  {name:'Даждьбог', sym:'ᛞ', col:'#1a1000',
   up:'Дарующий бог, изобилие, солнечный свет, щедрость.',
   rx:'Жадность, удача закрыта, блокировка благодати.'},
  {name:'Перун',    sym:'ᛈ', col:'#0a0a1a',
   up:'Гром, справедливость, очищение. Перун судит — и он справедлив.',
   rx:'Слепой гнев, несправедливое наказание, разрушение вместо защиты.'},
  {name:'Исток',    sym:'ᛁ', col:'#001818',
   up:'Начало, источник, первопричина всего сущего.',
   rx:'Потеря смысла, разрыв с первопричиной, бессмысленное существование.'},
  {name:'Есть',     sym:'ᛖ', col:'#0a1000',
   up:'Бытие, существование, настоящий момент. Ты есть — и это сила.',
   rx:'Отрицание существования, побег от настоящего, небытие как выбор.'},
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
  tile.textContent = r.sym;
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

function renderTarotSection() {
  return `<div class="profile-section">
    <div class="profile-section-title">🃏 ТАРО — РАСКЛАД КАРТ</div>
    <div style="color:var(--textd);font-size:10px;margin-bottom:10px">
      Сосредоточься на вопросе. Карты отвечают.
    </div>
    <div class="tarot-mode-btns">
      <button class="btn sm${tarotMode===1?' primary':''}" onclick="setTarotMode(1)">Одна карта</button>
      <button class="btn sm${tarotMode===3?' primary':''}" onclick="setTarotMode(3)">Расклад 3 карты</button>
    </div>
    <button class="btn primary" onclick="drawTarot()" style="margin-bottom:8px">⟡ Вытянуть карту</button>
    <div id="tarot-spread" class="tarot-spread"></div>
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
  id:'∅', suit:'chaos', name:'Карта Безумия', sym:'∅', col:'#000000', suitLabel:'?',
  up:'Система перегружена. Правила недействительны. Этой карты не существует.',
  rx:'Порядок возникает из абсолютного хаоса. Невозможное становится единственно верным.'
};

let flippedCards = new Set();

function drawTarot() {
  const deck = [...TAROT_CARDS, {...CHAOS_CARD}]; // 79 карт — Карта Безумия с равным шансом
  drawnCards = [];
  flippedCards = new Set();

  for (let i = 0; i < tarotMode; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    const card = {...deck.splice(idx, 1)[0]};
    card.reversed = Math.random() < 0.35;
    drawnCards.push(card);
  }

  const labels = tarotMode === 3 ? ['Прошлое','Настоящее','Будущее'] : [''];
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
      ${labels[i] ? `<div style="font-size:8px;color:var(--textd);text-align:center;margin-top:4px">${labels[i]}</div>` : ''}
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

  const labels = tarotMode === 3 ? ['Прошлое','Настоящее','Будущее'] : [''];
  const all = [...flippedCards].sort();
  const total = all.length;

  desc.style.display = 'block';
  desc.innerHTML = all.map((i, idx) => {
    const c = drawnCards[i];
    const isChaos = c.suit === 'chaos';
    const nameStyle = isChaos ? 'color:#00ffff;text-shadow:0 0 6px #ff00ff;' : 'color:var(--accent2);';
    const label = labels[i] ? `<span style="color:var(--textd);font-size:8px;letter-spacing:2px">${labels[i]} · </span>` : '';
    const revTag = c.reversed ? `<span style="color:var(--cursec);font-size:9px"> [перевёрнута]</span>` : '';
    const meaning = c.reversed
      ? `<span class="tarot-desc-rev">⊗ ${c.rx}</span>`
      : `⟡ ${c.up}`;
    const sep = idx < total-1 ? `border-bottom:1px dashed var(--border);margin-bottom:8px;padding-bottom:8px;` : '';
    return `<div style="${sep}">
      ${label}<b style="${nameStyle}">${c.name}</b>${revTag}<br>${meaning}
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
  tile.textContent = r.sym;
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
    <div style="display:flex;flex-direction:column;gap:8px;max-width:380px">
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
  if (activeMiniGame === 'tarot')  body = renderTarotSection();
  if (activeMiniGame === 'runes')  body = renderRunesSection();
  if (activeMiniGame === 'norse')  body = renderNorseRunesSection();
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
