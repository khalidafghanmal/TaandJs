const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  amber: '\x1b[38;5;214m',
  green: '\x1b[32m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const c = {
  bold: (t) => `${ANSI.bold}${t}${ANSI.reset}`,
  dim: (t) => `${ANSI.dim}${t}${ANSI.reset}`,
  yellow: (t) => `${ANSI.yellow}${t}${ANSI.reset}`,
  amber: (t) => `${ANSI.amber}${t}${ANSI.reset}`,
  green: (t) => `${ANSI.green}${t}${ANSI.reset}`,
  gray: (t) => `${ANSI.gray}${t}${ANSI.reset}`,
};

/**
 * Dev server terminal UI — startup & shutdown banners.
 */
export class DevConsole {
  static printStartup({ url, liveReload, version = '0.1.0' }) {
    const line = '─'.repeat(44);

    console.log('');
    console.log(`  ${c.amber('╭')}${c.amber(line)}${c.amber('╮')}`);
    console.log(`  ${c.amber('│')}  ${c.bold(c.yellow('TaandJs'))} ${c.dim(`v${version}`)}${' '.repeat(44 - 10 - version.length - 3)}${c.amber('│')}`);
    console.log(`  ${c.amber('│')}  ${c.dim('by Khalid Afghanmal')}${' '.repeat(44 - 22)}${c.amber('│')}`);
    console.log(`  ${c.amber('╰')}${c.amber(line)}${c.amber('╯')}`);
    console.log('');
    console.log(`  ${c.green('●')} ${c.bold('Dev server running')}`);
    if (liveReload) {
      console.log(`  ${c.amber('↻')} ${c.dim('Live reload enabled')}`);
    }
    console.log('');
    console.log(`  ${c.amber('➜')} ${c.dim('Local:')}   ${c.bold(url)}`);
    console.log('');
    console.log(`  ${c.gray('Press Ctrl+C to stop')}`);
    console.log('');
  }

  static printStopping() {
    console.log('');
    console.log(`  ${c.amber('◼')} ${c.dim('Stopping TaandJs...')}`);
  }

  static printStopped() {
    console.log(`  ${c.green('✓')} ${c.dim('Server stopped')}`);
    console.log('');
  }
}
