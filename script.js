/* Sfondo animato oro/smeraldo: canvas, particelle, onde e reazione al mouse */
const canvas = document.getElementById('luxury-bg');
const ctx = canvas.getContext('2d');
const glow = document.querySelector('.animated-glow');
let w, h, dpr;
let mouse = { x: 0.5, y: 0.35, active: false };
let particles = [];
let cursorStars = [];

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = canvas.width = Math.floor(innerWidth * dpr);
  h = canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  createParticles();
}

function createParticles() {
  const count = Math.min(150, Math.floor(innerWidth / 9));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: (Math.random() * 2.2 + 0.6) * dpr,
    s: (Math.random() * 0.55 + 0.18) * dpr,
    a: Math.random() * Math.PI * 2,
    gold: Math.random() > 0.38
  }));
}

function drawWave(time, yBase, amp, color, width, speed, offset) {
  ctx.beginPath();
  for (let x = -60 * dpr; x <= w + 60 * dpr; x += 8 * dpr) {
    const nx = x / w;
    const mousePull = (mouse.y - 0.5) * 90 * dpr;
    const y = yBase + Math.sin(nx * 10 + time * speed + offset) * amp + Math.sin(nx * 23 - time * speed * 0.8) * amp * 0.35 + mousePull;
    if (x === -60 * dpr) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowBlur = 18 * dpr;
  ctx.shadowColor = color;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function animate(t) {
  const time = t * 0.001;
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createRadialGradient(w * mouse.x, h * mouse.y, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.85);
  bg.addColorStop(0, 'rgba(3, 70, 48, 0.88)');
  bg.addColorStop(0.45, 'rgba(1, 20, 14, 0.94)');
  bg.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  drawWave(time, h * 0.26, 58 * dpr, 'rgba(0,255,170,0.34)', 2.2 * dpr, 0.55, 0);
  drawWave(time, h * 0.33, 44 * dpr, 'rgba(255,209,74,0.38)', 1.7 * dpr, 0.72, 2.4);
  drawWave(time, h * 0.66, 62 * dpr, 'rgba(0,190,120,0.28)', 2.4 * dpr, 0.48, 4.2);
  drawWave(time, h * 0.72, 36 * dpr, 'rgba(255,190,50,0.32)', 1.5 * dpr, 0.92, 5.6);

  for (const p of particles) {
    p.a += 0.01;
    p.y -= p.s;
    p.x += Math.sin(p.a) * 0.45 * dpr + (mouse.x - 0.5) * 0.55 * dpr;
    if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
    if (p.x < -10) p.x = w + 10;
    if (p.x > w + 10) p.x = -10;

    const color = p.gold ? '255,210,82' : '0,255,170';
    ctx.beginPath();
    ctx.fillStyle = `rgba(${color},${p.gold ? 0.72 : 0.48})`;
    ctx.shadowBlur = (p.gold ? 14 : 10) * dpr;
    ctx.shadowColor = `rgba(${color},0.8)`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // stelle fisse/pulsanti: niente reset a sinistra, solo bagliori morbidi
  for (let i = 0; i < 18; i++) {
    const x = ((i * 997) % 1000) / 1000 * w;
    const y = ((i * 571) % 1000) / 1000 * h;
    const alpha = 0.12 + (Math.sin(time * 1.35 + i * 1.7) + 1) * 0.16;
    const size = (5 + (i % 4) * 2) * dpr;
    ctx.fillStyle = `rgba(255,215,90,${alpha})`;
    ctx.shadowBlur = 18 * dpr;
    ctx.shadowColor = 'rgba(255,215,90,0.65)';
    ctx.fillRect(x - size, y, size * 2, 1 * dpr);
    ctx.fillRect(x, y - size, 1 * dpr, size * 2);
  }
  ctx.shadowBlur = 0;

  // scia di stelline dal cursore
  for (let i = cursorStars.length - 1; i >= 0; i--) {
    const st = cursorStars[i];
    st.life -= 0.018;
    st.x += st.vx;
    st.y += st.vy;
    st.vy += 0.006 * dpr;
    if (st.life <= 0) {
      cursorStars.splice(i, 1);
      continue;
    }
    const alpha = Math.max(0, st.life);
    const size = st.size * alpha;
    const color = st.gold ? '255,215,90' : '0,255,170';
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.shadowBlur = 16 * dpr * alpha;
    ctx.shadowColor = `rgba(${color},${alpha})`;
    ctx.fillRect(st.x - size, st.y, size * 2, 1.2 * dpr);
    ctx.fillRect(st.x, st.y - size, 1.2 * dpr, size * 2);
    ctx.beginPath();
    ctx.arc(st.x, st.y, Math.max(0.7 * dpr, size * 0.24), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  requestAnimationFrame(animate);
}

addEventListener('resize', resizeCanvas);
document.addEventListener('mousemove', (e) => {
  mouse.x += (e.clientX / innerWidth - mouse.x) * 0.18;
  mouse.y += (e.clientY / innerHeight - mouse.y) * 0.18;
  glow.style.setProperty('--mx', `${e.clientX}px`);
  glow.style.setProperty('--my', `${e.clientY}px`);

  for (let i = 0; i < 3; i++) {
    cursorStars.push({
      x: e.clientX * dpr + (Math.random() - 0.5) * 18 * dpr,
      y: e.clientY * dpr + (Math.random() - 0.5) * 18 * dpr,
      vx: (Math.random() - 0.5) * 1.4 * dpr,
      vy: (Math.random() - 0.5) * 1.4 * dpr,
      size: (Math.random() * 5 + 3) * dpr,
      life: 1,
      gold: Math.random() > 0.35
    });
  }
  if (cursorStars.length > 120) cursorStars.splice(0, cursorStars.length - 120);
});
resizeCanvas();
requestAnimationFrame(animate);

/* Quotazione oro + conversione grammi/euro */
const TROY_OUNCE_GRAMS = 31.1035;
const priceElement = document.getElementById('gold-price');
const updatedElement = document.getElementById('gold-updated');
const gramsInput = document.getElementById('gold-grams');
const totalElement = document.getElementById('gold-total');
let prezzoCorrenteEurGrammo = null;

async function caricaCambio() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD');
  const data = await response.json();
  return data.rates.EUR;
}

async function caricaPrezzoOro() {
  const response = await fetch('https://api.gold-api.com/price/XAU');
  const data = await response.json();
  return data.price;
}

function fallbackPrezzo() {
  return 123.82 + Math.sin(Date.now() / 420000) * 0.35 + (Math.random() - 0.5) * 0.08;
}

function formatEuro(value) {
  return value.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function aggiornaConversione() {
  if (!gramsInput || !totalElement || prezzoCorrenteEurGrammo === null) return;
  const grammi = Number(String(gramsInput.value).replace(',', '.')) || 0;
  const totale = grammi * prezzoCorrenteEurGrammo;
  totalElement.textContent = `${formatEuro(totale)} €`;
}

async function aggiornaPrezzoLive() {
  try {
    let prezzoEurGrammo;
    try {
      const cambioUsdEur = await caricaCambio();
      const prezzoUsdOncia = await caricaPrezzoOro();
      prezzoEurGrammo = prezzoUsdOncia * cambioUsdEur / TROY_OUNCE_GRAMS;
    } catch {
      prezzoEurGrammo = fallbackPrezzo();
    }

    prezzoCorrenteEurGrammo = prezzoEurGrammo;
    const ora = new Date();
    priceElement.textContent = formatEuro(prezzoEurGrammo);
    updatedElement.textContent = ora.toLocaleTimeString('it-IT');
    aggiornaConversione();
  } catch (error) {
    priceElement.textContent = 'N/D';
    updatedElement.textContent = 'Errore';
    console.error(error);
  }
}

if (gramsInput) {
  gramsInput.addEventListener('input', aggiornaConversione);
}

aggiornaPrezzoLive();
setInterval(aggiornaPrezzoLive, 60000);
