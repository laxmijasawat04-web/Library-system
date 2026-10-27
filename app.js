const SEAT_COUNT = 36;
const seatMap = document.querySelector('#seatMap');
const availableStat = document.querySelector('#availableStat');
const mapAvailable = document.querySelector('#mapAvailable');
const selectedSeatLabel = document.querySelector('#selectedSeat');
const bookButton = document.querySelector('#bookButton');
const historyList = document.querySelector('#historyList');
const slotSelect = document.querySelector('#slotSelect');
const dateInput = document.querySelector('#bookingDate');
const STORAGE_KEY = 'library-bookings-v1';
const OCCUPIED_KEY = 'library-occupied-v1';
const today = new Date();
today.setHours(0, 0, 0, 0);
dateInput.value = toDateInput(today);
dateInput.min = toDateInput(today);
document.querySelector('#todayLabel').textContent = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
document.querySelector('.welcome .eyebrow').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

function toDateInput(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function getBookings() { return read(STORAGE_KEY, []); }
function getOccupied() { return read(OCCUPIED_KEY, {}); }
function slotKey() { return `${dateInput.value}|${slotSelect.value}`; }
function seatName(n) { return `A${String(n).padStart(2,'0')}`; }
function activeOccupied() { return getOccupied()[slotKey()] || []; }
let selectedSeat = null;
let selectedResource = 'Reading Hall';

// Demo occupancy makes the seat map useful immediately. Real bookings are saved locally.
if (!localStorage.getItem(OCCUPIED_KEY)) {
  localStorage.setItem(OCCUPIED_KEY, JSON.stringify({ [`${dateInput.value}|09:00`]: ['A02','A04','A07','A09','A12','A15','A18','A21','A25','A28','A31','A34'] }));
}

function renderSeats() {
  const occupied = activeOccupied();
  const container = document.createDocumentFragment();
  for (let n = 1; n <= SEAT_COUNT; n++) {
    const name = seatName(n);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'seat'; button.textContent = name;
    button.setAttribute('aria-label', `${name}, ${occupied.includes(name) ? 'occupied' : 'available'}`);
    if (occupied.includes(name)) { button.classList.add('occupied'); button.disabled = true; }
    if (name === selectedSeat && !occupied.includes(name)) button.classList.add('selected');
    button.addEventListener('click', () => { selectedSeat = name; renderSeats(); updateSelection(); });
    container.append(button);
  }
  seatMap.replaceChildren(container);
  const available = SEAT_COUNT - occupied.length;
  availableStat.textContent = available; mapAvailable.textContent = available;
  document.querySelector('.stat-card:nth-child(1) small').textContent = `Out of ${SEAT_COUNT} total seats`;
}
function updateSelection() { selectedSeatLabel.textContent = selectedSeat || 'No seat selected'; bookButton.disabled = !selectedSeat; }
function fmtTime(time) { let [h,m] = time.split(':').map(Number); const suffix = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${suffix}`; }
function fmtDate(value) { return new Intl.DateTimeFormat('hi-IN', {day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T00:00:00`)); }
function renderHistory() {
  const bookings = getBookings().sort((a,b) => b.createdAt-a.createdAt);
  const active = bookings.filter(b => b.status === 'active').length;
  document.querySelector('#activeStat').textContent = active;
  if (!bookings.length) { historyList.innerHTML = '<div class="empty-history">No bookings yet. Choose a seat above to make your first booking.</div>'; return; }
  historyList.innerHTML = bookings.slice(0, 5).map(b => `<div class="booking-row"><div class="history-icon">▣</div><div><strong>${escapeHtml(b.resource)} · Seat ${escapeHtml(b.seat)}</strong><small>${fmtDate(b.date)} &nbsp;·&nbsp; ${fmtTime(b.slot)} – ${fmtTime(String((Number(b.slot.slice(0,2))+2)%24).padStart(2,'0')+':00')}</small></div><span class="status ${b.status === 'completed' ? 'completed' : ''}">${b.status === 'active' ? `Active · ${timeLeft(b.endsAt)}` : 'Completed'}</span><span class="row-chevron">›</span></div>`).join('');
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function timeLeft(end) { const mins = Math.max(0, Math.ceil((end-Date.now())/60000)); return `${Math.floor(mins/60)}h ${mins%60}m`; }
function releaseExpired() {
  const bookings = getBookings(); const occupied = getOccupied(); let changed = false;
  bookings.forEach(b => { if (b.status === 'active' && b.endsAt <= Date.now()) { b.status = 'completed'; const key = `${b.date}|${b.slot}`; occupied[key] = (occupied[key] || []).filter(s => s !== b.seat); changed = true; } });
  if (changed) { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)); localStorage.setItem(OCCUPIED_KEY, JSON.stringify(occupied)); renderSeats(); renderHistory(); }
}
document.querySelectorAll('.resource-option').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.resource-option').forEach(b => b.classList.remove('chosen')); btn.classList.add('chosen'); selectedResource = btn.dataset.resource; }));
dateInput.addEventListener('change', () => { selectedSeat = null; updateSelection(); renderSeats(); });
slotSelect.addEventListener('change', () => { selectedSeat = null; updateSelection(); renderSeats(); });
bookButton.addEventListener('click', () => {
  if (!selectedSeat) return;
  const occupied = getOccupied(); const key = slotKey();
  if ((occupied[key] || []).includes(selectedSeat)) { selectedSeat = null; updateSelection(); renderSeats(); showToast('This seat was just booked. Please choose another.'); return; }
  const [hour, minute] = slotSelect.value.split(':').map(Number);
  const end = new Date(`${dateInput.value}T00:00:00`); end.setHours(hour + 2, minute, 0, 0);
  const booking = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), seat:selectedSeat, resource:selectedResource, date:dateInput.value, slot:slotSelect.value, endsAt:end.getTime(), createdAt:Date.now(), status:'active' };
  occupied[key] = [...(occupied[key] || []), selectedSeat]; localStorage.setItem(OCCUPIED_KEY, JSON.stringify(occupied));
  const bookings = getBookings(); bookings.push(booking); localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  selectedSeat = null; updateSelection(); renderSeats(); renderHistory(); showToast(`Seat ${booking.seat} booked for ${fmtTime(booking.slot)}!`);
});
document.querySelector('#viewAll').addEventListener('click', () => { historyList.classList.toggle('expanded'); document.querySelector('#viewAll').textContent = historyList.classList.contains('expanded') ? 'Show less ↑' : 'View all →'; if (historyList.classList.contains('expanded')) historyList.innerHTML = getBookings().sort((a,b)=>b.createdAt-a.createdAt).map(b=>`<div class="booking-row"><div class="history-icon">▣</div><div><strong>${escapeHtml(b.resource)} · Seat ${escapeHtml(b.seat)}</strong><small>${fmtDate(b.date)} · ${fmtTime(b.slot)}</small></div><span class="status ${b.status==='completed'?'completed':''}">${b.status==='active'?'Active · '+timeLeft(b.endsAt):'Completed'}</span><span class="row-chevron">›</span></div>`).join('') || '<div class="empty-history">No bookings yet.</div>'; else renderHistory(); });
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200); }
renderSeats(); renderHistory(); setInterval(() => { releaseExpired(); renderHistory(); }, 30000);
