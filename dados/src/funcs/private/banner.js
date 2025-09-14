import axios from 'axios';

const API_URL = 'http://node6.ldc.srv.br:10020/api';

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
    const { data } = await axios.post(API_URL, payload);
    return data?.url || null;
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
    const { data } = await axios.post(API_URL, payload);
    return data?.url || null;
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
    const { data } = await axios.post(API_URL, payload);
    return data?.url || null;
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
    const { data } = await axios.post(API_URL, payload);
    return data?.url || null;
  } catch (err) {
    console.error(err);
    return null;
  }
};