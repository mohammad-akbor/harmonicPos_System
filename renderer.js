const { ipcRenderer } = require('electron');
let DB = { users: [], staff: [], products: [], transactions: [], salaryHistory: [] };

// load DB from main
async function loadDB(){
  try {
    const db = await ipcRenderer.invoke('db-read');
    if (!db) {
      console.error('No data received from storage');
      return;
    }
    
    // Ensure all required arrays exist
    DB = {
      users: db.users || [],
      staff: db.staff || [],
      products: db.products || [],
      transactions: db.transactions || [],
      salaryHistory: db.salaryHistory || []
    };
    
    console.log('Data loaded successfully:', {
      users: DB.users.length,
      staff: DB.staff.length,
      products: DB.products.length,
      transactions: DB.transactions.length
    });
    
    renderAll();
  } catch (err) {
    console.error('Error loading data:', err);
    alert('Error loading data. Please refresh the page.');
  }
}

async function saveDB(){ 
  try {
    // Validate data before saving
    if (!Array.isArray(DB.staff)) DB.staff = [];
    if (!Array.isArray(DB.products)) DB.products = [];
    if (!Array.isArray(DB.transactions)) DB.transactions = [];
    if (!Array.isArray(DB.salaryHistory)) DB.salaryHistory = [];

    // Create a clean copy of the data for saving
    const dataToSave = {
      users: DB.users || [],
      staff: DB.staff.map(s => ({
        id: s.id,
        name: s.name,
        section: s.section,
        daily: Number(s.daily) || 0,
        monthly: Number(s.monthly) || 0,
        yearly: Number(s.yearly) || 0
      })),
      products: DB.products.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        stock: Number(p.stock) || 0
      })),
      transactions: DB.transactions || [],
      salaryHistory: DB.salaryHistory || []
    };

    const result = await ipcRenderer.invoke('db-write', dataToSave);
    
    if (!result.ok && result.error) {
      console.error('Error saving data:', result.error);
      alert('Error saving data: ' + result.error);
    } else {
      console.log('Data saved successfully');
    }
  } catch (err) {
    console.error('Error saving data:', err);
    alert('Error saving data. Please try again.');
  }
}

// ---------------- LOGIN ----------------
async function onLogin(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value.trim();
  const res = await ipcRenderer.invoke('login', { username: u, password: p });
  if(res.ok){
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await loadDB();
  } else {
    document.getElementById('loginMsg').innerText = 'Invalid credentials';
  }
}

// ---------------- USERS ----------------
function renderUsers(){
  const el = document.getElementById('usersTable');
  if(!DB.users || !DB.users.length){ el.innerHTML = '<small>No users</small>'; return; }
  el.innerHTML = '<table><thead><tr><th>User</th><th>Actions</th></tr></thead><tbody>' +
    DB.users.map(u => `<tr><td>${u.username}</td><td><button onclick="fillUser('${u.username}')">Edit</button></td></tr>`).join('') +
    '</tbody></table>';
}
function fillUser(username){
  const u = DB.users.find(x=>x.username===username);
  if(!u) return;
  document.getElementById('u_name').value = u.username;
  document.getElementById('u_pass').value = u.password;
}
function addOrUpdateUser(){
  const name = document.getElementById('u_name').value.trim();
  const pass = document.getElementById('u_pass').value.trim();
  if(!name||!pass) return alert('Enter user & pass');
  const ex = DB.users.find(x=>x.username===name);
  if(ex){ ex.password = pass; alert('User updated'); }
  else { DB.users.push({ username: name, password: pass }); alert('User added'); }
  saveDB(); renderUsers(); document.getElementById('u_name').value=''; document.getElementById('u_pass').value='';
}

// ---------------- STAFF CRUD ----------------
let editingStaff = null;
function clearStaffForm() {
  document.getElementById('s_name').value = '';
  // clear section checkboxes
  const secs = document.querySelectorAll('input[name="s_section"]'); if(secs) secs.forEach(c=>c.checked = false);
  const sp = document.getElementById('s_percent'); if(sp) sp.value = '';
  const phoneEl = document.getElementById('s_phone'); if(phoneEl) phoneEl.value = '';
  editingStaff = null;
  document.querySelector('button[onclick="onStaffAddOrUpdate()"]').textContent = 'Add Staff';
}

