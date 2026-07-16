const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, '..', 'commands');
const menuPath = path.join(commandsDir, 'menu.js');

const menuSource = fs.readFileSync(menuPath, 'utf8');

const files = fs
  .readdirSync(commandsDir)
  .filter((f) => f.endsWith('.js') && f !== 'menu.js');

const missing = [];
const broken = [];

for (const file of files) {
  const filePath = path.join(commandsDir, file);
  let command;

  try {
    delete require.cache[require.resolve(filePath)];
    command = require(filePath);
  } catch (e) {
    broken.push({ file, error: e.message });
    continue;
  }

  if (!command || !command.name) {
    broken.push({ file, error: 'No exported "name" field' });
    continue;
  }

  const namesToCheck = [command.name, ...(command.aliases || [])];
  const inMenu = namesToCheck.some((n) => menuSource.includes(`'${n}'`));

  if (!inMenu) {
    missing.push({ file, name: command.name, aliases: command.aliases || [] });
  }
}

console.log(`\nScanned ${files.length} command files.\n`);

if (broken.length) {
  console.log(`⚠️  ${broken.length} file(s) failed to load:`);
  broken.forEach((b) => console.log(`   - ${b.file}: ${b.error}`));
  console.log('');
}

if (missing.length === 0) {
  console.log('✅ Every loaded command is listed in menu.js.\n');
} else {
  console.log(`❌ ${missing.length} command(s) loaded but missing from menu.js:\n`);
  missing.forEach((m) => {
    const aliasNote = m.aliases.length ? ` (aliases: ${m.aliases.join(', ')})` : '';
    console.log(`   - ${m.name}${aliasNote}  [${m.file}]`);
  });
  console.log('');
}
