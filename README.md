<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Happy Women's Day, Varsha 🌹</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Dancing+Script:wght@500;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --deep: #0a0510;
    --rose: #c0415a;
    --blush: #f2a7b8;
    --gold: #d4a84b;
    --cream: #fdf4e7;
    --muted: #7a5c6a;
  }

  body {
    background: var(--deep);
    font-family: 'Cormorant Garamond', serif;
    color: var(--cream);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Starfield */
  .stars {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
  .star {
    position: absolute;
    border-radius: 50%;
    background: white;
    animation: twinkle var(--dur) ease-in-out infinite alternate;
  }
  @keyframes twinkle {
    from { opacity: 0.1; transform: scale(0.8); }
    to   { opacity: 0.9; transform: scale(1.2); }
  }

  /* Floating petals */
  .petal {
    position: fixed;
    font-size: 18px;
    opacity: 0;
    animation: fall var(--spd) linear var(--delay) infinite;
    z-index: 1;
    pointer-events: none;
  }
  @keyframes fall {
    0%   { transform: translateY(-40px) rotate(0deg); opacity: 0; }
    10%  { opacity: 0.7; }
    90%  { opacity: 0.5; }
    100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
  }

  /* Page wrapper */
  .page {
    position: relative;
    z-index: 2;
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 20px 80px;
  }

  /* Header */
  .header {
    text-align: center;
    margin-bottom: 50px;
    animation: fadeUp 1s ease forwards;
  }
  .header .day-label {
    font-family: 'Cormorant Garamond', serif;
    font-size: 12px;
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 12px;
  }
  .header h1 {
    font-family: 'Dancing Script', cursive;
    font-size: clamp(2.6rem, 7vw, 4.2rem);
    color: var(--cream);
    line-height: 1.15;
  }
  .header h1 span { color: var(--blush); }
  .header .sub {
    margin-top: 10px;
    font-style: italic;
    font-size: 1.1rem;
    color: var(--muted);
  }
  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
    margin: 18px 0;
  }
  .divider span { font-size: 20px; }
  .divider::before, .divider::after {
    content: '';
    flex: 1;
    max-width: 140px;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--rose));
  }
  .divider::after { background: linear-gradient(to left, transparent, var(--rose)); }

  /* Photo collage grid */
  .collage {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 200px 200px;
    gap: 10px;
    margin: 0 auto 50px;
    animation: fadeUp 1.2s ease 0.3s forwards;
    opacity: 0;
  }
  .photo-slot {
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    background: linear-gradient(135deg, #1a0d1f 0%, #2a1128 100%);
    border: 1px solid rgba(192,65,90,0.25);
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;
  }
  .photo-slot:hover {
    transform: scale(1.03);
    box-shadow: 0 10px 40px rgba(192,65,90,0.35);
  }
  .photo-slot.wide { grid-column: span 2; }
  .photo-slot.tall { grid-row: span 2; }

  .photo-slot input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 3;
    width: 100%;
    height: 100%;
  }
  .photo-slot img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: none;
    position: absolute;
    inset: 0;
    z-index: 2;
  }
  .slot-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    z-index: 1;
  }
  .slot-placeholder .icon { font-size: 28px; opacity: 0.5; }
  .slot-placeholder .hint {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .slot-label {
    position: absolute;
    bottom: 10px;
    left: 10px;
    z-index: 4;
    font-family: 'Dancing Script', cursive;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    pointer-events: none;
  }

  /* Shayari cards */
  .shayari-section {
    display: flex;
    flex-direction: column;
    gap: 28px;
    margin-bottom: 50px;
  }
  .shayari-card {
    background: linear-gradient(135deg, rgba(192,65,90,0.08) 0%, rgba(20,8,26,0.7) 100%);
    border: 1px solid rgba(192,65,90,0.2);
    border-radius: 16px;
    padding: 30px 36px;
    position: relative;
    overflow: hidden;
    animation: fadeUp 1s ease forwards;
    opacity: 0;
  }
  .shayari-card::before {
    content: '"';
    position: absolute;
    top: -20px;
    left: 20px;
    font-family: 'Playfair Display', serif;
    font-size: 120px;
    color: rgba(192,65,90,0.1);
    line-height: 1;
    pointer-events: none;
  }
  .shayari-card .tag {
    font-size: 10px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 14px;
    display: block;
  }
  .shayari-card .lines {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.25rem;
    line-height: 2;
    font-style: italic;
    color: var(--cream);
  }
  .shayari-card .lines .hindi { color: var(--blush); font-style: normal; }

  /* Footer */
  .footer {
    text-align: center;
    animation: fadeUp 1s ease 0.8s forwards;
    opacity: 0;
  }
  .footer .apology {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1rem;
    font-style: italic;
    color: var(--muted);
    max-width: 480px;
    margin: 0 auto 24px;
    line-height: 1.8;
  }
  .footer .sign {
    font-family: 'Dancing Script', cursive;
    font-size: 2rem;
    color: var(--blush);
  }
  .footer .rose { font-size: 2rem; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .shayari-card:nth-child(1) { animation-delay: 0.4s; }
  .shayari-card:nth-child(2) { animation-delay: 0.6s; }
  .shayari-card:nth-child(3) { animation-delay: 0.8s; }
  .shayari-card:nth-child(4) { animation-delay: 1.0s; }
  .shayari-card:nth-child(5) { animation-delay: 1.2s; }

  .upload-hint {
    text-align: center;
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 14px;
  }
</style>
</head>
<body>

<!-- Stars -->
<canvas class="stars" id="stars"></canvas>

<!-- Petals -->
<script>
  const petals = ['🌸','🌹','🌺','✨','💕'];
  for(let i = 0; i < 14; i++){
    const p = document.createElement('div');
    p.className = 'petal';
    p.textContent = petals[Math.floor(Math.random()*petals.length)];
    p.style.left = Math.random()*100 + 'vw';
    p.style.setProperty('--spd', (8+Math.random()*10)+'s');
    p.style.setProperty('--delay', (Math.random()*10)+'s');
    document.body.appendChild(p);
  }
</script>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="day-label">March 8 · International Women's Day</div>
    <h1>Happy Women's Day,<br><span>Varsha 🌹</span></h1>
    <div class="sub">Late tha main, par dil se hoon —</div>
    <div class="divider"><span>✦</span></div>
  </div>

  <!-- Photo Collage -->
  <p class="upload-hint">✦ Click each frame to add your photos ✦</p>
  <div class="collage" id="collage">
    <div class="photo-slot wide" data-label="Us 💕">
      <input type="file" accept="image/*" onchange="loadPhoto(this)">
      <div class="slot-placeholder"><div class="icon">📷</div><div class="hint">Add Photo</div></div>
      <img alt="">
      <div class="slot-label">Us 💕</div>
    </div>
    <div class="photo-slot" data-label="Her ✨">
      <input type="file" accept="image/*" onchange="loadPhoto(this)">
      <div class="slot-placeholder"><div class="icon">📷</div><div class="hint">Add Photo</div></div>
      <img alt="">
      <div class="slot-label">Her ✨</div>
    </div>
    <div class="photo-slot" data-label="My fav 🌸">
      <input type="file" accept="image/*" onchange="loadPhoto(this)">
      <div class="slot-placeholder"><div class="icon">📷</div><div class="hint">Add Photo</div></div>
      <img alt="">
      <div class="slot-label">My fav 🌸</div>
    </div>
    <div class="photo-slot wide" data-label="Always 🌹">
      <input type="file" accept="image/*" onchange="loadPhoto(this)">
      <div class="slot-placeholder"><div class="icon">📷</div><div class="hint">Add Photo</div></div>
      <img alt="">
      <div class="slot-label">Always 🌹</div>
    </div>
  </div>

  <!-- Shayari -->
  <div class="shayari-section">

    <div class="shayari-card">
      <span class="tag">✦ Maafi · Apology</span>
      <div class="lines">
        <span class="hindi">Der se aaya hoon, par dil poora hai,</span><br>
        Teri parwah ka yeh ehsaas bhi kuch aur hi hota hai.<br>
        <span class="hindi">Maaf kar de ek baar, meri Varsha,</span><br>
        Tu hai toh yeh din bhi khaas hi hota hai.
      </div>
    </div>

    <div class="shayari-card">
      <span class="tag">✦ Aankhein · Her Eyes</span>
      <div class="lines">
        <span class="hindi">Teri aankhon mein kuch sitare chhupe hain,</span><br>
        Jab bhi dekhu, dil ke saare darwaaze khule hain.<br>
        <span class="hindi">Woh glitter nahi joh tu lagaati hai,</span><br>
        Woh chamak toh bas teri apni hi hai.
      </div>
    </div>

    <div class="shayari-card">
      <span class="tag">✦ Woh Khaali Seat</span>
      <div class="lines">
        <span class="hindi">Gaadi chalata hoon, tu nahi hoti saath mein,</span><br>
        Woh passenger seat bhi tujhe hi yaad dilaati hai baatein.<br>
        <span class="hindi">Teri gairhaziri bhi mujhpe raaj karti hai,</span><br>
        Tu ho ya na ho — tu mere dil mein jaati hai.
      </div>
    </div>

    <div class="shayari-card">
      <span class="tag">✦ Sajti Hai Jab · Her Glow</span>
      <div class="lines">
        <span class="hindi">Jab tu sajti hai, waqt thhama rehta hai,</span><br>
        Bas main hoon aur teri woh ada rehti hai.<br>
        <span class="hindi">Har baar dekhunga teri taraf aise hi,</span><br>
        Jaise pehli baar dil ne kuch kaha ho waisi.
      </div>
    </div>

    <div class="shayari-card">
      <span class="tag">✦ Bossy & Mine · Her Vibe</span>
      <div class="lines">
        <span class="hindi">Boss bhi hai, pyaar bhi hai, sab kuch tu hi hai,</span><br>
        Teri ek order mein mera poora jehan hai.<br>
        <span class="hindi">Lovey dovey bhi, stubborn bhi — perfect wahi hai,</span><br>
        Jo main dhundha tha woh sirf Varsha hi hai.
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <p class="apology">
      I know I was late today, and you deserved to wake up to this.<br>
      But this is my way of being the last wish of your day —<br>
      because you're always the last thought of mine. 🌙
    </p>
    <div class="rose">🌹🌹🌹</div>
    <div class="sign">— Yours, always 💕</div>
  </div>

</div>

<script>
  // Stars canvas
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  for(let i=0;i<180;i++){
    const x = Math.random()*canvas.width;
    const y = Math.random()*canvas.height;
    const r = Math.random()*1.5;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.7+0.1})`;
    ctx.fill();
  }

  // Photo loader
  function loadPhoto(input) {
    const slot = input.closest('.photo-slot');
    const img = slot.querySelector('img');
    const placeholder = slot.querySelector('.slot-placeholder');
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target.result;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
</script>
</body>
</html>