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

let attachedImage = null;
function attachImage() {
  const url = prompt('Введите прямой URL адрес картинки (https://...):');
  if(url) { attachedImage = url; toast('Фото прикреплено к мыслеформе.'); }
}

const LEVELS = ['неофит','блуждающий разум','ищущий','буйный','созерцатель','пуник','практик','знающий','пустое поле'];

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
  const u = {
    name, pass, avatar:regAv, karma:0, sparkColor:'#ff6600', selBg:'#3a0000', selFg:'#ff4400',
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
  
  // ВКЛЮЧАЕМ ИНСТРУМЕНТЫ БОГА
  if (isAdmin()) {
    document.getElementById('btn-attach-img').style.display = 'inline-block';
    document.getElementById('extranet-panel').style.display = 'block';
  }

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
  const map = {ether:0, broadcasts:1, chats:2, mypage:3, profile:4};
  if(map[p]!==undefined) tabs[map[p]].classList.add('active');
  if(p==='chats') renderDialogs();
  if(p==='profile') renderProfilePage();
  if(p==='broadcasts') renderForums();
  if(p==='mypage') renderMyPage(ME);
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
  const body = p.body.replace(/\[spoiler\](.*?)\[\/spoiler\]/g,'<span class="spoiler" onclick="this.classList.toggle(\'open\')">$1</span>');
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
        <div class="comment-body" style="word-break:break-word;">${c.body}</div>
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
  document.getElementById('sb-hot').innerHTML = hot.length ? hot.map(p=>`<div class="sb-row"><a>${p.body.substring(0,28)}...</a><span>${(p.likes||[]).length}⟡</span></div>`).join('') : '<div style="color:var(--textd);font-size:9px">Пока пусто</div>';
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
  updateUser(ME); save(); renderFeed(); renderSidebar(); toast('Астральное тело обновлено.');
}

function setTheme(theme) {
  document.body.className = theme;
  if(ME) { ME.theme=theme; saveMe(); updateUser(ME); save(); }
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
