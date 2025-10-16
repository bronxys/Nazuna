// ====== Enhanced Gold System ======
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração de caminhos para o ambiente ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define ECONOMY_FILE path
const ECONOMY_FILE = path.join(__dirname, '..', '..', 'database', 'economy.json');

function loadEconomy() {
  try {
    // Read and parse JSON file directly
    const data = JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8'));
    // Validate data structure
    if (!data.users) data.users = {};
    if (!data.shop) data.shop = {};
    if (!data.jobCatalog) data.jobCatalog = {};
    if (!data.market) data.market = [];
    if (typeof data.marketCounter !== 'number') data.marketCounter = 1;
    if (!data.propertiesCatalog) data.propertiesCatalog = {};
    if (!data.materialsPrices) data.materialsPrices = { pedra: 2, ferro: 6, ouro: 12, diamante: 30 };
    if (!data.recipes) data.recipes = {};
    return data;
  } catch (e) {
    console.error('❌ Erro ao carregar economy.json:', e);
    return { users: {}, shop: {}, jobCatalog: {}, market: [], marketCounter: 1, propertiesCatalog: {}, materialsPrices: { pedra: 2, ferro: 6, ouro: 12, diamante: 30 }, recipes: {} };
  }
}

function saveEconomy(data, sender, me) {
  try {
    // Validate data before saving
    if (!data || typeof data !== 'object') {
      throw new Error('Dados inválidos para salvar');
    }
    
    // Ensure required fields exist
    data.users = data.users || {};
    data.users[sender] = me || {};
    data.shop = data.shop || {};
    data.jobCatalog = data.jobCatalog || {};
    data.market = data.market || [];
    data.marketCounter = data.marketCounter || 1;
    data.propertiesCatalog = data.propertiesCatalog || {};
    data.materialsPrices = data.materialsPrices || { pedra: 2, ferro: 6, ouro: 12, diamante: 30 };
    data.recipes = data.recipes || {};
    
    fs.writeFileSync(ECONOMY_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { 
    console.error('❌ Erro ao salvar economy.json:', e); 
    return false; 
  }
}

async function getEcoUser(econ, userId, config = null) {
  if (!econ || !econ.users) {
    econ.users = {};
  }
  
  // Import normalizeUserId if config is provided
  let normalizeUserId = null;
  if (config) {
    try {
      // Try to import normalizeUserId from index.js
      const indexModule = await import('./index.js');
      normalizeUserId = indexModule.normalizeUserId;
    } catch (e) {
      console.warn('Could not import normalizeUserId, using userId as-is:', e.message);
    }
  }
  
  // Normalize user ID if function is available
  const normalizedUserId = normalizeUserId ? normalizeUserId(userId, config) : userId;
  
  if (!normalizedUserId) {
    console.warn('Invalid user ID provided to getEcoUser:', userId);
    return null;
  }
  
  econ.users[normalizedUserId] = econ.users[normalizedUserId] || {
    wallet: 0,
    bank: 0,
    cooldowns: {},
    inventory: {},
    job: null,
    tools: {},
    materials: {},
    challenge: null,
    weeklyChallenge: null,
    monthlyChallenge: null,
    skills: {},
    properties: {},
    achievements: {},
    lastLogin: Date.now(),
    transactionHistory: []
  };
  
  const u = econ.users[normalizedUserId];
  u.cooldowns = u.cooldowns || {};
  u.inventory = u.inventory || {};
  u.materials = u.materials || {};
  u.tools = u.tools || {};
  u.skills = u.skills || {};
  u.properties = u.properties || {};
  u.achievements = u.achievements || {};
  u.transactionHistory = u.transactionHistory || [];
  
  return u;
}

function parseAmount(text, maxValue) {
  if (!text) return NaN;
  text = text.toLowerCase().trim();
  
  // Handle special cases
  if (['all','tudo','max'].includes(text)) {
    return maxValue;
  }
  
  // Handle percentage values
  if (text.endsWith('%')) {
    const percent = parseInt(text.slice(0, -1));
    if (!isNaN(percent) && percent > 0 && percent <= 100) {
      return Math.floor((percent / 100) * maxValue);
    }
  }
  
  // Handle regular numbers
  const num = parseInt(text);
  return isNaN(num) ? NaN : Math.min(num, maxValue);
}

function fmt(n) { 
  return new Intl.NumberFormat('pt-BR').format(Math.floor(n)); 
}

function timeLeft(targetMs) {
  const now = Date.now();
  if (now >= targetMs) return '0s';
  const diff = targetMs - now;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// Enhanced gold transaction with validation and logging
async function performGoldTransaction(econ, fromUserId, toUserId, amount, type = 'transfer', description = '') {
  if (!econ || !fromUserId || !toUserId || amount <= 0) {
    return { success: false, error: 'Parâmetros inválidos para transação' };
  }
  
  const fromUser = await getEcoUser(econ, fromUserId);
  const toUser = await getEcoUser(econ, toUserId);
  
  // Check if fromUser has enough balance
  if (fromUser.wallet < amount) {
    return { success: false, error: 'Saldo insuficiente' };
  }
  
  // Perform transaction
  fromUser.wallet -= amount;
  toUser.wallet += amount;
  
  // Log transaction
  const timestamp = Date.now();
  fromUser.transactionHistory.push({
    timestamp,
    type: type === 'transfer' ? 'sent' : type,
    amount: -amount,
    to: toUserId,
    description,
    balance: fromUser.wallet
  });
  
  toUser.transactionHistory.push({
    timestamp,
    type: type === 'transfer' ? 'received' : type,
    amount: amount,
    from: fromUserId,
    description,
    balance: toUser.wallet
  });
  
  // Keep only last 100 transactions
  if (fromUser.transactionHistory.length > 100) {
    fromUser.transactionHistory = fromUser.transactionHistory.slice(-100);
  }
  if (toUser.transactionHistory.length > 100) {
    toUser.transactionHistory = toUser.transactionHistory.slice(-100);
  }
  
  return { success: true };
}

// Validate and clean economy data
function validateAndCleanEconomyData(econ) {
  if (!econ || typeof econ !== 'object') {
    return { users: {}, shop: {}, jobCatalog: {}, market: [], marketCounter: 1, propertiesCatalog: {}, materialsPrices: { pedra: 2, ferro: 6, ouro: 12, diamante: 30 }, recipes: {} };
  }
  
  // Clean users data
  if (econ.users) {
    for (const userId in econ.users) {
      const user = econ.users[userId];
      
      // Ensure numeric values
      user.wallet = Math.max(0, Math.floor(Number(user.wallet) || 0));
      user.bank = Math.max(0, Math.floor(Number(user.bank) || 0));
      
      // Clean arrays
      if (Array.isArray(user.transactionHistory)) {
        user.transactionHistory = user.transactionHistory.filter(t => 
          t && typeof t === 'object' && !isNaN(Number(t.amount))
        );
      }
      
      // Clean objects
      user.inventory = cleanNumericObject(user.inventory);
      user.materials = cleanNumericObject(user.materials);
      user.tools = cleanObject(user.tools);
      user.skills = cleanObject(user.skills);
      user.properties = cleanObject(user.properties);
      user.achievements = cleanObject(user.achievements);
    }
  }
  
  // Clean market data
  if (Array.isArray(econ.market)) {
    econ.market = econ.market.filter(offer => 
      offer && typeof offer === 'object' && 
      !isNaN(Number(offer.id)) && !isNaN(Number(offer.price)) && 
      !isNaN(Number(offer.qty)) && offer.seller
    );
  }
  
  // Ensure marketCounter is valid
  econ.marketCounter = Math.max(1, Math.floor(Number(econ.marketCounter) || 1));
  
  return econ;
}

function cleanNumericObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = Number(obj[key]);
      if (!isNaN(value) && value >= 0) {
        result[key] = Math.floor(value);
      }
    }
  }
  return result;
}

