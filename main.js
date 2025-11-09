const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { Parser } = require('json2csv');

const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DB = {
  users: [{ username: 'HARMONICSALON', password: 'harmonic4', role: 'admin' }],
  staff: [],
  products: [],
  transactions: [],
  salaryHistory: []
};

async function ensureData(){
  if (!await fs.pathExists(DATA_FILE)) {
    await fs.writeJson(DATA_FILE, DEFAULT_DB, { spaces: 2 });
  }
}

async function readDB(){ await ensureData(); return fs.readJson(DATA_FILE); }
async function writeDB(db){ 
  // Create backup of current file
  if (await fs.pathExists(DATA_FILE)) {
    await fs.copy(DATA_FILE, DATA_FILE + '.backup');
  }
  // Write new data
  await fs.writeJson(DATA_FILE, db, { spaces: 2 });
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile('index.html');
  // win.webContents.openDevTools();
}

app.whenReady().then(async () => { await ensureData(); createWindow(); });
// On macOS recreate window when dock icon is clicked and no windows open
app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) { await ensureData(); createWindow(); } });

ipcMain.handle('db-read', async () => { try { return await readDB(); } catch (err) { return { ok: false, error: err.message || String(err) }; } });
ipcMain.handle('db-write', async (event, db) => { try { await writeDB(db); return { ok: true }; } catch (err) { return { ok: false, error: err.message || String(err) }; } });

ipcMain.handle('login', async (event, { username, password }) => {
  try {
    const db = await readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) return { ok: true, user };
    return { ok: false };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('export-csv', async (event, { type }) => {
  try {
    const db = await readDB();
    let data = [];
    if (type === 'staff') data = db.staff || [];
    else if (type === 'products') data = db.products || [];
    else if (type === 'transactions') data = db.transactions || [];
    else if (type === 'salaryHistory') data = db.salaryHistory || [];
    else data = db.transactions || [];

    if (!Array.isArray(data) || data.length === 0) {
      // nothing to export
      return { ok: false, error: 'No data to export' };
    }

    const parser = new Parser();
    const csv = parser.parse(data);
    const { filePath } = await dialog.showSaveDialog({ defaultPath: `${type || 'report'}.csv` });
    if (filePath) {
      await fs.writeFile(filePath, csv);
      return { ok: true, filePath };
    }
    return { ok: false };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('save-file', async (event, { filename, content }) => {
  try {
    const { filePath } = await dialog.showSaveDialog({ defaultPath: filename });
    if (filePath) {
      await fs.writeFile(filePath, content);
      return { ok: true, filePath };
    }
    return { ok: false };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
