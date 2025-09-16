import axios from 'axios';

const API_URL = 'https://htmltoimage.cognima.com.br/api.php';

export const Welcome = async (profilePic, userNumber, groupName, memberCount) => {
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="card">
            <img class="avatar" src="${profilePic}" />
            <div class="text-content">
              <div class="welcome">Bem-vindo(a), <span>${userNumber}</span></div>
              <div class="group-name">ao grupo <strong>${groupName}</strong></div>
              <div class="member">Você é o <span>#${memberCount}º membro</span></div>
              <div class="message">☕ Quer um café enquanto lê as regras?</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const css = `
    body {
      margin: 0;
      padding: 0;
      font-family: 'Poppins', sans-serif;
      background: #0f0c29;
    }
    .banner { width: 1200px; height: 500px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); display: flex; align-items: center; justify-content: center; color: white; }
    .card { display: flex; align-items: center; background: rgba(44, 47, 63, 0.95); padding: 50px 60px; border-radius: 28px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); max-width: 1000px; width: 100%; }
    .avatar { width: 150px; height: 150px; border-radius: 50%; border: 5px solid #fff; object-fit: cover; margin-right: 40px; }
    .text-content { display: flex; flex-direction: column; justify-content: center; }
    .welcome { font-size: 36px; font-weight: 600; margin-bottom: 10px; }
    .welcome span { color: #00d2ff; }
    .group-name { font-size: 28px; margin-bottom: 8px; }
    .group-name strong { color: #feca57; }
    .member { font-size: 24px; color: #ccc; margin-bottom: 25px; }
    .message { font-size: 22px; font-style: italic; opacity: 0.9; }
  `;

  const payload = {
    html,
    css,
    viewport_width: '1200',
    viewport_height: '500',
    google_fonts: 'Poppins',
    device_scale: '2'
  };

  try {
    const { data } = await axios.post(API_URL, payload, { responseType: "arraybuffer"});
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const Ping = async (backgroundImage, characterImage, botName, pingSpeed, uptime, totalGroups, totalUsers) => {
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="character-container">
            <img class="character" src="${characterImage}" />
          </div>
          <div class="info-boxes left-boxes">
            <div class="box groups-box"><h3>Total de Grupos 👥</h3><p>${totalGroups}</p></div>
            <div class="box users-box"><h3>Total de Usuários 🌟</h3><p>${totalUsers}</p></div>
          </div>
          <div class="info-boxes right-boxes">
            <div class="box speed-box"><h3>Velocidade ⚡</h3><p>${pingSpeed}s</p></div>
            <div class="box uptime-box"><h3>Tempo Online ⏰</h3><p>${uptime}</p></div>
          </div>
        </div>
      </body>
    </html>
  `;

  const css = `
    body { margin: 0; padding: 0; font-family: 'Poppins', sans-serif; background: #ffe6f0; }
    .banner { width: 1200px; height: 500px; background: url('${backgroundImage}') center/cover no-repeat; display: flex; align-items: center; justify-content: space-between; position: relative; overflow: hidden; }
    .character-container { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1; }
    .character { width: 320px; height: 320px; object-fit: contain; border-radius: 50%; border: 6px solid #fff; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); }
    .info-boxes { display: flex; flex-direction: column; gap: 20px; z-index: 2; }
    .left-boxes { margin-left: 30px; }
    .right-boxes { margin-right: 30px; }
    .box { background: rgba(255, 255, 255, 0.9); padding: 25px; border-radius: 20px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15); text-align: center; width: 220px; backdrop-filter: blur(6px); }
    .groups-box, .users-box { background: rgba(255, 182, 193, 0.85); }
    .groups-box h3, .users-box h3 { font-size: 18px; color: #ff4d6d; margin: 0 0 8px; }
    .groups-box p, .users-box p { font-size: 20px; color: #333; font-weight: 600; margin: 0; }
    .speed-box, .uptime-box { background: rgba(255, 182, 193, 0.85); width: 250px; padding: 30px; }
    .speed-box h3, .uptime-box h3 { font-size: 20px; color: #ff4d6d; margin: 0 0 10px; }
    .speed-box p, .uptime-box p { font-size: 24px; color: #333; font-weight: 600; margin: 0; }
  `;

  const payload = { html, css, viewport_width: '1200', viewport_height: '500', google_fonts: 'Poppins', device_scale: '2' };

  try {
    const { data } = await axios.post(API_URL, payload, { responseType: "arraybuffer"});
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const Play = async (thumbnailImage, songName, artistName, duration) => {
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="thumbnail-container">
            <img class="thumbnail" src="${thumbnailImage}" />
          </div>
          <div class="music-panel">
            <div class="now-playing"><h2>🎶 Agora Tocando 🎶</h2></div>
            <div class="info-box song-box"><h3>Música 🎵</h3><p>${songName}</p></div>
            <div class="info-box artist-box"><h3>Artista 🎤</h3><p>${artistName}</p></div>
            <div class="info-box duration-box"><h3>Duração ⏳</h3><p>${duration}</p><div class="progress-bar"></div></div>
          </div>
        </div>
      </body>
    </html>
  `;

  const css = `
    body { margin: 0; padding: 0; font-family: 'Poppins', sans-serif; background: #e6e0fa; }
    .banner { width: 1200px; height: 500px; background: linear-gradient(135deg, #a29bfe, #74b9ff); display: flex; align-items: center; justify-content: flex-end; position: relative; overflow: hidden; }
    .thumbnail-container { position: absolute; top: 50%; left: 30px; transform: translateY(-50%); z-index: 1; }
    .thumbnail { width: 600px; height: 400px; object-fit: cover; border-radius: 20px; border: 5px solid #fff; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3); }
    .music-panel { background: rgba(255, 255, 255, 0.9); padding: 30px; border-radius: 20px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2); width: 400px; margin-right: 50px; backdrop-filter: blur(8px); z-index: 2; }
    .now-playing h2 { font-size: 28px; color: #6c5ce7; text-align: center; margin: 0 0 20px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); }
    .info-box { margin-bottom: 20px; text-align: left; }
    .info-box h3 { font-size: 20px; color: #0984e3; margin: 0 0 8px; display: flex; align-items: center; gap: 8px; }
    .info-box p { font-size: 24px; color: #2d3436; font-weight: 600; margin: 0; line-height: 1.3; }
    .duration-box { margin-bottom: 0; }
    .progress-bar { width: 100%; height: 8px; background: #dfe6e9; border-radius: 10px; margin-top: 10px; overflow: hidden; }
    .progress-bar::before { content: ''; display: block; width: 50%; height: 100%; background: linear-gradient(90deg, #74b9ff, #a29bfe); border-radius: 10px; }
  `;

  const payload = { html, css, viewport_width: '1200', viewport_height: '500', google_fonts: 'Poppins', device_scale: '2' };

  try {
    const { data } = await axios.post(API_URL, payload, { responseType: "arraybuffer"});
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const Chaveamento = async (
  thumbnailImage,
  leftRoundOf16 = ['Time 1', 'Time 2', 'Time 3', 'Time 4', 'Time 5', 'Time 6', 'Time 7', 'Time 8'],
  rightRoundOf16 = ['Time 9', 'Time 10', 'Time 11', 'Time 12', 'Time 13', 'Time 14', 'Time 15', 'Time 16']
) => {
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="overlay"></div>
          <div class="bracket-container">
            <div class="round round-of-16 left">
              ${leftRoundOf16.map(team => `<div class="match"><div class="team-slot">${team.replace(/"/g, '&quot;')}</div></div>`).join('')}
            </div>
            <div class="round quarterfinals left">${Array(4).fill().map(() => `<div class="match"><div class="team-slot"></div></div>`).join('')}</div>
            <div class="round semifinals left">${Array(2).fill().map(() => `<div class="match"><div class="team-slot"></div></div>`).join('')}</div>
            <div class="round final"><div class="match"><div class="team-slot champion"></div></div></div>
            <div class="round semifinals right">${Array(2).fill().map(() => `<div class="match"><div class="team-slot"></div></div>`).join('')}</div>
            <div class="round quarterfinals right">${Array(4).fill().map(() => `<div class="match"><div class="team-slot"></div></div>`).join('')}</div>
            <div class="round round-of-16 right">${rightRoundOf16.map(team => `<div class="match"><div class="team-slot">${team.replace(/"/g, '&quot;')}</div></div>`).join('')}</div>
          </div>
        </div>
      </body>
    </html>
  `;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; }
    .banner { position: relative; width: 1600px; height: 900px; background: url('${thumbnailImage}') center/cover no-repeat; display: flex; justify-content: center; align-items: center; overflow: hidden; }
    .overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 0; }
    .bracket-container { position: relative; z-index: 1; width: 1500px; height: 800px; display: flex; justify-content: space-between; align-items: center; }
    .round { display: flex; flex-direction: column; justify-content: space-around; height: 100%; }
    .round-of-16 { width: 200px; }
    .quarterfinals { width: 160px; }
    .semifinals { width: 140px; }
    .final { width: 200px; display: flex; justify-content: center; align-items: center; }
    .left { align-items: flex-end; }
    .right { align-items: flex-start; }
    .match { margin: 16px 0; height: 60px; display: flex; align-items: center; }
    .round-of-16 .team-slot { width: 180px; height: 50px; background: rgba(255, 255, 255, 0.1); border: 1px solid #ff4d4d; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; padding: 0 10px; }
    .quarterfinals .team-slot, .semifinals .team-slot, .final .team-slot { width: 150px; height: 50px; background: rgba(255, 255, 255, 0.05); border: 1px dashed rgba(255, 77, 77, 0.5); border-radius: 6px; }
    .final .team-slot { width: 180px; height: 60px; background: rgba(255, 77, 77, 0.1); border: 2px solid #ff4d4d; }
  `;

  const payload = { html, css, viewport_width: '1600', viewport_height: '900', google_fonts: 'Poppins', device_scale: '2' };

  try {
    const { data } = await axios.post(API_URL, payload, { responseType: "arraybuffer"});
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const Filme = async (posterImage, title, watchUrl) => {
  const safeTitle = (title || 'Filme/ Série').toString().slice(0, 80);
  const displayUrl = (watchUrl || '').toString().slice(0, 70);
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="poster-wrap">
            <img class="poster" src="${posterImage}" />
          </div>
          <div class="info">
            <div class="badge">🎬 Assistir Online</div>
            <h1 class="title">${safeTitle.replace(/</g, '&lt;')}</h1>
            <div class="meta">
              <span>Qualidade HD</span>
              <span>Player Rápido</span>
              <span>Sem anúncios</span>
            </div>
            <div class="cta">
              <div class="btn">▶ Assista Agora</div>
              <div class="url">${displayUrl.replace(/</g, '&lt;')}</div>
            </div>
          </div>
          <div class="shine"></div>
        </div>
      </body>
    </html>
  `;

  const css = `
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: 'Poppins', sans-serif; background: #0f0c29; }
    .banner { width: 1200px; height: 500px; background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%); color: #fff; display: flex; align-items: center; gap: 32px; padding: 28px 36px; position: relative; overflow: hidden; border-radius: 18px; }
    .shine { position: absolute; top: -20%; left: -10%; width: 60%; height: 160%; background: radial-gradient(ellipse at center, rgba(255,255,255,0.08), rgba(255,255,255,0)); transform: rotate(20deg); pointer-events: none; }
    .poster-wrap { width: 520px; height: 100%; display: flex; align-items: center; justify-content: center; }
    .poster { width: 520px; height: 440px; object-fit: cover; border-radius: 16px; box-shadow: 0 16px 36px rgba(0,0,0,0.45); border: 4px solid rgba(255,255,255,0.08); }
    .info { flex: 1; display: flex; flex-direction: column; gap: 16px; }
    .badge { display: inline-block; background: linear-gradient(45deg, #ff4d6d, #feca57); padding: 8px 14px; border-radius: 999px; font-weight: 600; font-size: 14px; color: #1d1b31; width: fit-content; box-shadow: 0 6px 16px rgba(0,0,0,0.25); }
    .title { font-size: 34px; line-height: 1.15; margin: 0; letter-spacing: 0.3px; text-shadow: 0 3px 10px rgba(0,0,0,0.35); }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; opacity: 0.9; }
    .meta span { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); padding: 6px 10px; border-radius: 8px; font-size: 13px; }
    .cta { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
    .btn { display: inline-block; background: linear-gradient(45deg, #00d2ff, #3a7bd5); color: #08132b; font-weight: 700; padding: 12px 18px; border-radius: 12px; width: fit-content; box-shadow: 0 10px 20px rgba(0, 210, 255, 0.25); letter-spacing: 0.2px; }
    .url { font-size: 14px; color: #d1d5db; opacity: 0.95; word-break: break-all; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09); padding: 10px 12px; border-radius: 10px; }
  `;

  const payload = { html, css, viewport_width: '1200', viewport_height: '500', google_fonts: 'Poppins', device_scale: '2' };
  try {
    const { data } = await axios.post(API_URL, payload, { responseType: 'arraybuffer' });
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const Perfil = async (
  avatarUrl,
  displayName = 'Usuário',
  number = '-',
  bio = 'Sem bio disponível',
  humor = '😎 Tranquilão',
  pacote = 'R$ 0,00',
  levels = { puta:0, gado:0, corno:0, sortudo:0, carisma:0, rico:0, gostosa:0, feio:0 },
  role = 'Membro'
) => {
  const safe = (s) => (s || '').toString().replace(/</g, '&lt;');
  const keys = ['puta','gado','corno','sortudo','carisma','rico','gostosa','feio'];
  const levelItems = keys.map(k => ({ key: k, val: Math.max(0, Math.min(100, parseInt(levels[k]||0))) }));
  const titleCase = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="left">
            <img class="avatar" src="${avatarUrl}" />
          </div>
          <div class="right">
            <div class="top">
              <h1 class="name">${safe(displayName)}</h1>
              <div class="chips">
                <span class="chip">${safe(role)}</span>
                <span class="chip">${safe(humor)}</span>
              </div>
              <div class="meta">📱 ${safe(number)} • 💰 ${safe(pacote)}</div>
              <div class="bio">${safe(bio).slice(0, 150)}</div>
            </div>
            <div class="levels">
              ${levelItems.map(it => `
                <div class="level">
                  <div class="label">${titleCase(it.key)}</div>
                  <div class="bar"><div class="fill" style="width:${it.val}%"></div></div>
                  <div class="percent">${it.val}%</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="glow"></div>
        </div>
      </body>
    </html>
  `;

  const css = `
    *{box-sizing:border-box}
    body{margin:0;padding:0;background:#0b1220;font-family:'Poppins',sans-serif}
    .banner{width:1200px;height:500px;background:linear-gradient(135deg,#141a31,#0b1220 55%,#0e1830);color:#fff;display:flex;gap:24px;padding:26px 30px;border-radius:18px;position:relative;overflow:hidden}
    .glow{position:absolute;inset:-20%;background:radial-gradient(600px 300px at 15% 20%,rgba(58,123,213,.25),transparent 60%),radial-gradient(600px 300px at 85% 80%,rgba(0,210,255,.2),transparent 60%);pointer-events:none}
    .left{display:flex;align-items:center;justify-content:center}
    .avatar{width:260px;height:260px;border-radius:50%;object-fit:cover;border:6px solid rgba(255,255,255,.1);box-shadow:0 15px 40px rgba(0,0,0,.45)}
    .right{display:flex;flex-direction:column;flex:1}
    .top{margin-bottom:8px}
    .name{margin:0 0 6px;font-size:34px;line-height:1.15;letter-spacing:.3px}
    .chips{display:flex;gap:10px;margin-bottom:6px}
    .chip{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);padding:6px 10px;border-radius:999px;font-size:12px}
    .meta{opacity:.9;margin-bottom:8px;font-size:14px}
    .bio{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:10px 12px;border-radius:10px;font-size:14px;max-width:750px}
    .levels{margin-top:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px}
    .level{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px}
    .label{font-size:14px;opacity:.95}
    .bar{height:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:999px;overflow:hidden}
    .fill{height:100%;background:linear-gradient(90deg,#00d2ff,#3a7bd5)}
    .percent{font-weight:700;font-size:13px}
  `;

  const payload = { html, css, viewport_width:'1200', viewport_height:'500', google_fonts:'Poppins', device_scale:'2' };
  try{
    const { data } = await axios.post(API_URL, payload, { responseType:'arraybuffer' });
    return data;
  }catch(err){
    console.error(err);
    return null;
  }
};

export const StatusGrupo = async (
  backgroundImage,
  groupProfilePic,
  {
    subject = '—',
    groupId = '-',
    ownerTag = '@dono',
    createdAt = '—',
    desc = 'Sem descrição',
    totalMembers = 0,
    totalAdmins = 0,
    isPremium = false,
    rentStatus = '❌ Desativado',
    totalMsgs = 0,
    totalCmds = 0,
    totalFigs = 0
  } = {}
)=>{
  const safe = (s='') => s.toString().replace(/</g,'&lt;');
  const html = `
    <html>
      <body>
        <div class="banner">
          <div class="overlay"></div>
          <div class="left">
            <img class="gp-pic" src="${groupProfilePic}" />
            <div class="title-block">
              <h1 class="gname">${safe(subject)}</h1>
              <div class="meta">🆔 ${safe(groupId)} • 👑 ${safe(ownerTag)}</div>
              <div class="meta">📅 ${safe(createdAt)}</div>
              <div class="desc">${safe(desc).slice(0, 140)}</div>
            </div>
          </div>
          <div class="right">
            <div class="cards">
              <div class="card">
                <div class="label">👥 Membros</div>
                <div class="val">${totalMembers}</div>
              </div>
              <div class="card">
                <div class="label">👮 Admins</div>
                <div class="val">${totalAdmins}</div>
              </div>
              <div class="card">
                <div class="label">💎 Premium</div>
                <div class="val">${isPremium ? '✅' : '❌'}</div>
              </div>
              <div class="card">
                <div class="label">🏠 Aluguel</div>
                <div class="val">${safe(rentStatus)}</div>
              </div>
            </div>
            <div class="stats">
              <div class="stat"><span>💬 Mensagens</span><b>${totalMsgs}</b></div>
              <div class="stat"><span>⚒️ Comandos</span><b>${totalCmds}</b></div>
              <div class="stat"><span>🎨 Figurinhas</span><b>${totalFigs}</b></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const bg = backgroundImage ? `url('${backgroundImage}') center/cover no-repeat` : `linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)`;
  const css = `
    *{box-sizing:border-box}
    body{margin:0;padding:0;background:#0b1220;font-family:'Poppins',sans-serif}
    .banner{position:relative;width:1200px;height:500px;background:${bg};color:#fff;display:flex;gap:20px;padding:26px 30px;border-radius:18px;overflow:hidden}
    .overlay{position:absolute;inset:0;background:rgba(0,0,0,.25)}
    .left{position:relative;display:flex;gap:18px;z-index:1;flex:1}
    .gp-pic{width:180px;height:180px;border-radius:20px;object-fit:cover;border:5px solid rgba(255,255,255,.12);box-shadow:0 12px 28px rgba(0,0,0,.45);align-self:flex-start}
    .title-block{display:flex;flex-direction:column;gap:8px;max-width:520px}
    .gname{margin:0;font-size:30px;line-height:1.15}
    .meta{opacity:.95;font-size:14px}
    .desc{margin-top:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:10px 12px;border-radius:10px;font-size:13px}
    .right{position:relative;z-index:1;width:420px;display:flex;flex-direction:column;gap:16px}
    .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 14px}
    .label{font-size:12px;opacity:.95;margin-bottom:4px}
    .val{font-weight:700;font-size:20px}
    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .stat{background:rgba(0,210,255,.12);border:1px solid rgba(0,210,255,.2);border-radius:14px;padding:12px;text-align:center}
    .stat span{display:block;font-size:12px;margin-bottom:6px;opacity:.95}
    .stat b{font-size:18px}
  `;

  const payload = { html, css, viewport_width:'1200', viewport_height:'500', google_fonts:'Poppins', device_scale:'2' };
  try{
    const { data } = await axios.post(API_URL, payload, { responseType:'arraybuffer' });
    return data;
  }catch(err){
    console.error(err);
    return null;
  }
};