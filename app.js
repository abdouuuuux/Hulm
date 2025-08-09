
// HUMl Leaflet Demo - static web app (RTL Arabic)
// Mock data, localStorage persistence, Leaflet map and geolocation

let map;
let markers = [];
const mockTrips = [
  { id:'t1', title:'Bivouac Cap Sig', type:'bivouac', date:'2025-09-20', meeting_point:'Oran bus station', lat:35.6971, lng:-0.6429, seats: genSeats(20) },
  { id:'t2', title:'Randonnée Lac Medagh', type:'randonnee', date:'2025-09-25', meeting_point:'Tlemcen center', lat:34.8781, lng:-1.3167, seats: genSeats(20) },
  { id:'t3', title:'Bivouac Cap Ivi', type:'bivouac', date:'2025-10-02', meeting_point:'Mostaganem Pier', lat:35.9375, lng:0.0898, seats: genSeats(20) }
];

function genSeats(n){ const arr=[]; for(let i=0;i<n;i++) arr.push({index:i, status: (i%6===0)?'booked':'available'}); return arr; }

function initMap(){
  map = L.map('map').setView([35.0, 0.0], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  renderMarkers();
  loadUI();
}

function renderMarkers(){
  // clear markers
  markers.forEach(m=>map.removeLayer(m));
  markers = [];
  mockTrips.forEach(trip=>{
    const m = L.marker([trip.lat, trip.lng]).addTo(map).bindPopup(`<strong>${trip.title}</strong><br>${trip.date}<br><button onclick="openTrip('${trip.id}')">عرض الرحلة</button>`);
    markers.push(m);
  });
}

// UI & app logic
function loadUI(){
  if(localStorage.getItem('huml_user')) updateWallet();
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('tripType').addEventListener('change', renderTripList);
  document.getElementById('searchInput').addEventListener('input', renderTripList);
  document.getElementById('notifyToggle').addEventListener('click', toggleNotify);
  document.getElementById('showBookings').addEventListener('click', showBookings);
  document.getElementById('locateBtn').addEventListener('click', locateMe);
  document.getElementById('demoTripBtn').addEventListener('click', createDemoTrip);
  renderTripList();
}

function login(){
  const name = document.getElementById('name').value || 'زائر';
  const phone = document.getElementById('phone').value || '000000000';
  const age = parseInt(document.getElementById('age').value) || 25;
  const photo = document.getElementById('photo').value || '';
  const user = {name, phone, age, photo, credit:10000, notifications:false, favorite:''};
  localStorage.setItem('huml_user', JSON.stringify(user));
  updateWallet();
  alert('تم التسجيل مبدئياً مع رصيد 10,000 دج');
}

function updateWallet(){ const u = JSON.parse(localStorage.getItem('huml_user')); document.getElementById('wallet').innerText = `رصيد: ${u.credit} دج`; }

function renderTripList(){
  const ul = document.getElementById('tripList'); ul.innerHTML='';
  const type = document.getElementById('tripType').value; const q = document.getElementById('searchInput').value.trim();
  mockTrips.forEach(trip=>{
    if(type!=='all' && trip.type!==type) return;
    if(q && !trip.title.includes(q) && !trip.meeting_point.includes(q)) return;
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${trip.title}</strong><div class="meta">${trip.date} • ${trip.meeting_point}</div></div><div><button class="btn small" onclick="openTrip('${trip.id}')">عرض</button></div>`;
    ul.appendChild(li);
  });
}

let currentTrip=null; let selectedSeat=null;

function openTrip(id){
  const trip = mockTrips.find(t=>t.id===id); if(!trip) return alert('غير موجود');
  map.setView([trip.lat, trip.lng], 11);
  document.getElementById('seatPanel').style.display='block';
  document.getElementById('tripTitle').innerText = trip.title;
  document.getElementById('tripInfo').innerText = `التاريخ: ${trip.date} • نقطة الالتقاء: ${trip.meeting_point}`;
  renderSeatMap(trip);
}

function renderSeatMap(trip){
  currentTrip = trip;
  const container = document.getElementById('seatMap'); container.innerHTML='';
  trip.seats.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'seat ' + (s.status==='available'?'green':(s.status==='booked'?'red':'pending'));
    div.id = `seat-${s.index}`;
    div.innerText = (s.index+1) + '\n' + (s.status==='available'?'غير محجوز':(s.status==='booked'?'محجوز':'مؤكد'));
    if(s.status!=='booked') div.addEventListener('click', ()=> selectSeat(s.index));
    container.appendChild(div);
  });
  selectedSeat = null; document.getElementById('confirmBooking').onclick = confirmBooking;
}

function selectSeat(index){
  if(selectedSeat!==null){
    const prev = document.getElementById('seat-'+selectedSeat); if(prev) prev.style.outline='';
  }
  selectedSeat = index;
  const el = document.getElementById('seat-'+index); if(el) el.style.outline='3px solid #000';
}

function confirmBooking(){
  if(selectedSeat===null) return alert('اختر المقعد أولاً');
  const pay = document.querySelector('input[name="pay"]:checked').value;
  const seatObj = currentTrip.seats[selectedSeat];
  if(seatObj.status==='booked') return alert('المقعد محجوز');
  const user = JSON.parse(localStorage.getItem('huml_user') || '{}');
  if(!user || !('credit' in user)) return alert('سجّل الدخول أولاً');
  const price = 1000;
  if(pay==='online'){
    if(user.credit < price) return alert('رصيد غير كافٍ');
    user.credit -= price;
    localStorage.setItem('huml_user', JSON.stringify(user));
    updateWallet();
    seatObj.status = 'confirmed';
    renderSeatMap(currentTrip);
    saveBooking(currentTrip.id, selectedSeat, 'confirmed', 'online');
    document.getElementById('bookingResult').innerText = 'تم الحجز ودفع إلكترونياً — المقعد مؤكد';
  } else {
    seatObj.status = 'pending';
    renderSeatMap(currentTrip);
    saveBooking(currentTrip.id, selectedSeat, 'pending', 'cash');
    document.getElementById('bookingResult').innerText = 'الحجز قيد الانتظار — سيتم تأكيده بواسطة المنظم عند الدفع نقداً';
  }
}

function saveBooking(tripId, seatIndex, status, method){
  const all = JSON.parse(localStorage.getItem('huml_bookings') || '[]');
  const user = JSON.parse(localStorage.getItem('huml_user') || '{}');
  const b = {tripId, seatIndex, status, method, user: user.name || 'زائر', time: new Date().toISOString()};
  all.push(b); localStorage.setItem('huml_bookings', JSON.stringify(all));
}

function showBookings(){
  const list = JSON.parse(localStorage.getItem('huml_bookings') || '[]');
  const container = document.getElementById('bookingsList'); container.innerHTML='';
  if(list.length===0){ container.innerText='لا توجد حجوزات بعد'; return; }
  list.forEach((b,i)=>{
    const div = document.createElement('div'); div.style.padding='6px'; div.style.borderBottom='1px solid #eee';
    div.innerHTML = `<strong>${b.user}</strong> — ${b.tripId} — مقعد ${b.seatIndex+1} — ${b.status} — ${b.method}`;
    if(b.status==='pending'){
      const btn = document.createElement('button'); btn.className='btn small'; btn.innerText='تأكيد (منظم)';
      btn.onclick = ()=>{ b.status='confirmed'; const all = JSON.parse(localStorage.getItem('huml_bookings') || '[]'); all[i].status='confirmed'; localStorage.setItem('huml_bookings', JSON.stringify(all)); const trip = mockTrips.find(t=>t.id===b.tripId); if(trip) trip.seats[b.seatIndex].status='confirmed'; renderSeatMap(trip); showBookings(); };
      div.appendChild(btn);
    }
    container.appendChild(div);
  });
}

function toggleNotify(){
  const q = document.getElementById('searchInput').value.trim(); if(!q) return alert('اكتب اسم الوجهة لتفعيل الإشعارات التجريبية');
  const user = JSON.parse(localStorage.getItem('huml_user') || '{}'); if(!user.name) return alert('سجّل الدخول أولاً');
  user.notifications = true; user.favorite = q; localStorage.setItem('huml_user', JSON.stringify(user));
  alert('تم تفعيل إشعار للوجهة: ' + q);
}

function createDemoTrip(){
  const user = JSON.parse(localStorage.getItem('huml_user') || '{}');
  const newTrip = { id: 't' + (mockTrips.length+1), title: 'رحلة جديدة ' + (mockTrips.length+1), type: 'bivouac', date: '2025-11-01', meeting_point: 'نقطة جديدة', lat: 36.7, lng: 3.216, seats: genSeats(20) };
  mockTrips.push(newTrip); renderMarkers(); renderTripList();
  if(user.notifications && user.favorite && newTrip.title.includes(user.favorite)) alert('إشعار: تم إضافة رحلة جديدة لوجهتك المفضلة!');
}

function locateMe(){
  if(!navigator.geolocation) return alert('المتصفح لا يدعم تحديد الموقع');
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat = pos.coords.latitude; const lon = pos.coords.longitude;
    const marker = L.marker([lat,lon]).addTo(map).bindPopup('موقعك الآن').openPopup();
    map.setView([lat,lon], 13);
  }, err=>{ alert('فشل في الحصول على الموقع: ' + err.message); }, { enableHighAccuracy: true });
}

// init when DOM ready
document.addEventListener('DOMContentLoaded', ()=>{
  initMap();
});
