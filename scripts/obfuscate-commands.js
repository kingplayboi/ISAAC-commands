const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src-clean', 'commands');
const outDir = path.join(__dirname, '..', 'commands');

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

let done = 0;
for (const file of files) {
  const code = fs.readFileSync(path.join(srcDir, file), 'utf8');

  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 1,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false
  });

  fs.writeFileSync(path.join(outDir, file), result.getObfuscatedCode(), 'utf8');
  done++;
  console.log(`  ↳ obfuscated ${file}`);
}

console.log(`✅ Done. Obfuscated ${done} file(s).`);
