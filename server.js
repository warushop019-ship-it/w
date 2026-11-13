// path: server.js
// runtime: Node.js (>=18) / Express
// description: Authenticated payload distribution engine with integrated KeyAuth licensing

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || '';

// Storage paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Database structure
let db = {
  admin: {
    username: "admin",
    passwordHash: crypto.createHash('sha256').update("admin123").digest('hex'),
    sessionTokens: []
  },
  appSettings: {
    name: "ApexSecurity",
    secret: "apex_secret_key_999",
    version: "1.0"
  },
  files: {},     // token -> { storedName, originalName, size, mimetype, uploadedAt, downloads, owner }
  licenses: {},  // key -> { key, durationDays, hwid, created, expires, status }
  users: {}      // username -> { username, passwordHash, created, role }
};

if (fs.existsSync(DB_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db = Object.assign(db, loaded);
    db.files = db.files || {};
    db.licenses = db.licenses || {};
    db.users = db.users || {};
  } catch (e) {
    console.error("Database read exception, initializing default state.");
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Authentication verification middleware
function requireAuth(req, res, next) {
  const token = req.headers['authorization'] || req.query.auth_token;
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required. Please sign in." });
  }

  // Check admin sessions
  if (db.admin.sessionTokens.includes(token)) {
    req.user = { username: db.admin.username, role: 'admin' };
    return next();
  }

  // Check user sessions
  for (const u of Object.values(db.users)) {
    if (u.sessionTokens && u.sessionTokens.includes(token)) {
      req.user = { username: u.username, role: u.role || 'user' };
      return next();
    }
  }

  return res.status(401).json({ success: false, message: "Session expired or invalid. Please sign in again." });
}

// ==================== AUTHENTICATION API ====================

// Login (Admin or Registered Users)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required" });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');

  // Check Admin
  if (username === db.admin.username && hash === db.admin.passwordHash) {
    const sessionToken = crypto.randomBytes(24).toString('hex');
    db.admin.sessionTokens.push(sessionToken);
    saveDB();
    return res.json({
      success: true,
      token: sessionToken,
      username: "admin",
      role: "admin",
      appName: db.appSettings.name
    });
  }

  // Check Regular Users
  const user = db.users[username];
  if (user && user.passwordHash === hash) {
    const sessionToken = crypto.randomBytes(24).toString('hex');
    user.sessionTokens = user.sessionTokens || [];
    user.sessionTokens.push(sessionToken);
    saveDB();
    return res.json({
      success: true,
      token: sessionToken,
      username: user.username,
      role: user.role || "user",
      appName: db.appSettings.name
    });
  }

  res.status(401).json({ success: false, message: "Invalid username or password." });
});

// User Registration
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 4) {
    return res.status(400).json({ success: false, message: "Username min 3 chars, password min 4 chars." });
  }

  if (username === db.admin.username || db.users[username]) {
    return res.status(400).json({ success: false, message: "Username already taken." });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const sessionToken = crypto.randomBytes(24).toString('hex');

  db.users[username] = {
    username: username,
    passwordHash: hash,
    created: new Date().toISOString(),
    role: "user",
    sessionTokens: [sessionToken]
  };
  saveDB();

  res.json({
    success: true,
    token: sessionToken,
    username: username,
    role: "user",
    appName: db.appSettings.name
  });
});

// Change Admin / App Settings
app.post('/api/auth/settings', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin role required." });
  }

  const { newPassword, appName, secret } = req.body;
  if (newPassword && newPassword.length >= 4) {
    db.admin.passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  }
  if (appName) db.appSettings.name = appName;
  if (secret) db.appSettings.secret = secret;
  saveDB();
  res.json({ success: true, message: "Settings updated successfully." });
});

// Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization'];
  db.admin.sessionTokens = db.admin.sessionTokens.filter(t => t !== token);
  for (const u of Object.values(db.users)) {
    if (u.sessionTokens) {
      u.sessionTokens = u.sessionTokens.filter(t => t !== token);
    }
  }
  saveDB();
  res.json({ success: true, message: "Logged out." });
});

