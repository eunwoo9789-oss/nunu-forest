/* ═══════════════════════════════════
   STATE
═══════════════════════════════════ */
const S = {
  userName: null,
  token: null,
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  reservations: [],
  pendingDate: null,
  pendingOption: null,
  editId: null,
  editMode: false,      // 날짜 수정 모드
  audioCtx: null,
  musicOn: false,
  musicTimer: null,
};

/* ═══════════════════════════════════
   CONSTANTS
═══════════════════════════════════ */
const OPT = {
  lunch:  { label: '점심 (12시~13시)',        emoji: '🍱', short: '점심'  },
  dinner: { label: '저녁 (18시~19시)',        emoji: '🍽️', short: '저녁'  },
  bread:  { label: '성심당찬스기다릴래요', emoji: '🍞', short: '성심당' },
};

const KO_MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const KO_DAYS   = ['일','월','화','수','목','금','토'];

// 한국 공휴일 (음력 기반 공휴일은 추정값 포함)
const HOLIDAYS = {
  // ── 2025 ──
  '2025-01-01': '신정',
  '2025-01-27': '설날 연휴', '2025-01-28': '설날', '2025-01-29': '설날 연휴',
  '2025-03-01': '삼일절',    '2025-03-03': '대체공휴일',
  '2025-05-01': '근로자의날', '2025-05-05': '어린이날', '2025-05-06': '부처님오신날',
  '2025-06-06': '현충일',    '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴', '2025-10-06': '추석', '2025-10-07': '추석 연휴', '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',    '2025-12-25': '성탄절',
  // ── 2026 ──
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',    '2026-03-02': '대체공휴일',
  '2026-05-01': '근로자의날', '2026-05-05': '어린이날',
  '2026-05-23': '부처님오신날', '2026-05-25': '대체공휴일',
  '2026-06-06': '현충일',    '2026-08-15': '광복절',
  '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴', '2026-09-28': '대체공휴일',
  '2026-10-03': '개천절',    '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',    '2026-12-25': '성탄절',
  // ── 2027 ──
  '2027-01-01': '신정',
  '2027-02-05': '설날 연휴', '2027-02-06': '설날', '2027-02-07': '설날 연휴',
  '2027-02-08': '대체공휴일', '2027-02-09': '대체공휴일',
  '2027-03-01': '삼일절',
  '2027-05-01': '근로자의날', '2027-05-05': '어린이날',
  '2027-06-06': '현충일',    '2027-08-15': '광복절',
  '2027-10-03': '개천절',    '2027-10-09': '한글날',
  '2027-12-25': '성탄절',
};

/* ═══════════════════════════════════
   BOOT
═══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  S.token = localStorage.getItem('ac_token') || mkToken();
  localStorage.setItem('ac_token', S.token);

  // 저장된 이름이 있으면 입력창에 미리 채워두기 (자동 로그인은 하지 않음)
  const savedName = localStorage.getItem('ac_name');
  if (savedName) document.getElementById('name-input').value = savedName;

  bindAll();
  enterWelcome(); // 항상 홈화면부터 시작

  fetchAll();
  setInterval(fetchAll, 15000);
});

function mkToken() {
  return 'ac_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ═══════════════════════════════════
   ROUTING
═══════════════════════════════════ */
function enterWelcome() {
  document.getElementById('welcome-screen').classList.add('active');
  document.getElementById('calendar-screen').classList.remove('active');
}

function enterCalendar() {
  document.getElementById('welcome-screen').classList.remove('active');
  document.getElementById('calendar-screen').classList.add('active');
  document.getElementById('user-greeting').textContent =
    `🌿 안녕하세요, ${S.userName}님! 날짜를 눌러 참석 현황을 확인하세요.`;
  renderCal();
}

