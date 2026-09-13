// ===== ADMIN PANEL MODULE =====
window.adminLoaded = true;
let adminAuthed = false;

function renderAdmin() {
  return `
    <div class="subpage-card">
      <h3><i class="fas fa-user-shield"></i> Admin Panel</h3>
      <p class="subtitle">Developer-only access. Monitor connected accounts and app performance.</p>
      <div class="admin-auth" id="adminAuth">
        <div class="admin-auth-form" id="adminAuthForm">
          <div class="form-row">
            <div class="form-group"><label>Email</label><input type="email" id="adminEmail" value="dennysuri858@gmail.com" /></div>
            <div class="form-group"><label>Password</label><input type="password" id="adminPassword" value="dennysuri12" /></div>
            <div class="form-group" style="flex:0 0 auto;"><label>&nbsp;</label><button class="btn-primary" onclick="adminLogin()" style="padding:8px 20px;font-size:13px;"><i class="fas fa-lock-open"></i> Unlock</button></div>
          </div>
          <div id="adminError" style="color:#ef4444;font-size:13px;display:none;">Invalid credentials.</div>
        </div>
        <div class="admin-authed-content ${adminAuthed?'show':''}" id="adminContent">
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
            <span class="badge green"><i class="fas fa-check-circle"></i> Authenticated</span>
            <button class="btn-secondary" style="padding:2px 14px;font-size:11px;" onclick="adminLogout()">Logout</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
            <div style="background:#0b0f19;padding:12px 16px;border-radius:8px;border:1px solid #1f2937;">
              <div style="font-size:11px;color:var(--text-secondary);">Connected Accounts</div>
              <div style="font-size:20px;font-weight:700;">3</div>
            </div>
            <div style="background:#0b0f19;padding:12px 16px;border-radius:8px;border:1px solid #1f2937;">
              <div style="font-size:11px;color:var(--text-secondary);">Trades Today</div>
              <div style="font-size:20px;font-weight:700;">47</div>
            </div>
            <div style="background:#0b0f19;padding:12px 16px;border-radius:8px;border:1px solid #1f2937;">
              <div style="font-size:11px;color:var(--text-secondary);">Uptime</div>
              <div style="font-size:20px;font-weight:700;">99.8%</div>
            </div>
            <div style="background:#0b0f19;padding:12px 16px;border-radius:8px;border:1px solid #1f2937;">
              <div style="font-size:11px;color:var(--text-secondary);">Response Time</div>
              <div style="font-size:20px;font-weight:700;">42ms</div>
            </div>
          </div>
          <div style="margin-top:12px;background:#0b0f19;padding:12px 16px;border-radius:8px;border:1px solid #1f2937;">
            <div style="font-weight:600;font-size:13px;">Recent Activity</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
              <div>• New trader connected: demo_1234 (2 min ago)</div>
              <div>• Bot executed 12 trades on V100 (5 min ago)</div>
              <div>• AI reached target profit of $20 (12 min ago)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pwd = document.getElementById('adminPassword').value.trim();
  if (email === 'dennysuri858@gmail.com' && pwd === 'dennysuri12') {
    adminAuthed = true;
    document.getElementById('adminError').style.display = 'none';
    document.getElementById('adminAuthForm').classList.add('hide');
    document.getElementById('adminContent').classList.add('show');
  } else {
    document.getElementById('adminError').style.display = 'block';
  }
}

function adminLogout() {
  adminAuthed = false;
  document.getElementById('adminAuthForm').classList.remove('hide');
  document.getElementById('adminContent').classList.remove('show');
  document.getElementById('adminError').style.display = 'none';
}

const origRenderAdmin = window.renderPage;
window.renderPage = function(page, container) {
  if (page === 'admin') {
    container.innerHTML = renderAdmin();
    return;
  }
  if (origRenderAdmin) origRenderAdmin(page, container);
};