// ==================== AUTHENTICATED FILE STORAGE ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const fileId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// Protected Upload: MUST BE LOGGED IN
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Clean random token
  const token = crypto.randomBytes(8).toString('hex');
  const originalName = req.file.originalname;

  db.files[token] = {
    token: token,
    storedName: req.file.filename,
    originalName: originalName,
    size: req.file.size,
    mimetype: req.file.mimetype || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    downloads: 0,
    owner: req.user.username
  };
  saveDB();

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const domain = BASE_URL || `${protocol}://${host}`;
  const directUrl = `${domain}/api/${token}`;

  res.json({
    success: true,
    token: token,
    filename: originalName,
    size: req.file.size,
    directUrl: directUrl
  });
});

// Public Direct Download: /api/:token (No login required to download, clean zero-name URL)
app.get('/api/:token', (req, res, next) => {
  const { token } = req.params;
  const record = db.files[token];

  if (record) {
    const filePath = path.join(UPLOAD_DIR, record.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing from storage.');
    }

    record.downloads = (record.downloads || 0) + 1;
    saveDB();

    res.setHeader('Content-Type', record.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.originalName)}"`);
    res.setHeader('Content-Length', record.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  }
  next();
});

// Backward compatibility: /api/:token/:filename
app.get('/api/:token/:filename', (req, res) => {
  const { token } = req.params;
  const record = db.files[token];
  if (!record) return res.status(404).send('File not found or expired.');

  const filePath = path.join(UPLOAD_DIR, record.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing from disk.');

  record.downloads = (record.downloads || 0) + 1;
  saveDB();

  res.setHeader('Content-Type', record.mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.originalName)}"`);
  res.setHeader('Content-Length', record.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// List Files (Authenticated)
app.get('/api/files', requireAuth, (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const domain = BASE_URL || `${protocol}://${host}`;

  const allFiles = Object.values(db.files);
  // Admin sees all files; user sees their own files
  const filtered = req.user.role === 'admin'
    ? allFiles
    : allFiles.filter(f => f.owner === req.user.username);

  const list = filtered.map(f => ({
    ...f,
    directUrl: `${domain}/api/${f.token}`
  }));
  res.json({ success: true, files: list });
});

// Delete File (Authenticated)
app.delete('/api/files/:token', requireAuth, (req, res) => {
  const { token } = req.params;
  const record = db.files[token];
  if (!record) return res.status(404).json({ success: false, message: "File not found" });

  if (req.user.role !== 'admin' && record.owner !== req.user.username) {
    return res.status(403).json({ success: false, message: "Permission denied" });
  }

  const filePath = path.join(UPLOAD_DIR, record.storedName);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }

  delete db.files[token];
  saveDB();
  res.json({ success: true, message: "File deleted successfully" });
});

// Rename File (Authenticated)
app.patch('/api/files/:token', requireAuth, (req, res) => {
  const { token } = req.params;
  const { newName } = req.body;
  const record = db.files[token];
  if (!record) return res.status(404).json({ success: false, message: "File not found" });

  if (req.user.role !== 'admin' && record.owner !== req.user.username) {
    return res.status(403).json({ success: false, message: "Permission denied" });
  }

  if (newName) {
    record.originalName = newName.trim();
    saveDB();
  }
  res.json({ success: true, message: "File renamed successfully" });
});

// ==================== KEYAUTH LICENSING SYSTEM ====================

// Generate Keys
app.post('/api/licenses/create', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin role required to generate keys." });
  }

  const { days = 30, amount = 1, prefix = "APEX" } = req.body;
  const createdKeys = [];

  for (let i = 0; i < Math.min(amount, 50); i++) {
    const chunk1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const chunk2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const chunk3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const key = `${prefix}-${chunk1}-${chunk2}-${chunk3}`;

    db.licenses[key] = {
      key: key,
      durationDays: parseInt(days, 10),
      hwid: null,
      created: new Date().toISOString(),
      expires: null,
      status: "active"
    };
    createdKeys.push(key);
  }

  saveDB();
  res.json({ success: true, keys: createdKeys });
});

