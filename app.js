// ====== CONFIG ======
// Paste your deployed Apps Script Web App URL below (ends in /exec)
const CONFIG = {
  API_URL: 'API_URL: 'https://script.google.com/macros/s/AKfycbw5H8V18If04bbuJUpFRBchuHouZ_Y9VHM0BSzk3VCv5aagPXD1suP45e2hiFpGGWNcRQ/exec'
};

const BRANCHES = ['Urban Sports Arena', 'Rishikul Vijay', 'Gyanvihar'];
let STATE = {
  pin: sessionStorage.getItem('aslPin') || '',
  branch: localStorage.getItem('aslBranch') || BRANCHES[0],
  students: [],
  fees: [],
  attendance: [],
  month: currentMonthLabel(),
  date: todayStr(),
  attDraft: {}
};

function currentMonthLabel(){
  const d = new Date();
  return d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear();
}
function monthLabelOffset(offset){
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear();
}
function todayStr(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

// ====== API HELPERS ======
async function apiGet(action, params={}){
  const q = new URLSearchParams({ action, pin: STATE.pin, ...params }).toString();
  const res = await fetch(`${CONFIG.API_URL}?${q}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}
async function apiPost(action, payload={}){
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, pin: STATE.pin, ...payload })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

// ====== LOGIN ======
const loginEl = document.getElementById('login');
document.getElementById('loginBtn').addEventListener('click', tryLogin);
document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin(){
  const pin = document.getElementById('pinInput').value.trim();
  if (!pin) return;
  STATE.pin = pin;
  const errEl = document.getElementById('loginErr');
  errEl.textContent = 'Checking…';
  try {
    await apiGet('branches');
    sessionStorage.setItem('aslPin', pin);
    loginEl.style.display = 'none';
    boot();
  } catch (err) {
    errEl.textContent = 'Wrong PIN or app not connected yet.';
  }
}

if (STATE.pin) {
  loginEl.style.display = 'none';
  boot();
} else {
  loginEl.style.display = 'flex';
}

// ====== BOOT ======
function boot(){
  const sel = document.getElementById('branchSelect');
  sel.innerHTML = BRANCHES.map(b => `<option value="${b}" ${b===STATE.branch?'selected':''}>${b}</option>`).join('');
  sel.addEventListener('change', () => {
    STATE.branch = sel.value;
    localStorage.setItem('aslBranch', STATE.branch);
    refreshAll();
  });

  const monthSel = document.getElementById('monthSelect');
  const months = [monthLabelOffset(-1), currentMonthLabel(), monthLabelOffset(1)];
  monthSel.innerHTML = months.map(m => `<option value="${m}" ${m===STATE.month?'selected':''}>${m}</option>`).join('');
  monthSel.addEventListener('change', () => { STATE.month = monthSel.value; loadFees(); });

  const dateInput = document.getElementById('attDate');
  dateInput.value = STATE.date;
  dateInput.addEventListener('change', () => { STATE.date = dateInput.value; STATE.attDraft = {}; loadAttendance(); });

  refreshAll();
}

async function refreshAll(){
  await Promise.all([loadStudents(), loadFees(), loadAttendance(), loadSummary()]);
}

// ====== TABS ======
function goTab(tab){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + tab).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('fabAdd').style.display = (tab === 'students') ? 'flex' : 'none';
}
document.getElementById('fabAdd').style.display = 'none';

// ====== SUMMARY / SCOREBOARD ======
async function loadSummary(){
  try {
    const s = await apiGet('summary', { branch: STATE.branch, month: STATE.month, date: STATE.date });
    document.getElementById('sStudents').textContent = s.totalStudents;
    document.getElementById('sReceived').textContent = formatMoneyShort(s.totalReceived);
    document.getElementById('sDue').textContent = formatMoneyShort(s.totalDue);
    document.getElementById('sPresent').textContent = s.presentToday;
    document.getElementById('dashInfo').innerHTML = `
      <div class="studentRow"><div><div class="name">Collected — ${STATE.month}</div><div class="meta">${STATE.branch}</div></div><b class="display">₹${s.totalReceived}</b></div>
      <div class="studentRow"><div><div class="name">Due — ${STATE.month}</div></div><b class="display" style="color:var(--alert)">₹${s.totalDue}</b></div>
      <div class="studentRow"><div><div class="name">Marked today</div><div class="meta">${STATE.date}</div></div><b class="display">${s.markedToday}/${s.totalStudents}</b></div>
    `;
  } catch (err) { console.error(err); }
}
function formatMoneyShort(n){
  n = Number(n) || 0;
  if (n >= 1000) return '₹' + (n/1000).toFixed(1).replace(/\.0$/,'') + 'k';
  return '₹' + n;
}

// ====== STUDENTS ======
async function loadStudents(){
  try {
    STATE.students = (await apiGet('students', { branch: STATE.branch })).filter(s => s.Status !== 'Inactive');
    renderStudents();
  } catch (err) { console.error(err); }
}
function renderStudents(){
  document.getElementById('studentCount').textContent = `(${STATE.students.length})`;
  const el = document.getElementById('studentsList');
  if (!STATE.students.length) { el.innerHTML = '<div class="empty">No students yet. Tap + to add one.</div>'; return; }
  el.innerHTML = STATE.students.map(s => `
    <div class="studentRow">
      <div><div class="name">${s.Name}</div><div class="meta">${s.Contact || 'No contact'} · ₹${s.FeeAmount || '—'}/mo</div></div>
    </div>
  `).join('');
}

function openAddStudent(){
  document.getElementById('modalBody').innerHTML = `
    <h3>Add student</h3>
    <label class="formLabel">Name</label>
    <input type="text" id="newName" placeholder="Student name">
    <label class="formLabel">Contact</label>
    <input type="text" id="newContact" placeholder="Phone number">
    <label class="formLabel">Monthly fee (₹)</label>
    <input type="number" id="newFee" placeholder="2500">
    <label class="formLabel">Join date</label>
    <input type="date" id="newJoin" value="${todayStr()}">
    <button class="primaryBtn" onclick="submitAddStudent()">Save student</button>
  `;
  openModal();
}
async function submitAddStudent(){
  const name = document.getElementById('newName').value.trim();
  if (!name) return;
  const branchCode = STATE.branch.split(' ').map(w=>w[0]).join('').toUpperCase();
  await apiPost('addStudent', {
    student: {
      branch: STATE.branch,
      branchCode,
      name,
      contact: document.getElementById('newContact').value.trim(),
      feeAmount: document.getElementById('newFee').value,
      joinDate: document.getElementById('newJoin').value
    }
  });
  closeModal();
  loadStudents();
  loadSummary();
}

// ====== FEES ======
async function loadFees(){
  try {
    STATE.fees = await apiGet('fees', { branch: STATE.branch, month: STATE.month });
    renderFees();
  } catch (err) { console.error(err); }
}
function renderFees(){
  const feesByStudent = {};
  STATE.fees.forEach(f => feesByStudent[f.StudentID] = f);
  const el = document.getElementById('feesList');
  if (!STATE.students.length) { el.innerHTML = '<div class="empty">Add students first.</div>'; return; }
  el.innerHTML = STATE.students.map(s => {
    const f = feesByStudent[s.StudentID];
    const received = f ? Number(f.AmountReceived) || 0 : 0;
    const due = Number(s.FeeAmount) || 0;
    const isPaid = received >= due && due > 0;
    return `
      <div class="studentRow">
        <div><div class="name">${s.Name}</div><div class="meta">₹${received} of ₹${due || '—'}</div></div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="pill ${isPaid ? 'paid' : 'due'}">${isPaid ? 'Paid' : 'Due'}</span>
          <button class="ghostBtn" style="width:auto; color:var(--pitch); font-weight:700; padding:6px 4px;" onclick="openRecordFee('${s.StudentID}')">Edit</button>
        </div>
      </div>
    `;
  }).join('');
}
function openRecordFee(studentId){
  const s = STATE.students.find(x => x.StudentID === studentId);
  const f = STATE.fees.find(x => x.StudentID === studentId);
  document.getElementById('modalBody').innerHTML = `
    <h3>${s.Name} — ${STATE.month}</h3>
    <label class="formLabel">Amount due (₹)</label>
    <input type="number" id="feeDue" value="${f ? f.AmountDue : (s.FeeAmount||'')}">
    <label class="formLabel">Amount received (₹)</label>
    <input type="number" id="feeReceived" value="${f ? f.AmountReceived : 0}">
    <label class="formLabel">Date received</label>
    <input type="date" id="feeDate" value="${f && f.DateReceived ? f.DateReceived : todayStr()}">
    <label class="formLabel">Mode</label>
    <select id="feeMode" class="formInput">
      ${['UPI','Cash','Bank Transfer','Other'].map(m => `<option ${f && f.Mode===m?'selected':''}>${m}</option>`).join('')}
    </select>
    <button class="primaryBtn" onclick="submitFee('${studentId}')">Save</button>
  `;
  openModal();
}
async function submitFee(studentId){
  const s = STATE.students.find(x => x.StudentID === studentId);
  await apiPost('recordFee', {
    fee: {
      studentId, branch: STATE.branch, name: s.Name, month: STATE.month,
      amountDue: document.getElementById('feeDue').value,
      amountReceived: document.getElementById('feeReceived').value,
      dateReceived: document.getElementById('feeDate').value,
      mode: document.getElementById('feeMode').value
    }
  });
  closeModal();
  loadFees();
  loadSummary();
}

// ====== ATTENDANCE ======
async function loadAttendance(){
  try {
    STATE.attendance = await apiGet('attendance', { branch: STATE.branch, date: STATE.date });
    renderAttendance();
  } catch (err) { console.error(err); }
}
function renderAttendance(){
  const marked = {};
  STATE.attendance.forEach(a => marked[a.StudentID] = a.Status);
  const el = document.getElementById('attList');
  if (!STATE.students.length) { el.innerHTML = '<div class="empty">Add students first.</div>'; return; }
  el.innerHTML = STATE.students.map(s => {
    const status = STATE.attDraft[s.StudentID] || marked[s.StudentID] || '';
    return `
      <div class="studentRow">
        <div class="name">${s.Name}</div>
        <div class="toggleBtns">
          <button class="on-present ${status==='Present'?'active':''}" onclick="setAtt('${s.StudentID}','Present')">Present</button>
          <button class="on-absent ${status==='Absent'?'active':''}" onclick="setAtt('${s.StudentID}','Absent')">Absent</button>
        </div>
      </div>
    `;
  }).join('');
}
function setAtt(studentId, status){
  STATE.attDraft[studentId] = status;
  renderAttendance();
}
async function saveAttendance(){
  const records = Object.keys(STATE.attDraft).map(studentId => {
    const s = STATE.students.find(x => x.StudentID === studentId);
    return { studentId, branch: STATE.branch, name: s.Name, date: STATE.date, status: STATE.attDraft[studentId] };
  });
  if (!records.length) return;
  await apiPost('markAttendance', { records });
  STATE.attDraft = {};
  loadAttendance();
  loadSummary();
}

// ====== MODAL ======
function openModal(){ document.getElementById('modalOverlay').classList.add('open'); }
function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); }
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });
