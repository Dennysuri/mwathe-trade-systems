// ===== COPY TRADING MODULE =====
window.copyLoaded = true;

const traders = [
  { name: 'AlphaWave', roi: '+42%', risk: 'Medium', winRate: '78%', trades: '2.4k', badge: 'green' },
  { name: 'QuantEdge', roi: '+31%', risk: 'Low', winRate: '84%', trades: '1.8k', badge: 'orange' },
  { name: 'VolatilityPro', roi: '+67%', risk: 'High', winRate: '71%', trades: '3.1k', badge: 'blue' },
];

function renderCopy() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-copy"></i> Copy Trading</h3>
      <p class="subtitle">Browse top traders and automatically replicate their trades in your account.</p>
      <h4 style="font-weight:600;font-size:14px;margin:10px 0 6px;color:var(--text-secondary);">Trader Directory</h4>
      <div id="traderList">
        ${traders.map(t => `
          <div class="trader-card">
            <div class="trader-info">
              <div class="name">${t.name} <span class="badge ${t.badge}">${t.roi}</span></div>
              <div class="details">
                <span><i class="fas fa-chart-pie"></i> Risk: ${t.risk}</span>
                <span><i class="fas fa-trophy"></i> Win Rate: ${t.winRate}</span>
                <span><i class="fas fa-clock"></i> ${t.trades} trades</span>
              </div>
            </div>
            <div class="trader-actions">
              <button class="btn-sm copy" onclick="toggleCopy(this)">Copy</button>
            </div>
          </div>
        `).join('')}
      </div>
      <h4 style="font-weight:600;font-size:14px;margin:16px 0 6px;color:var(--text-secondary);">Copy Settings</h4>
      <div class="form-row">
        <div class="form-group"><label>Amount per trade ($)</label><input type="number" value="10" /></div>
        <div class="form-group"><label>Risk level</label><select><option>Low</option><option selected>Medium</option><option>High</option></select></div>
        <div class="form-group"><label>Max trades to copy</label><input type="number" value="5" /></div>
      </div>
      <div class="btn-group">
        <button class="btn-success"><i class="fas fa-play"></i> Start Copy</button>
        <button class="btn-danger"><i class="fas fa-stop"></i> Stop Copy</button>
      </div>
    </div>
  `;
}

function toggleCopy(btn) {
  btn.classList.toggle('active');
  btn.textContent = btn.classList.contains('active') ? 'Copying' : 'Copy';
  btn.style.background = btn.classList.contains('active') ? '#dc2626' : '';
  btn.style.color = btn.classList.contains('active') ? '#fff' : '';
}

const origRenderCopy = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'copy') {
    container.innerHTML = renderCopy();
    return;
  }
  if (origRenderCopy) origRenderCopy(page, container);
};