/* ═══════════════════════════════════
   EVENT BINDING
═══════════════════════════════════ */
function bindAll() {
  // welcome
  document.getElementById('name-submit').addEventListener('click', submitName);
  document.getElementById('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });

  // calendar nav
  document.getElementById('prev-month').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => shiftMonth(+1));

  // header
  document.querySelector('.header-logo').addEventListener('click', goHome);
  document.getElementById('music-toggle').addEventListener('click', toggleMusic);
  document.getElementById('my-reservation-btn').addEventListener('click', openMyModal);

  // option modal
  document.querySelectorAll('.option-item').forEach(el => {
    el.addEventListener('click', () => selectOption(el.dataset.option));
  });
  document.getElementById('option-cancel-btn').addEventListener('click', () => {
    closeModal('option-modal');
    S.editId = null;
  });
  document.getElementById('option-next-btn').addEventListener('click', advanceFromOption);

  // confirm modal (new / bread)
  document.getElementById('confirm-ok-btn').addEventListener('click', doConfirm);
  document.getElementById('confirm-back-btn').addEventListener('click', () => {
    closeModal('confirm-modal');
    openModal('option-modal');
  });

  // edit confirm modal
  document.getElementById('edit-ok-btn').addEventListener('click', doEditConfirm);
  document.getElementById('edit-back-btn').addEventListener('click', () => {
    closeModal('edit-confirm-modal');
    openModal('option-modal');
  });

  // my modal
  document.getElementById('close-my-modal').addEventListener('click', () => closeModal('my-modal'));

  // cancel confirm modal
  document.getElementById('cancel-ok-btn').addEventListener('click', doCancel);
  document.getElementById('cancel-back-btn').addEventListener('click', () => {
    closeModal('cancel-modal');
    openMyModal();
  });

  // close on bg click
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', () => {
      const modal = bg.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });
}

/* ═══════════════════════════════════
   WELCOME
═══════════════════════════════════ */
function submitName() {
  const input     = document.getElementById('name-input');
  const name      = input.value.trim();
  const savedName = localStorage.getItem('ac_name');

  if (!name) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 600);
    return;
  }

  // 이름이 바뀌면 새 토큰 발급 → 완전히 다른 사람으로 입장
  if (savedName && savedName !== name) {
    S.token = mkToken();
    localStorage.setItem('ac_token', S.token);
  }

  S.userName = name;
  localStorage.setItem('ac_name', name);
  if (!S.musicOn) startMusic();
  enterCalendar();
}

function goHome() {
  // 열려있는 모달 모두 닫기
  document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
  cancelEditMode();
  // 현재 이름을 입력창에 유지 (다시 입장하거나 변경 가능)
  const currentName = S.userName || localStorage.getItem('ac_name') || '';
  document.getElementById('name-input').value = currentName;
  S.userName = null;
  enterWelcome();
}

/* ═══════════════════════════════════
   CALENDAR
═══════════════════════════════════ */
function shiftMonth(delta) {
  S.month += delta;
  if (S.month > 11) { S.month = 0;  S.year++; }
  if (S.month < 0)  { S.month = 11; S.year--; }
  renderCal();
}