function clearProductForm() {
  document.getElementById('p_name').value = '';
  document.getElementById('p_price').value = '';
  document.getElementById('p_stock').value = '';
  editingProduct = null;
  document.querySelector('button[onclick="onProductAddOrUpdate()"]').textContent = 'Add Product';
}



const PRODUCT_STAFF_PERCENT = 5; // default 5% commission on product sales
const SERVICE_STAFF_PERCENT = 40; // 40% commission on service sales

function onStaffAddOrUpdate(){
  const rawName = document.getElementById('s_name').value.trim();
  const percent = parseFloat(document.getElementById('s_percent')?.value) || 0;
  // collect selected sections (allow multiple)
  const selected = Array.from(document.querySelectorAll('input[name="s_section"]:checked')).map(x=>x.value.toUpperCase());
  if(!rawName) return alert('Enter staff name');
  if(!selected || selected.length === 0) return alert('Select at least one section');
  // If editing, update single staff
  if(editingStaff){
    const s = DB.staff.find(x=>x.id===editingStaff);
    if(!s) return;
    s.name = rawName;
    s.section = selected; // store as array of sections
    s.percent = percent;
    alert('Staff updated');
  } else {
    // Support adding multiple staff at once: split by newline or comma
    const parts = rawName.split(/[\r\n,]+/).map(x=>x.trim()).filter(x=>x.length>0);
    if(parts.length === 0) return alert('No valid staff names provided');
    parts.forEach(n => {
      DB.staff.push({ id: genId('STF'), name: n, section: selected.slice(), percent: percent, daily:0, monthly:0, yearly:0 });
    });
    alert(parts.length === 1 ? 'Staff added' : `${parts.length} staff added`);
  }
  saveDB(); 
  renderAll(); 
  clearStaffForm();
}
function editStaff(id){
  const s = DB.staff.find(x=>x.id===id);
  if(!s) return;
  document.getElementById('s_name').value = s.name;
  // set section checkboxes (s.section may be array or string)
  const secs = Array.isArray(s.section) ? s.section.map(x=>x.toUpperCase()) : [(s.section||'').toUpperCase()];
  document.querySelectorAll('input[name="s_section"]').forEach(cb => { cb.checked = secs.includes(cb.value.toUpperCase()); });
  document.getElementById('s_percent').value = (s.percent || '');
  editingStaff = id;
}
function deleteStaff(id){
  if(!confirm('Remove staff? (history remains)')) return;
  DB.staff = DB.staff.filter(x=>x.id!==id);
  saveDB(); renderAll();
}

// ---------------- PRODUCTS CRUD ----------------
let editingProduct = null;
function clearProductForm(){ document.getElementById('p_name').value=''; document.getElementById('p_price').value=''; document.getElementById('p_stock').value=''; editingProduct=null; }
function onProductAddOrUpdate(){
  const rawName = document.getElementById('p_name').value.trim();
  const price = parseFloat(document.getElementById('p_price').value) || 0;
  const stock = parseInt(document.getElementById('p_stock').value) || 0;
  if(!rawName) return alert('Enter product name');
  if(price <= 0) return alert('Price must be greater than 0');
  if(stock < 0) return alert('Stock cannot be negative');
  if(editingProduct){
    const p = DB.products.find(x=>x.id===editingProduct);
    if(!p) return;
    p.name=rawName; p.price=price; p.stock=stock;
    alert('Product updated');
  } else {
    // Support multiple product lines (newline separated). Each line can be:
    // name | price | stock  OR just name (uses form price/stock)
    const lines = rawName.split(/[\r\n]+/).map(l=>l.trim()).filter(l=>l.length>0);
    const added = [];
    lines.forEach(line => {
      let name = line;
      let pPrice = price;
      let pStock = stock;
      if(line.includes('|')){
        const parts = line.split('|').map(x=>x.trim());
        name = parts[0] || '';
        pPrice = parseFloat(parts[1]) || price;
        pStock = parseInt(parts[2]) || stock;
      }
      if(name) {
        DB.products.push({ id: genId('PRD'), name, price: pPrice, stock: pStock });
        added.push(name);
      }
    });
    alert(added.length === 0 ? 'No valid products to add' : (added.length === 1 ? 'Product added' : `${added.length} products added`));
  }
  saveDB(); renderAll(); clearProductForm();
}
function editProduct(id){
  const p = DB.products.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('p_name').value = p.name; document.getElementById('p_price').value = p.price; document.getElementById('p_stock').value = p.stock;
  editingProduct = id;
}
function deleteProduct(id){
  if(!confirm('Remove product? (history remains)')) return;
  DB.products = DB.products.filter(x=>x.id!==id);
  saveDB(); renderAll();
}

