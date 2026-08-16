function padRight(s, width) {
  return `${s}${' '.repeat(Math.max(0, width - s.length))}`;
}

export function renderGlobalHelp(registry, commandName = null) {
  if (commandName) {
    const cmd = registry.get(commandName);
    if (!cmd) return renderUnknownCommand(registry, commandName);

    const lines = [];
    lines.push(`${registry.meta.name} ${registry.meta.version}`);
    lines.push('');
    lines.push(`Command: ${cmd.name}`);
    if (cmd.description) lines.push(cmd.description);
    lines.push('');
    lines.push(`Usage: Taand ${cmd.usage ?? cmd.name}`);
    lines.push('');
    lines.push('Options:');
    lines.push('  -h, --help     Show help');
    lines.push('  -v, --version  Show version');
    if (cmd.options?.length) {
      const max = Math.max(...cmd.options.map((o) => o.flag.length));
      for (const o of cmd.options) {
        lines.push(`  ${padRight(o.flag, max)}  ${o.description ?? ''}`.trimEnd());
      }
    }
    if (cmd.examples?.length) {
      lines.push('');
      lines.push('Examples:');
      for (const ex of cmd.examples) lines.push(`  ${ex}`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  const lines = [];
  lines.push(`${registry.meta.name} ${registry.meta.version}`);
  lines.push('');
  lines.push('Usage: Taand <command> [options]');
  lines.push('       npm run dev | npm start   (HTTP server)');
  lines.push('');
  lines.push('Commands:');

  const commands = registry.all().filter((c) => c.name !== 'help');
  const max = Math.max(...commands.map((c) => c.name.length));
  for (const cmd of commands) {
    lines.push(`  ${padRight(cmd.name, max)}  ${cmd.description ?? ''}`.trimEnd());
  }

  lines.push('');
  lines.push('Run: Taand help <command>');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function renderUnknownCommand(registry, name) {
  const lines = [];
  lines.push(`[Taand] Command not found: ${name}`);
  lines.push('Run: Taand list');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