function renderCal() {
  document.getElementById('month-title').textContent =
    `${S.year}년 ${KO_MONTHS[S.month]}`;

  const grid    = document.getElementById('calendar-grid');
  const today   = new Date(); today.setHours(0,0,0,0);
  const first   = new Date(S.year, S.month, 1);
  const lastDay = new Date(S.year, S.month + 1, 0).getDate();

  while (grid.children.length > 7) grid.removeChild(grid.lastChild);

  for (let i = 0; i < first.getDay(); i++) {
    const e = document.createElement('div');
    e.className = 'day-cell empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= lastDay; d++) {
    const date        = new Date(S.year, S.month, d);
    const dateStr     = fmtDate(date);
    const dow         = date.getDay();
    const isPast      = date < today;
    const isToday     = date.getTime() === today.getTime();
    const holidayName = HOLIDAYS[dateStr];
    const myRes       = S.reservations.find(r => r.date === dateStr && r.token === S.token);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (isToday)     cell.classList.add('today');
    if (isPast)      cell.classList.add('past');
    if (myRes)       cell.classList.add('has-mine');
    if (dow === 0)   cell.classList.add('sun-col');
    if (dow === 6)   cell.classList.add('sat-col');
    if (holidayName) cell.classList.add('holiday');

    // day number
    const num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = d;
    cell.appendChild(num);

    // holiday label
    if (holidayName) {
      const hl = document.createElement('div');
      hl.className = 'holiday-label';
      hl.textContent = holidayName;
      cell.appendChild(hl);
    }

    // chips (show all attendees)
    const chipsEl = document.createElement('div');
    chipsEl.className = 'chips';
    const dayRes = S.reservations.filter(r => r.date === dateStr);
    dayRes.slice(0, 5).forEach(r => {
      const chip = document.createElement('div');
      chip.className = `chip ${r.option}`;
      if (r.token === S.token) chip.classList.add('mine');
      chip.textContent = `${OPT[r.option].emoji} ${r.name}`;
      chip.title = `${r.name}: ${OPT[r.option].label}`;
      chipsEl.appendChild(chip);
    });
    if (dayRes.length > 5) {
      const more = document.createElement('div');
      more.className = 'chip bread';
      more.textContent = `+${dayRes.length - 5}명 더`;
      chipsEl.appendChild(more);
    }
    cell.appendChild(chipsEl);

    // click handler
    if (!isPast || isToday) {
      cell.addEventListener('click', () => {
        if (S.editMode) {
          // 수정 모드: 날짜만 선택 후 옵션 선택으로
          S.pendingDate   = dateStr;
          S.pendingOption = null;
          document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
          document.getElementById('option-next-btn').disabled = true;
          document.getElementById('option-date-title').textContent = fmtKo(dateStr);
          openModal('option-modal');
        } else {
          openDateDetail(dateStr);
        }
      });
    }

    grid.appendChild(cell);
  }
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const n = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${n}`;
}

function fmtKo(dateStr) {
  const [y, m, n] = dateStr.split('-');
  const dow = new Date(dateStr).getDay();
  return `${y}년 ${parseInt(m)}월 ${parseInt(n)}일 (${KO_DAYS[dow]})`;
}

/* ═══════════════════════════════════
   DATE DETAIL MODAL
═══════════════════════════════════ */
function openDateDetail(dateStr) {
  const dateKo  = fmtKo(dateStr);
  const dayRes  = S.reservations.filter(r => r.date === dateStr);
  const myRes   = dayRes.find(r => r.token === S.token);
  const myAny   = S.reservations.find(r => r.token === S.token); // 내 예약 전체

  document.getElementById('detail-date-title').textContent = dateKo;

  // 각 옵션별 참석자
  ['lunch', 'dinner', 'bread'].forEach(opt => {
    const container = document.getElementById(`detail-${opt}`);
    container.innerHTML = '';
    const attendees = dayRes.filter(r => r.option === opt);
    if (attendees.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'detail-empty';
      empty.textContent = '아직 아무도 없어요 🌱';
      container.appendChild(empty);
    } else {
      attendees.forEach(r => {
        const chip = document.createElement('span');
        chip.className = `dchip ${opt}`;
        if (r.token === S.token) chip.classList.add('mine');
        chip.textContent = r.name;
        container.appendChild(chip);
      });
    }
  });

  // 하단 액션 버튼
  const actions = document.getElementById('detail-actions');
  actions.innerHTML = '';

  if (myRes) {
    // 이 날에 내 예약이 있음 → 수정/취소
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary';
    editBtn.textContent = '✏️ 수정하기';
    editBtn.onclick = () => { closeModal('detail-modal'); startEditMode(myRes.id); };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = '🍂 취소하기';
    cancelBtn.onclick = () => { closeModal('detail-modal'); startCancel(myRes.id); };

    actions.appendChild(editBtn);
    actions.appendChild(cancelBtn);
  } else if (myAny) {
    // 다른 날 예약 있음 → 신청 불가
    const msg = document.createElement('div');
    msg.style.cssText = 'font-size:0.82em;color:#a1887f;text-align:center;width:100%;padding:4px 0';
    msg.innerHTML = `⚠️ 이미 <b>${fmtKo(myAny.date)}</b>에 예약하셨어요.<br>내 예약에서 수정 또는 취소 후 재신청해주세요.`;
    actions.appendChild(msg);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-ghost';
    closeBtn.style.marginTop = '10px';
    closeBtn.style.width = '100%';
    closeBtn.textContent = '닫기';
    closeBtn.onclick = () => closeModal('detail-modal');
    actions.appendChild(closeBtn);
    actions.style.flexDirection = 'column';
  } else {
    // 예약 없음 → 신청하기
    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-primary';
    applyBtn.style.flex = '1';
    applyBtn.textContent = '🌿 신청하기';
    applyBtn.onclick = () => {
      closeModal('detail-modal');
      S.pendingDate   = dateStr;
      S.pendingOption = null;
      S.editId        = null;
      document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
      document.getElementById('option-next-btn').disabled = true;
      document.getElementById('option-date-title').textContent = dateKo;
      openModal('option-modal');
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-ghost';
    closeBtn.textContent = '닫기';
    closeBtn.onclick = () => closeModal('detail-modal');

    actions.appendChild(applyBtn);
    actions.appendChild(closeBtn);
  }

  openModal('detail-modal');
}

/* ═══════════════════════════════════
   EDIT MODE (날짜 변경)
═══════════════════════════════════ */
function startEditMode(reservationId) {
  S.editId   = reservationId;
  S.editMode = true;
  document.getElementById('edit-banner').classList.remove('hidden');
  closeModal('my-modal');
}

function cancelEditMode() {
  S.editMode = false;
  S.editId   = null;
  document.getElementById('edit-banner').classList.add('hidden');
}

/* ═══════════════════════════════════
   OPTION MODAL
═══════════════════════════════════ */
function selectOption(opt) {
  document.querySelectorAll('.option-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.option === opt);
  });
  S.pendingOption = opt;
  document.getElementById('option-next-btn').disabled = false;
}

function advanceFromOption() {
  if (!S.pendingOption) return;
  const info   = OPT[S.pendingOption];
  const dateKo = fmtKo(S.pendingDate);

  closeModal('option-modal');

  if (S.editId) {
    // 수정 확인
    document.getElementById('edit-confirm-title').textContent =
      `${dateKo}\n${info.emoji} ${info.label}`;
    openModal('edit-confirm-modal');
  } else {
    // 신규 예약 확인
    if (S.pendingOption === 'bread') {
      // 성심당 전용 메시지
      document.getElementById('confirm-emoji').textContent = '🍞';
      document.getElementById('confirm-title').textContent =
        `성심당찬스기다릴래요`;
      document.getElementById('confirm-question').textContent =
        '가능 일정 취합 후 호스트가 별도 연락드릴 예정입니다 🎁';
    } else {
      document.getElementById('confirm-emoji').textContent = '🌿';
      document.getElementById('confirm-title').textContent =
        `${dateKo}\n${info.emoji} ${info.label}`;
      document.getElementById('confirm-question').textContent = '에 해쳐모이시겠습니까?';
    }
    openModal('confirm-modal');
  }
}

/* ═══════════════════════════════════
   API
═══════════════════════════════════ */
async function fetchAll() {
  try {
    const res = await fetch('/api/reservations');
    S.reservations = await res.json();
    if (document.getElementById('calendar-screen').classList.contains('active')) renderCal();
  } catch { /* offline */ }
}

/* 신규 예약 확정 */
async function doConfirm() {
  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: S.userName, date: S.pendingDate,
        option: S.pendingOption, token: S.token
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      closeModal('confirm-modal');
      toast(`⚠️ ${data.error || '예약에 실패했습니다.'}`);
      return;
    }

    S.reservations.push(data);
    closeModal('confirm-modal');
    renderCal();
    const msg = S.pendingOption === 'bread'
      ? `🍞 성심당 찬스! 호스트가 연락드릴게요~`
      : `🎉 ${fmtKo(S.pendingDate)} ${OPT[S.pendingOption].emoji} 예약 완료!`;
    toast(msg);
  } catch {
    toast('⚠️ 서버에 연결할 수 없습니다.');
  }
}

/* 수정 확정 */
async function doEditConfirm() {
  try {
    const res = await fetch(`/api/reservations/${S.editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: S.pendingDate, option: S.pendingOption, token: S.token }),
    });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    const idx = S.reservations.findIndex(r => r.id === S.editId);
    if (idx !== -1) S.reservations[idx] = updated;

    closeModal('edit-confirm-modal');
    cancelEditMode();
    renderCal();
    toast(`✨ 예약이 변경되었어요!`);
  } catch {
    toast('⚠️ 수정에 실패했습니다.');
  }
}

