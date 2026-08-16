function isFlag(token) {
  return token.startsWith('-') && token !== '-';
}

export function parseArgv(argv) {
  const tokens = argv.slice();
  const commandName = tokens[0];
  const rest = tokens.slice(1);

  const global = { help: false, version: false };
  const command = { flags: new Set(), options: {}, help: false };
  const positionals = [];

  // Global switches accepted anywhere (like artisan).
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === '--help' || t === '-h') {
      command.help = true;
      continue;
    }
    if (t === '--version' || t === '-v') {
      global.version = true;
      continue;
    }
  }

  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (!isFlag(t)) {
      positionals.push(t);
      continue;
    }

    if (t === '--help' || t === '-h' || t === '--version' || t === '-v') continue;

    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      if (eq !== -1) {
        const key = t.slice(2, eq);
        const value = t.slice(eq + 1);
        command.options[key] = value;
      } else {
        const key = t.slice(2);
        const next = rest[i + 1];
        if (next && !isFlag(next)) {
          command.options[key] = next;
          i++;
        } else {
          command.flags.add(key);
        }
      }
      continue;
    }

    // short flags: -abc => a,b,c
    if (t.startsWith('-') && !t.startsWith('--')) {
      const letters = t.slice(1).split('');
      for (const letter of letters) command.flags.add(letter);
      continue;
    }
  }

  // Global help: `Taand --help` and `Taand help`
  if (commandName === '--help' || commandName === '-h') {
    global.help = true;
  }
  if (commandName === '--version' || commandName === '-v') {
    global.version = true;
  }
  if (command.help && positionals.length === 0 && (commandName === 'help' || commandName === 'list')) {
    // fine
  }

  return { commandName, positionals, global, command };
}

