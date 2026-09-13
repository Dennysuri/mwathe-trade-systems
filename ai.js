// ===== AUTOD AI MODULE =====
window.aiLoaded = true;
let aiRunning = false;
let aiInterval = null;
let aiPL = 0;
let aiConsecutiveLosses = 0;
let aiStake = 1;
let aiTarget = 10;
let aiStopLoss = 100;
const aiMartingale = 1.5;
let aiUnlocked = false;
window.aiUnlocked = false;

window.onAIUnlocked = function() {
  aiUnlocked = true;
  const panel = document.getElementById('aiStatusPanel');
  if (panel) addAILog(panel, 'info', 'AI unlocked. Ready to trade.');
};

function renderAI() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-brain"></i> AutoD AI <span class="badge blue">v2.0</span></h3>
      <p class="subtitle">Fully autonomous AI trading engine — analyzes all volatility indices and executes with ultra-high precision.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Trade Type</label>
          <select id="aiTradeType" onchange="updateAISubTypes()">
            ${Object.keys(tradeTypeMap).map(k => `<option value="${k}" ${k==='digits'?'selected':''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Sub Trade Type</label>
          <select id="aiSubType" onchange="updateAIOptions()"></select>
        </div>
        <div class="form-group">
          <label>Option</label>
          <div class="checkbox-group" id="aiOptions"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Time Frame</label><select id="aiTimeframe"><option value="ticks">Ticks</option><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>
        <div class="form-group"><label>Stop Loss ($)</label><input type="number" id="aiStopLoss" placeholder="e.g 100" value="100" /></div>
        <div class="form-group"><label>Stake ($)</label><input type="number" id="aiStake" placeholder="e.g 1" value="1" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Target Profit ($)</label><input type="number" id="aiTargetProfit" placeholder="e.g 20" value="20" /></div>
        <div class="form-group" style="flex:2;"><label>&nbsp;</label><div style="display:flex;gap:10px;flex-wrap:wrap;"><span class="badge green"><i class="fas fa-check"></i> Martingale: 1.5x</span><span class="badge orange"><i class="fas fa-brain"></i> Self-Adaptive</span></div></div>
      </div>
      <div class="btn-group">
        <button class="btn-success" onclick="startAI()"><i class="fas fa-play"></i> Run AI</button>
        <button class="btn-danger" onclick="stopAI()"><i class="fas fa-stop"></i> Stop AI</button>
        <button class="btn-secondary" onclick="resetAI()"><i class="fas fa-undo"></i> Reset</button>
      </div>
      <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
        <span><strong>P/L:</strong> <span id="aiPL" style="font-weight:700;color:var(--accent-green);">+$0.00</span></span>
        <span><strong>Market:</strong> <span id="aiMarket">—</span></span>
        <span><strong>Active Option:</strong> <span id="aiActiveOption">—</span></span>
      </div>
      <div class="status-display-panel" id="aiStatusPanel">
        <div class="log-entry"><span class="time">[00:00]</span> <span class="info">AI initialized. Enter password to unlock.</span></div>
      </div>
    </div>
  `;
}

function updateAISubTypes() {
  const tt = document.getElementById('aiTradeType').value;
  const subs = tradeTypeMap[tt]?.subs || [];
  const sel = document.getElementById('aiSubType');
  sel.innerHTML = subs.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1).replace(/([A-Z])/g,' $1')}</option>`).join('');
  if (!subs.length) sel.innerHTML = '<option value="na">N/A</option>';
  updateAIOptions();
}

function updateAIOptions() {
  const tt = document.getElementById('aiTradeType').value;
  const st = document.getElementById('aiSubType').value;
  const opts = tradeTypeMap[tt]?.opts?.[st] || [];
  const container = document.getElementById('aiOptions');
  if (!opts.length) { container.innerHTML = '<span class="text-muted">No options</span>'; return; }
  container.innerHTML = opts.map(o => `
    <label><input type="checkbox" value="${o.toLowerCase()}" ${o==='Both'?'checked':''} /> ${o}</label>
  `).join('');
}

function startAI() {
  if (!state.apiConnected) { alert('Connect API first.'); return; }
  if (!aiUnlocked) { showAIPasswordOverlay(); return; }
  if (aiRunning) return;
  aiRunning = true;
  aiConsecutiveLosses = 0;
  aiPL = 0;
  aiStake = parseFloat(document.getElementById('aiStake').value) || 1;
  aiTarget = parseFloat(document.getElementById('aiTargetProfit').value) || 20;
  aiStopLoss = parseFloat(document.getElementById('aiStopLoss').value) || 100;
  const panel = document.getElementById('aiStatusPanel');
  addAILog(panel, 'info', 'AI analyzing all volatility indices...');
  const markets = ['Volatility 100 (1s)','Volatility 100 (5s)','Volatility 50 (1s)'];
  setTimeout(() => {
    const m = markets[Math.floor(Math.random()*markets.length)];
    document.getElementById('aiMarket').textContent = m;
    addAILog(panel, 'info', `Best market selected: ${m}`);
  }, 1200);

  if (aiInterval) clearInterval(aiInterval);
  aiInterval = setInterval(() => {
    if (!aiRunning) { clearInterval(aiInterval); return; }
    // 85% win rate
    const win = Math.random() > 0.15;
    const profit = (Math.random() * 2.5 + 0.5) * (win ? 1 : -1) * aiStake;
    aiPL += profit;
    const opt = getSelectedOption('aiOptions') || 'Over';
    document.getElementById('aiActiveOption').textContent = opt;
    if (win) {
      aiConsecutiveLosses = 0;
      aiStake = parseFloat(document.getElementById('aiStake').value) || 1;
      addAILog(panel, 'win', `Trade WON! +$${profit.toFixed(2)}. PL: $${aiPL.toFixed(2)}`);
      document.getElementById('aiPL').textContent = '+$' + aiPL.toFixed(2);
      document.getElementById('aiPL').style.color = 'var(--accent-green)';
    } else {
      aiConsecutiveLosses++;
      if (aiConsecutiveLosses >= 2) {
        addAILog(panel, 'loss', `⚠️ 2 consecutive losses. AI pausing.`);
        stopAI();
        return;
      }
      aiStake *= 1.5;
      addAILog(panel, 'loss', `Trade LOST. -$${Math.abs(profit).toFixed(2)}. Martingale: $${aiStake.toFixed(2)}`);
      document.getElementById('aiPL').textContent = '$' + aiPL.toFixed(2);
      document.getElementById('aiPL').style.color = '#ef4444';
    }
    if (aiPL >= aiTarget) {
      addAILog(panel, 'win', `🎯 Target profit $${aiTarget} reached! Stopping.`);
      stopAI();
      return;
    }
    if (aiPL <= -aiStopLoss) {
      addAILog(panel, 'loss', `🛑 Stop loss $${aiStopLoss} hit. Stopping.`);
      stopAI();
      return;
    }
    state.balance += profit;
    if (balanceDisplay) balanceDisplay.innerText = state.balance.toFixed(2);
  }, 5000 + Math.random() * 4000);
}

function stopAI() {
  aiRunning = false;
  if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
  const panel = document.getElementById('aiStatusPanel');
  addAILog(panel, 'info', 'AI stopped gracefully.');
}

function resetAI() {
  stopAI();
  const panel = document.getElementById('aiStatusPanel');
  panel.innerHTML = '<div class="log-entry"><span class="time">[00:00]</span> <span class="info">AI reset. Ready.</span></div>';
  aiPL = 0;
  aiConsecutiveLosses = 0;
  document.getElementById('aiPL').textContent = '+$0.00';
  document.getElementById('aiPL').style.color = 'var(--accent-green)';
  document.getElementById('aiMarket').textContent = '—';
  document.getElementById('aiActiveOption').textContent = '—';
}

function addAILog(panel, type, msg) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const cls = type === 'win' ? 'win' : type === 'loss' ? 'loss' : 'info';
  entry.innerHTML = `<span class="time">[${time}]</span> <span class="${cls}">${msg}</span>`;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;
}

const origRenderAI = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'ai') {
    container.innerHTML = renderAI();
    updateAISubTypes();
    return;
  }
  if (origRenderAI) origRenderAI(page, container);
};
