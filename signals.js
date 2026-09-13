// ===== SIGNALS MODULE =====
window.signalsLoaded = true;
let signals = [];

function renderSignals() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-bell"></i> Signals</h3>
      <p class="subtitle">Live signals generated from the Analysis Tool. <span class="badge orange">Locked until analysis runs</span></p>
      <div id="signalsContainer">
        ${signals.length ? signals.map(s => signalHTML(s)).join('') :
          `<div class="text-muted" style="padding:20px 0;text-align:center;">
            <i class="fas fa-hourglass-half" style="font-size:24px;display:block;margin-bottom:8px;color:var(--text-secondary);"></i>
            No signals yet. Run analysis from the Analysis Tool.
          </div>`}
      </div>
      <div class="btn-group">
        <button class="btn-secondary" onclick="resetSignals()"><i class="fas fa-undo"></i> Reset Signals</button>
      </div>
    </div>
  `;
}

function signalHTML(s) {
  return `
    <div class="signal-item">
      <div class="signal-field"><span class="label">Asset</span><span class="value">${s.volatility}</span></div>
      <div class="signal-field"><span class="label">Trade Type</span><span class="value">${s.tradeType}</span></div>
      <div class="signal-field"><span class="label">Sub Type</span><span class="value">${s.subType}</span></div>
      <div class="signal-field"><span class="label">Option</span><span class="value">${s.option}</span></div>
      <div class="signal-field"><span class="label">Entry</span><span class="value highlight">${s.entry}</span></div>
      <div class="signal-field"><span class="label">Accuracy</span><span class="value" style="color:var(--accent-green);">${s.accuracy}</span></div>
      <div class="signal-field"><span class="label">Market Condition</span><span class="value" style="color:var(--accent-green);">Good</span></div>
    </div>
  `;
}

window.addSignal = function(result) {
  if (!result) return;
  signals.push(result);
  if (state.currentPage === 'signals') {
    const container = document.getElementById('signalsContainer');
    if (container) {
      const empty = container.querySelector('.text-muted');
      if (empty) empty.remove();
      container.prepend(createSignalElement(result));
    }
  }
};

function createSignalElement(s) {
  const div = document.createElement('div');
  div.className = 'signal-item';
  div.innerHTML = signalHTML(s);
  return div;
}

function resetSignals() {
  if (!signals.length) return;
  if (confirm('Reset all signals?')) {
    signals = [];
    const container = document.getElementById('signalsContainer');
    if (container) {
      container.innerHTML = `
        <div class="text-muted" style="padding:20px 0;text-align:center;">
          <i class="fas fa-hourglass-half" style="font-size:24px;display:block;margin-bottom:8px;color:var(--text-secondary);"></i>
          No signals yet. Run analysis from the Analysis Tool.
        </div>
      `;
    }
  }
}

const origRenderSig = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'signals') {
    container.innerHTML = renderSignals();
    return;
  }
  if (origRenderSig) origRenderSig(page, container);
};