function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== null && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// Check and update user achievements
function checkAndUpdateAchievements(user, econ) {
  if (!user || !user.achievements) return;
  
  const achievements = user.achievements;
  const totalWealth = (user.wallet || 0) + (user.bank || 0);
  
  // Wealth-based achievements
  if (totalWealth >= 1000 && !achievements.first_thousand) {
    achievements.first_thousand = true;
    user.wallet += 50; // Bonus
    return '🏆 Primeiros 1.000 gold acumulados! Bônus de 50 gold recebido!';
  }
  
  if (totalWealth >= 10000 && !achievements.ten_thousand) {
    achievements.ten_thousand = true;
    user.wallet += 500; // Bonus
    return '🌟 Primeiros 10.000 gold acumulados! Bônus de 500 gold recebido!';
  }
  
  if (totalWealth >= 100000 && !achievements.hundred_thousand) {
    achievements.hundred_thousand = true;
    user.wallet += 5000; // Bonus
    return '💎 Primeiros 100.000 gold acumulados! Bônus de 5.000 gold recebido!';
  }
  
  // Transaction-based achievements
  if (user.transactionHistory && user.transactionHistory.length >= 50 && !achievements.fifty_transactions) {
    achievements.fifty_transactions = true;
    user.wallet += 100;
    return '🔄 50 transações realizadas! Bônus de 100 gold recebido!';
  }
  
  return null;
}