// List Licenses
app.get('/api/licenses', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin role required." });
  }
  res.json({ success: true, licenses: Object.values(db.licenses) });
});

// Revoke/Delete Key
app.delete('/api/licenses/:key', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin role required." });
  }
  const { key } = req.params;
  if (db.licenses[key]) {
    delete db.licenses[key];
    saveDB();
    return res.json({ success: true, message: "License revoked" });
  }
  res.status(404).json({ success: false, message: "Key not found" });
});

// Reset HWID
app.post('/api/licenses/:key/reset-hwid', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin role required." });
  }
  const { key } = req.params;
  if (db.licenses[key]) {
    db.licenses[key].hwid = null;
    saveDB();
    return res.json({ success: true, message: "HWID reset successfully" });
  }
  res.status(404).json({ success: false, message: "Key not found" });
});

// ==================== KEYAUTH CLIENT API (v1.2 compatible) ====================
app.all('/api/1.2/', (req, res) => {
  const type = req.query.type || req.body.type;
  const key = req.query.key || req.body.key;
  const hwid = req.query.hwid || req.body.hwid;

  if (type === 'init') {
    const session = crypto.randomBytes(16).toString('hex');
    return res.json({
      success: true,
      message: "Initialized",
      sessionid: session,
      appinfo: {
        numUsers: Object.keys(db.users).length,
        numOnlineUsers: 1,
        numKeys: Object.keys(db.licenses).length,
        version: db.appSettings.version,
        customerPanel: "ApexDirect"
      }
    });
  }

  if (type === 'license') {
    if (!key || !db.licenses[key]) {
      return res.json({ success: false, message: "Invalid license key." });
    }

    const license = db.licenses[key];
    if (license.status === 'banned') {
      return res.json({ success: false, message: "This license has been banned." });
    }

    if (!license.expires) {
      const now = new Date();
      now.setDate(now.getDate() + license.durationDays);
      license.expires = now.toISOString();
      license.hwid = hwid || "HWID_AUTO_REGISTERED";
      license.status = "used";
      saveDB();
    } else {
      if (new Date() > new Date(license.expires)) {
        return res.json({ success: false, message: "License key expired." });
      }
      if (hwid && license.hwid && license.hwid !== hwid) {
        return res.json({ success: false, message: "HWID mismatch. Reset HWID on dashboard." });
      }
    }

    return res.json({
      success: true,
      message: "Logged in successfully!",
      info: {
        username: license.key,
        subscriptions: [{
          subscription: "default",
          expiry: Math.floor(new Date(license.expires).getTime() / 1000),
          timeleft: Math.max(0, Math.floor((new Date(license.expires).getTime() - Date.now()) / 1000))
        }],
        ip: req.ip,
        hwid: license.hwid,
        createdate: Math.floor(new Date(license.created).getTime() / 1000),
        lastlogin: Math.floor(Date.now() / 1000)
      }
    });
  }

  res.json({ success: false, message: "Unknown request type." });
});

// REST Direct verify
app.post('/api/v1/license/verify', (req, res) => {
  const { key, hwid } = req.body;
  if (!key || !db.licenses[key]) {
    return res.status(400).json({ success: false, message: "License key not found" });
  }

  const license = db.licenses[key];
  if (license.status === 'banned') {
    return res.status(403).json({ success: false, message: "License is banned" });
  }

  if (!license.expires) {
    const exp = new Date();
    exp.setDate(exp.getDate() + license.durationDays);
    license.expires = exp.toISOString();
    license.hwid = hwid || null;
    license.status = 'used';
    saveDB();
  } else {
    if (new Date() > new Date(license.expires)) {
      return res.status(403).json({ success: false, message: "License expired" });
    }
    if (hwid && license.hwid && license.hwid !== hwid) {
      return res.status(403).json({ success: false, message: "HWID Mismatch" });
    }
  }

  res.json({
    success: true,
    message: "License Valid",
    expires: license.expires,
    hwid: license.hwid
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[+] Authenticated Direct File Host & KeyAuth Engine online on port ${PORT}`);
});
