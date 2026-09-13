// ===== SETTINGS MODULE =====
window.settingsLoaded = true;

function renderSettings() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-cog"></i> Settings</h3>
      <div class="settings-item">
        <div class="left"><span class="title">Dark Mode</span><span class="desc">Switch between light and dark themes</span></div>
        <div class="toggle-switch" onclick="toggleSwitch(this)"><div class="toggle-knob"></div></div>
      </div>
      <div class="settings-item">
        <div class="left"><span class="title">Notification Sounds</span><span class="desc">Play sounds on contract won/lost, target hit, stop-loss hit</span></div>
        <div class="toggle-switch on" onclick="toggleSwitch(this)"><div class="toggle-knob"></div></div>
      </div>
      <div class="settings-item">
        <div class="left"><span class="title">Chart Theme</span><span class="desc">Light / Dark / High Contrast for charts</span></div>
        <select style="padding:6px 12px;border-radius:6px;border:1px solid #374151;font-family:inherit;font-size:13px;background:#0b0f19;color:#fff;outline:none;">
          <option>Light</option><option selected>Dark</option><option>High Contrast</option>
        </select>
      </div>
      <div class="settings-item">
        <div class="left"><span class="title">Deriv Connection Status</span><span class="desc" id="settingsConnStatus"><span class="badge ${state.apiConnected?'green':'red'}">${state.apiConnected?'Connected':'Disconnected'}</span></span></div>
        <button class="btn-secondary" style="padding:4px 16px;font-size:12px;" onclick="reconnectDeriv()"><i class="fas fa-sync"></i> Reconnect</button>
      </div>
    </div>
  `;
}

function toggleSwitch(el) {
  el.classList.toggle('on');
}

function reconnectDeriv() {
  if (state.apiConnected) {
    alert('Already connected. Re-authorizing...');
    setTimeout(() => alert('Re-authorization successful.'), 800);
  } else {
    alert('Please connect via the Navigation page.');
  }
}

const origRenderSettings = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'settings') {
    container.innerHTML = renderSettings();
    return;
  }
  if (origRenderSettings) origRenderSettings(page, container);
};