/* ═══════════════════════════════════
   MY RESERVATIONS
═══════════════════════════════════ */
function openMyModal() {
  const mine = S.reservations.filter(r => r.token === S.token)
    .sort((a, b) => a.date.localeCompare(b.date));
  const list = document.getElementById('my-list');

  if (mine.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍃</div>
        <p>아직 예약한 일정이 없어요.<br>달력에서 날짜를 눌러보세요!</p>
      </div>`;
  } else {
    list.innerHTML = mine.map(r => `
      <div class="res-card">
        <div class="res-card-date">📅 ${fmtKo(r.date)}</div>
        <div class="res-card-opt">${OPT[r.option].emoji} ${OPT[r.option].label}</div>
        <div class="res-card-btns">
          <button class="btn-edit-sm" onclick="closeModal('my-modal');startEditMode('${r.id}')">✏️ 수정하기</button>
          <button class="btn-cancel-sm" onclick="startCancel('${r.id}')">🗑️ 취소하기</button>
        </div>
      </div>
    `).join('');
  }
  openModal('my-modal');
}

function startCancel(reservationId) {
  const r = S.reservations.find(x => x.id === reservationId);
  if (!r) return;
  S.editId = reservationId;
  document.getElementById('cancel-detail').textContent =
    `${fmtKo(r.date)} ${OPT[r.option].emoji} ${OPT[r.option].label}`;
  closeModal('my-modal');
  openModal('cancel-modal');
}

async function doCancel() {
  try {
    const res = await fetch(`/api/reservations/${S.editId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: S.token }),
    });
    if (!res.ok) throw new Error();
    S.reservations = S.reservations.filter(r => r.id !== S.editId);
    closeModal('cancel-modal');
    S.editId = null;
    renderCal();
    toast('🍂 예약이 취소되었습니다.');
  } catch {
    toast('⚠️ 취소에 실패했습니다.');
  }
}