// ---------------- SELL ----------------
function clearSellForm(){ 
  document.getElementById('sell_product').value = '';
  document.getElementById('sell_qty').value = '1';
  document.getElementById('sell_staff').value = '';
  document.getElementById('sell_payment').value = 'Cash';
  const up = document.getElementById('sell_unit_price'); if(up) up.value = '';
  document.getElementById('sell_price').value = '';
}
function updateSellPrice() {
  const pid = document.getElementById('sell_product').value;
  const qty = parseInt(document.getElementById('sell_qty').value) || 1;
  const unitField = document.getElementById('sell_unit_price');
  const priceField = document.getElementById('sell_price');
  let unitPrice = 0;
  if (pid) {
    const product = DB.products.find(x => x.id === pid);
    if (product) unitPrice = Number(product.price) || 0;
  }
  // if unit price is provided in the form, use it
  if (unitField && unitField.value !== '') {
    unitPrice = parseFloat(unitField.value) || 0;
  } else if (unitField) {
    // prefill unitField with product price when product selected
    if (pid) unitField.value = unitPrice.toFixed(2);
  }
  const total = unitPrice * qty;
  priceField.value = isFinite(total) ? total.toFixed(2) : '';
}

function sellProduct(){
  const pid = document.getElementById('sell_product').value;
  const qty = parseInt(document.getElementById('sell_qty').value) || 1;
  const staffID = document.getElementById('sell_staff').value;
  const payment = document.getElementById('sell_payment').value;
  if(!pid) return alert('Select product');
  const p = DB.products.find(x=>x.id===pid);
  if(!p) return alert('Product not found');
  if(p.stock < qty) return alert('Not enough stock');
  // determine unit price: prefer unit override from form
  const unitInput = document.getElementById('sell_unit_price');
  let unitPrice = p.price;
  if(unitInput && unitInput.value !== '') unitPrice = parseFloat(unitInput.value) || p.price;
  const total = unitPrice * qty;
  if(p.stock < qty) return alert('Not enough stock');
  p.stock -= qty;
  let staffName = '', staffEarn = 0;
  if(staffID){
    const s = DB.staff.find(x=>x.id===staffID);
    if(s){
      staffName = s.name;
      // Use staff-specific percent if configured (>0), otherwise default PRODUCT_STAFF_PERCENT
      const percent = (parseFloat(s.percent) > 0) ? parseFloat(s.percent) : PRODUCT_STAFF_PERCENT;
      staffEarn = total * (percent / 100);
      s.daily = (s.daily || 0) + staffEarn;
      s.monthly = (s.monthly || 0) + staffEarn;
      s.yearly = (s.yearly || 0) + staffEarn;
    }
  }
  const salonEarn = total - staffEarn;
  const tx = { id: genId('TX'), productId: p.id, productName: p.name, qty, total, staffID: staffID||'', staffName, staffEarn, salonEarn, payment, date: new Date().toISOString() };
  DB.transactions.push(tx);
  saveDB(); clearSellForm(); renderAll();
}