// Enhanced gold display with formatting
function displayGoldInfo(user, econ) {
  const total = (user.wallet || 0) + (user.bank || 0);
  const bankCapacity = getBankCapacity(user, econ);
  
  let display = `💰 *Situ Financeira*\n\n`;
  display += `💼 Carteira: ${fmt(user.wallet || 0)}\n`;
  display += `🏦 Banco: ${fmt(user.bank || 0)} ${bankCapacity !== Infinity ? `/ ${fmt(bankCapacity)}` : ''}\n`;
  display += `💠 Total: ${fmt(total)}\n\n`;
  
  // Add job info
  if (user.job && econ.jobCatalog && econ.jobCatalog[user.job]) {
    display += `💼 Emprego: ${econ.jobCatalog[user.job].name}\n`;
  }
  
  // Add level info
  if (user.skills && Object.keys(user.skills).length > 0) {
    const highestSkill = Object.entries(user.skills).reduce((highest, [skill, data]) => {
      if (!highest || data.level > highest.level) {
        return { skill, level: data.level };
      }
      return highest;
    }, null);
    
    if (highestSkill) {
      display += `⭐ Nível mais alto: ${highestSkill.skill.charAt(0).toUpperCase() + highestSkill.skill.slice(1)} (Nível ${highestSkill.level})\n`;
    }
  }
  
  // Add achievements
  if (user.achievements && Object.keys(user.achievements).length > 0) {
    const achievementCount = Object.keys(user.achievements).filter(key => user.achievements[key]).length;
    display += `🏅 Conquistas: ${achievementCount}\n`;
  }
  
  return display;
}

// Get bank capacity with bonuses
function getBankCapacity(user, econ) {
  const baseCapacity = Infinity;
  const bonuses = applyShopBonuses(user, econ);
  return bonuses.bankCapacity;
}

// Apply shop bonuses (existing function with enhanced error handling)
function applyShopBonuses(user, econ) {
  try {
    const inv = user.inventory || {};
    const shop = econ.shop || {};
    let mineBonus = 0; let workBonus = 0; let bankCapacity = Infinity; let fishBonus = 0; let exploreBonus = 0; let huntBonus = 0; let forgeBonus = 0;
    
    Object.entries(inv).forEach(([key, qty]) => {
      if (!qty || !shop[key]) return;
      const eff = shop[key].effect || {};
      if (eff.mineBonus) mineBonus += eff.mineBonus * qty;
      if (eff.workBonus) workBonus += eff.workBonus * qty;
      if (eff.bankCapacity) {
        if (bankCapacity === Infinity) {
          bankCapacity = eff.bankCapacity * qty;
        } else {
          bankCapacity += eff.bankCapacity * qty;
        }
      }
      if (eff.fishBonus) fishBonus += eff.fishBonus * qty;
      if (eff.exploreBonus) exploreBonus += eff.exploreBonus * qty;
      if (eff.huntBonus) huntBonus += eff.huntBonus * qty;
      if (eff.forgeBonus) forgeBonus += eff.forgeBonus * qty;
    });
    
    return { mineBonus, workBonus, bankCapacity, fishBonus, exploreBonus, huntBonus, forgeBonus };
  } catch (e) {
    console.error('Error applying shop bonuses:', e);
    return { mineBonus: 0, workBonus: 0, bankCapacity: Infinity, fishBonus: 0, exploreBonus: 0, huntBonus: 0, forgeBonus: 0 };
  }
}

// Enhanced daily reward with streak tracking
function getDailyReward(user, econ) {
  const baseReward = 100;
  const streak = user.dailyStreak || 1;
  const maxStreak = 30;
  
  // Calculate bonus based on streak (max 5x)
  const streakBonus = Math.min(streak, maxStreak) / maxStreak;
  const reward = Math.floor(baseReward * (1 + streakBonus));
  
  // Update streak
  user.lastDaily = Date.now();
  user.dailyStreak = streak + 1;
  
  return {
    amount: reward,
    streak: streak,
    message: `🎁 Recompensa diária coletada: ${fmt(reward)}! (Seqüência: ${streak + 1})`
  };
}

// Enhanced leaderboard with pagination
function getTopUsers(econ, limit = 10, page = 1) {
  const offset = (page - 1) * limit;
  const users = Object.entries(econ.users || {})
    .map(([id, data]) => ({
      id,
      name: data.name || id,
      wallet: data.wallet || 0,
      bank: data.bank || 0,
      total: (data.wallet || 0) + (data.bank || 0),
      level: data.skills ? Math.max(...Object.values(data.skills).map(s => s.level || 1)) : 1
    }))
    .sort((a, b) => b.total - a.total)
    .slice(offset, offset + limit);
  
  return users;
}

// Export functions
export {
  loadEconomy,
  saveEconomy,
  getEcoUser,
  parseAmount,
  fmt,
  timeLeft,
  performGoldTransaction,
  validateAndCleanEconomyData,
  cleanNumericObject,
  cleanObject,
  checkAndUpdateAchievements,
  displayGoldInfo,
  getBankCapacity,
  applyShopBonuses,
  getDailyReward,
  getTopUsers
};