/* ═══════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════ */
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

/* ═══════════════════════════════════
   TOAST
═══════════════════════════════════ */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden', 'out');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.classList.add('hidden'), 350);
  }, 3500);
}

/* ═══════════════════════════════════
   MUSIC  (original AC-style melody)
═══════════════════════════════════ */
const MELODY = [
  [392.00,.25],[440.00,.25],[493.88,.25],[587.33,.5],
  [493.88,.25],[440.00,.25],[392.00,.25],[0,.375],
  [329.63,.25],[392.00,.25],[440.00,.25],[493.88,.5],
  [440.00,.25],[392.00,.25],[329.63,.25],[0,.375],
  [293.66,.25],[392.00,.25],[493.88,.25],[587.33,.5],
  [493.88,.25],[392.00,.25],[293.66,.25],[0,.375],
  [392.00,.25],[493.88,.25],[587.33,.25],[783.99,.5],
  [587.33,.25],[493.88,.25],[392.00,1.0 ],[0,.5],
];

function playNote(ctx, freq, t, dur) {
  if (!freq) return;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  const g  = ctx.createGain();
  o1.connect(g); o2.connect(g); g.connect(ctx.destination);
  o1.type = 'triangle'; o1.frequency.setValueAtTime(freq, t);
  o2.type = 'sine';     o2.frequency.setValueAtTime(freq * 2, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.06);
  g.gain.setValueAtTime(0.06, t + dur - 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

function scheduleMelody(ctx, from) {
  let t = from;
  MELODY.forEach(([f, d]) => { playNote(ctx, f, t, d); t += d; });
  return t - from;
}

function startMusic() {
  if (S.musicOn) return;
  try {
    S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    S.musicOn  = true;
    document.getElementById('music-toggle').textContent = '🔇';
    const loop = () => {
      if (!S.musicOn) return;
      const dur = scheduleMelody(S.audioCtx, S.audioCtx.currentTime);
      S.musicTimer = setTimeout(loop, (dur - 0.3) * 1000);
    };
    loop();
  } catch (e) { console.warn('Audio unavailable', e); }
}

function stopMusic() {
  S.musicOn = false;
  clearTimeout(S.musicTimer);
  if (S.audioCtx) { S.audioCtx.close(); S.audioCtx = null; }
  document.getElementById('music-toggle').textContent = '🎵';
}

function toggleMusic() { S.musicOn ? stopMusic() : startMusic(); }