// Sell a service (e.g., MANICURE, BARBER)
// Default staff share for services is 40% (staff gets 40% of service price).
function sellService(serviceName, section, price, staffID, payment){
  if(!serviceName) return alert('Provide service name');
  const p = parseFloat(price) || 0;
  if(p <= 0) return alert('Invalid price');
  let staffName = '', staffEarn = 0;
  // Fixed 40% commission for services
  if(staffID){
    const s = DB.staff.find(x=>x.id===staffID);
    if(s){
      staffName = s.name;
      // Always use 40% commission for services
      staffEarn = p * (40 / 100);
      s.daily = (s.daily || 0) + staffEarn;
      s.monthly = (s.monthly || 0) + staffEarn;
      s.yearly = (s.yearly || 0) + staffEarn;
    }
  }
  const salonEarn = p - staffEarn;
  const tx = { id: genId('TX'), productId: '', productName: serviceName + ' ('+section+')', qty: 1, total: p, staffID: staffID||'', staffName, staffEarn, salonEarn, payment: payment||'Cash', date: new Date().toISOString() };
  DB.transactions.push(tx);
  saveDB(); renderAll();
  return tx;
}

// Convenience wrapper: sell a fixed-price service of 100 where staff gets 40%.
// Call example: sellService100('Deluxe Manicure','MANICURE', 'STF123456', 'Cash')
function sellService100(serviceName, section, staffID, payment){
  const fixedPrice = 100;
  const result = sellService(serviceName, section, fixedPrice, staffID, payment);
  clearServiceForm();
  return result;
}

