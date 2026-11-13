// path: obfuscate.js
// runtime: Node.js
// description: Automated obfuscation pipeline for server and client assets

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const OBF_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.8,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.9,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

const DIST_DIR = path.join(__dirname, 'dist');
const DIST_PUBLIC = path.join(DIST_DIR, 'public');

if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
if (!fs.existsSync(DIST_PUBLIC)) fs.mkdirSync(DIST_PUBLIC, { recursive: true });

function obfuscateFile(sourcePath, destPath) {
  const code = fs.readFileSync(sourcePath, 'utf8');
  const obfuscationResult = JavaScriptObfuscator.obfuscate(code, OBF_OPTIONS);
  fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode(), 'utf8');
  console.log(`[+] Obfuscated: ${path.basename(sourcePath)} -> ${destPath}`);
}

function copyStatic(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`[+] Copied: ${path.basename(src)} -> ${dest}`);
}

console.log('[*] Commencing full asset obfuscation...');

// 1. Obfuscate frontend logic
obfuscateFile(
  path.join(__dirname, 'public', 'app.js'),
  path.join(DIST_PUBLIC, 'app.js')
);

// 2. Copy HTML & CSS
copyStatic(
  path.join(__dirname, 'public', 'index.html'),
  path.join(DIST_PUBLIC, 'index.html')
);
copyStatic(
  path.join(__dirname, 'public', 'style.css'),
  path.join(DIST_PUBLIC, 'style.css')
);

// 3. Obfuscate server logic
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
// Adapt public static path for dist build
const adaptedServerCode = serverCode.replace("path.join(__dirname, 'public')", "path.join(__dirname, 'public')");
const serverObfuscated = JavaScriptObfuscator.obfuscate(adaptedServerCode, {
  ...OBF_OPTIONS,
  target: 'node'
});

fs.writeFileSync(path.join(DIST_DIR, 'server.js'), serverObfuscated.getObfuscatedCode(), 'utf8');
console.log(`[+] Server obfuscated -> ${path.join(DIST_DIR, 'server.js')}`);
console.log('[*] Build completed in ./dist');
