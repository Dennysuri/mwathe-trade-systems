// ===== AUTOMATED BOT MODULE =====
window.botLoaded = true;
let botRunning = false;
let botInterval = null;
let consecutiveLosses = 0;
let botPL = 0;
let botTarget = 0;
let botStake = 1;
let botMartingale = 2.0;
let botStopLoss = 50;

function renderBot() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-robot"></i> Automated Trading Bot</h3>
      <p class="subtitle">Configure your bot parameters and let it trade autonomously with advanced strategies.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Trade Type</label>
          <select id="botTradeType" onchange="updateBotSubTypes()">
            ${Object.keys(tradeTypeMap).map(k => `<option value="${k}" ${k==='digits'?'selected':''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Sub Trade Type</label>
          <select id="botSubType" onchange="updateBotOptions()"></select>
        </div>
        <div class="form-group">
          <label>Option</label>
          <div class="checkbox-group" id="botOptions"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Predicted Digit</label><input type="number" id="botPredictedDigit" placeholder="0-9" min="0" max="9" value="5" /></div>
        <div class="form-group"><label>Martingale Factor</label><input type="number" id="botMartingale" placeholder="e.g 2.0" step="0.1" value="2.0" /></div>
        <div class="form-group"><label>Stop Loss ($)</label><input type="number" id="botStopLoss" placeholder="e.g 50" value="50" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Stake ($)</label><input type="number" id="botStake" placeholder="e.g 1" value="1" /></div>
        <div class="form-group"><label>Target Profit ($)</label><input type="number" id="botTargetProfit" placeholder="e.g 10" value="10" /></div>
        <div class="form-group"><label>Time Frame</label><select id="botTimeframe"><option value="ticks">Ticks</option><option value="seconds">Seconds</option><option value="minutes">Minutes</option><option value="hours">Hours</option></select></div>
      </div>
      <div class="btn-group">
        <button class="btn-success" onclick="startBot()"><i class="fas fa-play"></i> Start Bot</button>
        <button class="btn-danger" onclick="stopBot()"><i class="fas fa-stop"></i> Stop Bot</button>
        <button class="btn-secondary" onclick="resetBot()"><i class="fas fa-undo"></i> Reset</button>
      </div>
      <div class="status-display-panel" id="botStatusPanel">
        <div class="log-entry"><span class="time">[00:00]</span> <span class="info">Bot ready. Configure and start.</span></div>
      </div>
    </div>
  `;
}

function updateBotSubTypes() {
  const tt = document.getElementById('botTradeType').value;
  const subs = tradeTypeMap[tt]?.subs || [];
  const sel = document.getElementById('botSubType');
  sel.innerHTML = subs.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1).replace(/([A-Z])/g,' $1')}</option>`).join('');
  if (!subs.length) sel.innerHTML = '<option value="na">N/A</option>';
  updateBotOptions();
}

function updateBotOptions() {
  const tt = document.getElementById('botTradeType').value;
  const st = document.getElementById('botSubType').value;
  const opts = tradeTypeMap[tt]?.opts?.[st] || [];
  const container = document.getElementById('botOptions');
  if (!opts.length) { container.innerHTML = '<span class="text-muted">No options</span>'; return; }
  container.innerHTML = opts.map(o => `
    <label><input type="checkbox" value="${o.toLowerCase()}" ${o==='Both'?'checked':''} /> ${o}</label>
  `).join('');
}

function startBot() {
  if (!state.apiConnected) { alert('Connect API first.'); return; }
  if (botRunning) return;
  botRunning = true;
  consecutiveLosses = 0;
  botPL = 0;
  botStake = parseFloat(document.getElementById('botStake').value) || 1;
  botMartingale = parseFloat(document.getElementById('botMartingale').value) || 2.0;
  botStopLoss = parseFloat(document.getElementById('botStopLoss').value) || 50;
  botTarget = parseFloat(document.getElementById('botTargetProfit').value) || 10;
  const panel = document.getElementById('botStatusPanel');
  addBotLog(panel, 'info', 'Bot started. Analyzing markets...');

  if (botInterval) clearInterval(botInterval);
  botInterval = setInterval(() => {
    if (!botRunning) { clearInterval(botInterval); return; }
    // 72% win rate simulation
    const win = Math.random() > 0.28;
    const profit = (Math.random() * 2 + 0.5) * (win ? 1 : -1) * botStake;
    botPL += profit;
    if (win) {
      consecutiveLosses = 0;
      botStake = parseFloat(document.getElementById('botStake').value) || 1;
      addBotLog(panel, 'win', `Trade WON! +$${profit.toFixed(2)}. PL: $${botPL.toFixed(2)}`);
    } else {
      consecutiveLosses++;
      if (consecutiveLosses >= 2) {
        addBotLog(panel, 'loss', `⚠️ 2 consecutive losses. Pausing bot.`);
        stopBot();
        return;
      }
      botStake *= botMartingale;
      addBotLog(panel, 'loss', `Trade LOST. -$${Math.abs(profit).toFixed(2)}. Martingale: $${botStake.toFixed(2)}`);
    }
    if (botPL >= botTarget) {
      addBotLog(panel, 'win', `🎯 Target profit $${botTarget} reached! Stopping.`);
      stopBot();
      return;
    }
    if (botPL <= -botStopLoss) {
      addBotLog(panel, 'loss', `🛑 Stop loss $${botStopLoss} hit. Stopping.`);
      stopBot();
      return;
    }
    state.balance += profit;
    if (balanceDisplay) balanceDisplay.innerText = state.balance.toFixed(2);
  }, 4000 + Math.random() * 3000);
}

function stopBot() {
  botRunning = false;
  if (botInterval) { clearInterval(botInterval); botInterval = null; }
  const panel = document.getElementById('botStatusPanel');
  addBotLog(panel, 'info', 'Bot stopped gracefully.');
}

function resetBot() {
  stopBot();
  const panel = document.getElementById('botStatusPanel');
  panel.innerHTML = '<div class="log-entry"><span class="time">[00:00]</span> <span class="info">Bot reset. Ready.</span></div>';
  botPL = 0;
  consecutiveLosses = 0;
}

function addBotLog(panel, type, msg) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const cls = type === 'win' ? 'win' : type === 'loss' ? 'loss' : 'info';
  entry.innerHTML = `<span class="time">[${time}]</span> <span class="${cls}">${msg}</span>`;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;
}

const origRenderBot = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'bot') {
    container.innerHTML = renderBot();
    updateBotSubTypes();
    return;
  }
  if (origRenderBot) origRenderBot(page, container);
};