// ---------------- SALARY PAY ----------------
function paySalary(){
  const sid = document.getElementById('pay_staff').value;
  if(!sid) return alert('Select staff');
  const s = DB.staff.find(x=>x.id===sid);
  if(!s) return alert('Staff not found');
  const amount = s.monthly || 0;
  if(amount <= 0) return alert('No monthly commission to pay');
  const rec = { id: genId('SAL'), staffID: s.id, staffName: s.name, amount, datetime: new Date().toISOString(), year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  DB.salaryHistory.push(rec);
  s.monthly = 0;
  saveDB();
  alert(`Salary ${amount.toFixed(2)} paid to ${s.name}`);
  renderAll();
}

// ---------------- SERVICES UI helpers ----------------
function clearServiceForm(){
  const el = document.getElementById('service_name'); if(el) el.value='';
  const sec = document.getElementById('service_section'); if(sec) sec.value='MANICURE';
  const pr = document.getElementById('service_price'); if(pr) pr.value='0';
  const st = document.getElementById('service_staff'); if(st) st.value='';
  const pay = document.getElementById('service_payment'); if(pay) pay.value='Cash';
}

function sellServiceUI(){
  const rawName = document.getElementById('service_name').value.trim();
  const section = document.getElementById('service_section').value;
  const price = parseFloat(document.getElementById('service_price').value) || 0;
  const staffID = document.getElementById('service_staff').value;
  const payment = document.getElementById('service_payment').value;
  if(!rawName) return alert('Enter service name');
  // Support multiple service names separated by newline or comma
  const parts = rawName.split(/[\r\n,]+/).map(x=>x.trim()).filter(x=>x.length>0);
  let count = 0;
  parts.forEach(name => {
    // If a staff is selected, ensure their section matches the service section
    if(staffID){
      const s = DB.staff.find(x=>x.id===staffID);
      if(s && s.section){
        const secs = Array.isArray(s.section) ? s.section.map(x=>x.toUpperCase()) : [(s.section||'').toUpperCase()];
        if(!secs.includes((section||'').toUpperCase())){
          alert(`Selected staff (${s.name}) cannot perform service in section ${section}.`);
          return; // skip this item
        }
      }
    }
    sellService(name, section, price, staffID, payment);
    count++;
  });
  clearServiceForm();
  renderAll();
  alert(count === 1 ? 'Service recorded' : `${count} services recorded`);
}

// ---------------- REPORTS ----------------
function renderTransactions(filterFn){
  const rows = DB.transactions.filter(filterFn);
  if(rows.length === 0) return '<small>No transactions</small>';
  return '<table><thead><tr><th>ID</th><th>Product</th><th>Qty</th><th>Total</th><th>Staff</th><th>StaffEarn</th><th>SalonEarn</th><th>Payment</th><th>Date</th></tr></thead><tbody>' +
    rows.map(r=>`<tr><td>${r.id}</td><td>${r.productName}</td><td>${r.qty}</td><td>${r.total.toFixed(2)}</td><td>${r.staffName}</td><td>${r.staffEarn.toFixed(2)}</td><td>${r.salonEarn.toFixed(2)}</td><td>${r.payment}</td><td>${new Date(r.date).toLocaleString()}</td></tr>`).join('') +
    '</tbody></table>';
}
function showDailyReport(){
  const now = new Date();
  document.getElementById('reportArea').innerHTML = '<h4>Daily</h4>' + renderTransactions(t=>{ const d = new Date(t.date); return d.toDateString() === now.toDateString(); });
}
function showMonthlyReport(){
  const now = new Date();
  document.getElementById('reportArea').innerHTML = '<h4>Monthly</h4>' + renderTransactions(t=>{ const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
}
function showYearlyReport(){
  const now = new Date();
  document.getElementById('reportArea').innerHTML = '<h4>Yearly</h4>' + renderTransactions(t=>{ const d = new Date(t.date); return d.getFullYear() === now.getFullYear(); });
}
function monthlyStaffReport(){
  const rows = DB.staff.map(s=>({ name: s.name, monthly: s.monthly || 0, id: s.id }));
  let html = '<h4>Monthly Staff Commission</h4><table><thead><tr><th>Staff</th><th>Commission</th><th>Action</th></tr></thead><tbody>';
  html += rows.map(r=>`<tr><td>${r.name}</td><td>${r.monthly.toFixed(2)}</td><td><button onclick="printStaffSalaryById('${r.id}')">Print</button></td></tr>`).join('');
  html += '</tbody></table>';
  document.getElementById('reportArea').innerHTML = html;
}
function monthlySalonReport(){
  const now = new Date();
  const monthlyTx = DB.transactions.filter(t=>{ const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const salonTotal = monthlyTx.reduce((acc,t)=>acc + (t.salonEarn || 0), 0);
  document.getElementById('reportArea').innerHTML = `<h4>Monthly Salon Profit</h4><p>Total Salon Profit: ${salonTotal.toFixed(2)}</p>` + renderTransactions(t=>{ const d=new Date(t.date); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
}

// Print/save current Monthly Salon Profit report
async function printMonthlySalonReport(){
  monthlySalonReport();
  // exportCurrentReportPDF uses reportArea.innerText; call it to prompt save
  await exportCurrentReportPDF();
}

// Print/save current Monthly Staff Commission report
async function printMonthlyStaffCommission(){
  monthlyStaffReport();
  await exportCurrentReportPDF();
}

// Print/save a detailed monthly salon profit report (full month breakdown)
async function printFullMonthlySalonProfit(){
  const now = new Date();
  const monthlyTx = DB.transactions.filter(t=>{ const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  if(!monthlyTx.length) return alert('No transactions for this month');

  const totalRevenue = monthlyTx.reduce((acc,t)=>acc + (t.total||0), 0);
  const totalStaff = monthlyTx.reduce((acc,t)=>acc + (t.staffEarn||0), 0);
  const totalSalon = monthlyTx.reduce((acc,t)=>acc + (t.salonEarn||0), 0);

  let lines = [];
  lines.push('Monthly Salon Profit Report (Detailed)');
  lines.push(`Month: ${now.getMonth()+1}/${now.getFullYear()}`);
  lines.push('');
  lines.push(`Total Revenue: ${totalRevenue.toFixed(2)}`);
  lines.push(`Total Staff Earn: ${totalStaff.toFixed(2)}`);
  lines.push(`Total Salon Earn: ${totalSalon.toFixed(2)}`);
  lines.push('');
  lines.push('Transactions:');
  lines.push('ID | Date | Item | Qty | Total | Staff | StaffEarn | SalonEarn | Payment');
  monthlyTx.forEach(t=>{
    const date = new Date(t.date).toLocaleString();
    lines.push(`${t.id} | ${date} | ${t.productName} | ${t.qty} | ${ (t.total||0).toFixed(2) } | ${t.staffName||''} | ${ (t.staffEarn||0).toFixed(2) } | ${ (t.salonEarn||0).toFixed(2) } | ${t.payment||''}`);
  });

  const content = lines.join('\n');
  const filename = `salon_full_month_profit_${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}.txt`;
  const res = await ipcRenderer.invoke('save-file', { filename, content });
  if(res.ok) alert('Full monthly profit saved: ' + res.filePath);
}

// ---------------- PDF / CSV via main ----------------
async function exportCurrentReportPDF(){
  // simple client side text -> ask user to Save via main process
  const html = document.getElementById('reportArea').innerText || 'No report';
  const filename = `salon_report_${new Date().toISOString().slice(0,10)}.txt`;
  const res = await ipcRenderer.invoke('save-file', { filename, content: html });
  if(res.ok) alert('Report saved: ' + res.filePath);
}
async function ipcExportCSV(type){
  const res = await ipcRenderer.invoke('export-csv', { type });
  if(res.ok) alert('CSV saved: ' + res.filePath);
}

// ---------------- UTILS & UI RENDER ----------------
function genId(prefix){ return prefix + Date.now().toString().slice(-6); }

// Calculate amount from a percent value. percent is treated as a percentage number
// Example: percent=40 -> returns amount * 0.40 ; percent=0.5 -> returns amount * 0.005
function calculatePercentAmount(amount, percent){
  const p = parseFloat(percent) || 0;
  return amount * (p / 100);
}

// Convenience for service split (staff vs salon). Default staffPercent is 40%.
function calculateServiceSplit(price, staffPercent = 40){
  const staffEarn = calculatePercentAmount(price, staffPercent);
  const salonEarn = price - staffEarn;
  return { staffPercent, staffEarn, salonEarn };
}

function renderAll(){
  // update UI from DB
  // users
  renderUsers();

  // staff list
  const st = document.getElementById('staffTable');
  st.innerHTML = DB.staff.length ? '<table><thead><tr><th>ID</th><th>Name</th><th>Section</th><th>%</th><th>Daily</th><th>Monthly</th><th>Yearly</th><th>Actions</th></tr></thead><tbody>' +
    DB.staff.map(s=>`<tr><td>${s.id}</td><td>${s.name}</td><td>${Array.isArray(s.section)?s.section.join(', '):s.section}</td><td>${(s.percent||'')}</td><td>${(s.daily||0).toFixed(2)}</td><td>${(s.monthly||0).toFixed(2)}</td><td>${(s.yearly||0).toFixed(2)}</td><td><button onclick="editStaff('${s.id}')">Edit</button> <button onclick="deleteStaff('${s.id}')">Remove</button></td></tr>`).join('') +
    '</tbody></table>' : '<small>No staff</small>';

  // products
  const pt = document.getElementById('productTable');
  pt.innerHTML = DB.products.length ? '<table><thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>' +
    DB.products.map(p=>`<tr><td>${p.id}</td><td>${p.name}</td><td>${p.price.toFixed(2)}</td><td>${p.stock}</td><td><button onclick="editProduct('${p.id}')">Edit</button> <button onclick="deleteProduct('${p.id}')">Remove</button></td></tr>`).join('') +
    '</tbody></table>' : '<small>No products</small>';

  // sell selects
  const sp = document.getElementById('sell_product');
  sp.innerHTML = '<option value="">-- choose --</option>' + DB.products.map(p=>`<option value="${p.id}">${p.name} — ${p.price.toFixed(2)} (stock:${p.stock})</option>`).join('');
  const ss = document.getElementById('sell_staff');
  ss.innerHTML = '<option value="">-- none --</option>' + DB.staff.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  // service staff select
  const ssv = document.getElementById('service_staff');
  if(ssv) ssv.innerHTML = '<option value="">-- none --</option>' + DB.staff.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  // pay staff select
  const paySel = document.getElementById('pay_staff');
  paySel.innerHTML = '<option value="">-- select --</option>' + DB.staff.map(s=>`<option value="${s.id}">${s.name} — ${ (s.monthly||0).toFixed(2) }</option>`).join('');

  // recent tx
  const rx = document.getElementById('recentTx');
  if(!DB.transactions.length) rx.innerHTML = '<small>No transactions</small>'; else {
    const last = DB.transactions.slice(-8).reverse();
    rx.innerHTML = '<ul>' + last.map(t=>`<li>${new Date(t.date).toLocaleString()} — ${t.productName} x${t.qty} = ${t.total.toFixed(2)} ${t.staffName ? '| staff: '+t.staffName : ''}</li>`).join('') + '</ul>';
  }

  // recent service tx (transactions with empty productId)
  const rst = document.getElementById('recentServiceTx');
  if(rst){
    const services = DB.transactions.filter(t=>!t.productId);
    if(!services.length) rst.innerHTML = '<small>No service transactions</small>'; else {
      const lastS = services.slice(-8).reverse();
      rst.innerHTML = '<ul>' + lastS.map(t=>`<li>${new Date(t.date).toLocaleString()} — ${t.productName} = ${t.total.toFixed(2)} ${t.staffName ? '| staff: '+t.staffName : ''}</li>`).join('') + '</ul>';
    }
  }

  // save DB changes
  saveDB();
}

// ---------------- BACKUP / RESTORE / CLEAR ----------
function backupDB(){
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `harmonic_salon_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}
function restorePrompt(){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange = e=>{
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev=>{
      try{
        const data = JSON.parse(ev.target.result);
        if(confirm('Restore will overwrite current data. Continue?')){
          DB = data;
          saveDB();
          renderAll();
          alert('Restored');
        }
      }catch(err){ alert('Invalid JSON'); }
    };
    reader.readAsText(f);
  };
  inp.click();
}
function clearAllData(){
  if(!confirm('Wipe ALL data?')) return;
  // reset to default
  DB = { users: [{ username: 'HARMONICSALON', password: 'harmonic4', role: 'admin' }], staff: [], products: [], transactions: [], salaryHistory: [] };
  saveDB();
  renderAll();
}

// ---------------- Print single staff salary PDF (simple) ----------------
async function printStaffSalaryById(id){
  const staff = DB.staff.find(x=>x.id===id);
  if(!staff) return alert('Staff not found');
  const txt = `Staff Salary Report\nName: ${staff.name}\nMonth: ${new Date().getMonth()+1}/${new Date().getFullYear()}\nAmount: ${(staff.monthly||0).toFixed(2)}`;
  const res = await ipcRenderer.invoke('save-file', { filename: `salary_${staff.name}_${new Date().toISOString().slice(0,10)}.txt`, content: txt });
  if(res.ok) alert('Saved: ' + res.filePath);
}
function printStaffSalarySelected(){
  const sid = document.getElementById('pay_staff').value;
  if(!sid) return alert('Select staff');
  printStaffSalaryById(sid);
}

// ---------------- start up ----------------
// Save data before window unload
window.addEventListener('beforeunload', async (e) => {
  // Cancel the event to ensure save completes
  e.preventDefault();
  e.returnValue = '';
  
  try {
    await saveDB();
    console.log('Data saved before closing');
  } catch (err) {
    console.error('Error saving data before close:', err);
    alert('Error saving data before close. Please try again.');
  }
});

// Auto-save data periodically (every 30 seconds)
let autoSaveInterval = setInterval(async () => {
  try {
    await saveDB();
    console.log('Auto-save completed');
  } catch (err) {
    console.error('Auto-save error:', err);
  }
}, 30000);

// Save data when window loses focus
window.addEventListener('blur', async () => {
  try {
    await saveDB();
    console.log('Data saved on window blur');
  } catch (err) {
    console.error('Error saving on blur:', err);
  }
});

// Initial load
(async ()=>{ 
  try {
    await loadDB();
    console.log('Initial data load completed');
    
    // Verify data is loaded correctly
    if (!DB.staff || !DB.products) {
      console.error('Data structures missing after load');
      alert('Error: Some data failed to load. Please refresh.');
      return;
    }
    
    // Log loaded data statistics
    console.log('Loaded:', {
      staff: DB.staff.length + ' staff members',
      products: DB.products.length + ' products',
      transactions: DB.transactions.length + ' transactions'
    });
  } catch (err) {
    console.error('Error during initial load:', err);
    alert('Error loading data. Please refresh the page.');
  }
})();
