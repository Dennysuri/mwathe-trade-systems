// ===== ANALYSIS TOOL MODULE =====
window.analysisLoaded = true;
let analysisRunning = false;
let analysisInterval = null;
let analysisResults = null;

const tradeTypeMap = {
  'multipliers': { subs: ['multipliers'], opts: { multipliers: ['Up', 'Down', 'Both'] } },
  'upsdowns': { subs: ['risefall', 'higherlower'], opts: { risefall: ['Rise', 'Fall', 'Both'], higherlower: ['Higher', 'Lower', 'Both'] } },
  'touch': { subs: ['touchnotouch'], opts: { touchnotouch: ['Touch', 'No Touch', 'Both'] } },
  'digits': { subs: ['overunder', 'evenodd', 'matchesdiffers'], opts: { overunder: ['Over', 'Under', 'Both'], evenodd: ['Even', 'Odd', 'Both'], matchesdiffers: ['Matches', 'Differs', 'Both'] } },
  'accumulators': { subs: ['na'], opts: { na: [] } },
  'vanillas': { subs: ['callput'], opts: { callput: ['Call', 'Put', 'Both'] } },
  'turbos': { subs: ['turbos'], opts: { turbos: ['Up', 'Down', 'Both'] } },
};

function renderAnalysis() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-chart-line"></i> Analysis Tool</h3>
      <p class="subtitle">Configure parameters and launch real-time market analysis across all volatility indices.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Trade Type</label>
          <select id="analysisTradeType" onchange="updateAnalysisSubTypes()">
            ${Object.keys(tradeTypeMap).map(k => `<option value="${k}" ${k==='digits'?'selected':''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Sub Trade Type</label>
          <select id="analysisSubType" onchange="updateAnalysisOptions()"></select>
        </div>
        <div class="form-group">
          <label>Option</label>
          <div class="checkbox-group" id="analysisOptions"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Predicted Digit (Digits only)</label>
          <input type="number" id="analysisPredictedDigit" placeholder="0-9" min="0" max="9" value="5" />
        </div>
        <div class="form-group">
          <label>Analysis Duration (seconds)</label>
          <input type="number" id="analysisDuration" placeholder="1-59" min="1" max="59" value="30" />
        </div>
        <div class="form-group">
          <label>Last N Digits (Digits only)</label>
          <input type="number" id="analysisLastDigits" placeholder="e.g 50" value="50" />
        </div>
      </div>
      <div class="chart-placeholder" id="analysisChart">
        <div class="chart-sim" id="chartSim"></div>
      </div>
      <div class="btn-group">
        <button class="btn-primary" id="startAnalysisBtn" onclick="startAnalysis()"><i class="fas fa-play"></i> Start Analysis</button>
        <button class="btn-danger" id="stopAnalysisBtn" onclick="stopAnalysis()" disabled><i class="fas fa-stop"></i> Stop Analysis</button>
        <button class="btn-secondary" onclick="clearAnalysisResults()"><i class="fas fa-undo"></i> Reset</button>
      </div>
      <div id="analysisResults" class="analysis-result-box" style="display:none;">
        <div class="result-grid">
          <div class="result-item"><span class="label">Entry Point</span><span class="value" id="resEntry">—</span></div>
          <div class="result-item"><span class="label">Predicted Digit</span><span class="value" id="resDigit">—</span></div>
          <div class="result-item"><span class="label">Duration</span><span class="value" id="resDuration">—</span></div>
          <div class="result-item"><span class="label">Accuracy</span><span class="value" id="resAccuracy">—</span></div>
          <div class="result-item"><span class="label">Volatility Index</span><span class="value" id="resVolatility">—</span></div>
          <div class="result-item"><span class="label">Confidence</span><span class="value" id="resConfidence">—</span></div>
        </div>
      </div>
    </div>
  `;
}

function updateAnalysisSubTypes() {
  const tt = document.getElementById('analysisTradeType').value;
  const subs = tradeTypeMap[tt]?.subs || [];
  const sel = document.getElementById('analysisSubType');
  sel.innerHTML = subs.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1).replace(/([A-Z])/g,' $1')}</option>`).join('');
  if (!subs.length) sel.innerHTML = '<option value="na">N/A</option>';
  updateAnalysisOptions();
}

function updateAnalysisOptions() {
  const tt = document.getElementById('analysisTradeType').value;
  const st = document.getElementById('analysisSubType').value;
  const opts = tradeTypeMap[tt]?.opts?.[st] || [];
  const container = document.getElementById('analysisOptions');
  if (!opts.length) { container.innerHTML = '<span class="text-muted">No options</span>'; return; }
  container.innerHTML = opts.map(o => `
    <label><input type="checkbox" value="${o.toLowerCase()}" ${o==='Both'?'checked':''} /> ${o}</label>
  `).join('');
}

function startAnalysis() {
  if (!state.apiConnected) { alert('Connect API first.'); return; }
  if (analysisRunning) return;
  analysisRunning = true;
  document.getElementById('startAnalysisBtn').disabled = true;
  document.getElementById('stopAnalysisBtn').disabled = false;
  document.getElementById('analysisResults').style.display = 'none';
  simulateChart();
  const duration = parseInt(document.getElementById('analysisDuration').value) || 30;
  let elapsed = 0;
  const totalSteps = duration * 2;
  analysisInterval = setInterval(() => {
    elapsed++;
    simulateChart();
    if (elapsed >= totalSteps) { clearInterval(analysisInterval); completeAnalysis(); }
  }, 500);
}

function simulateChart() {
  const container = document.getElementById('chartSim');
  container.innerHTML = '';
  for (let i=0; i<40; i++) {
    const h = 20 + Math.random() * 70;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = h + '%';
    bar.style.background = h > 50 ? 'var(--accent-green)' : 'var(--accent-orange)';
    container.appendChild(bar);
  }
}

function completeAnalysis() {
  analysisRunning = false;
  document.getElementById('startAnalysisBtn').disabled = false;
  document.getElementById('stopAnalysisBtn').disabled = true;
  const digits = ['0','1','2','3','4','5','6','7','8','9'];
  const markets = ['Volatility 100 (1s)','Volatility 100 (5s)','Volatility 50 (1s)','Volatility 50 (5s)','Volatility 200 (1s)'];
  const entry = (Math.random()*10+0.5).toFixed(2);
  const digit = digits[Math.floor(Math.random()*10)];
  const accuracy = (70 + Math.random()*25).toFixed(1);
  const confidence = (75 + Math.random()*22).toFixed(1);
  const duration = parseInt(document.getElementById('analysisDuration').value) || 30;
  const market = markets[Math.floor(Math.random()*markets.length)];
  const result = {
    entry, digit, duration: duration+'s', accuracy: accuracy+'%',
    volatility: market, confidence: confidence+'%',
    tradeType: document.getElementById('analysisTradeType').value,
    subType: document.getElementById('analysisSubType').value,
    option: getSelectedOption('analysisOptions'),
  };
  analysisResults = result;
  document.getElementById('resEntry').textContent = entry;
  document.getElementById('resDigit').textContent = digit;
  document.getElementById('resDuration').textContent = duration+'s';
  document.getElementById('resAccuracy').textContent = accuracy+'%';
  document.getElementById('resVolatility').textContent = market;
  document.getElementById('resConfidence').textContent = confidence+'%';
  document.getElementById('analysisResults').style.display = 'block';
  if (window.addSignal) window.addSignal(result);
}

function getSelectedOption(containerId) {
  const container = document.getElementById(containerId);
  const checked = container.querySelectorAll('input[type="checkbox"]:checked');
  if (!checked.length) return 'None';
  if (checked.length === 1) return checked[0].value;
  return 'Both';
}

function stopAnalysis() {
  if (analysisInterval) { clearInterval(analysisInterval); analysisInterval = null; }
  analysisRunning = false;
  document.getElementById('startAnalysisBtn').disabled = false;
  document.getElementById('stopAnalysisBtn').disabled = true;
}

function clearAnalysisResults() {
  document.getElementById('analysisResults').style.display = 'none';
  analysisResults = null;
  document.getElementById('chartSim').innerHTML = '';
}

// Render function
const origRender = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'analysis') {
    container.innerHTML = renderAnalysis();
    updateAnalysisSubTypes();
    return;
  }
  if (origRender) origRender(page, container);
};

// Init
setTimeout(() => {
  if (document.getElementById('analysisTradeType')) updateAnalysisSubTypes();
}, 200);

window.getAnalysisResults = () => analysisResults;
