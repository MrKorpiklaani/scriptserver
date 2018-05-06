const EventsEmitter = require('events');
const { spawn } = require('child_process');
const defaultsDeep = require('lodash.defaultsdeep');
const Rcon = require('./Rcon');

const defaultConfig = {
  core: {
    jar: 'minecraft_server.jar',
    args: ['-Xmx2G'],
    pipeIO: true,
    spawnOpts: {},
    rcon: {
      port: '25575',
      password: '0000',
      buffer: 50,
    },
  },
};

class ScriptServer extends EventsEmitter {
  constructor(config = {}) {
    super();
    this.config = defaultsDeep({}, config, defaultConfig);
    this.modules = [];
    console.dir(this.config)

    // RCON
    this.rcon = new Rcon(this.config.core.rcon);
    this.on('console', (l) => {
      if (l.match(/\[RCON Listener #1\/INFO\]: RCON running/i)) this.rcon.connect();
    });

    // Pipe
    process.stdin.on('data', (d) => {
      if (this.config.core.pipeIO && this.spawn) this.spawn.stdin.write(d);
    });
    process.on('exit', () => this.stop());
    process.on('close', () => this.stop());
  }

  start() {
    if (this.spawn) throw new Error('Server already started');

    const args = this.config.core.args.concat('-jar', this.config.core.jar, 'nogui');
  
    this.spawn = spawn('java', args, this.config.core.spawnOpts);
  
    this.spawn.stdout.on('data', (d) => {
      // Pipe
      if (this.config.core.pipeIO) process.stdout.write(d);
      // Emit console
      d.toString().split('\n').forEach((l) => {
        if (l) this.emit('console', l);
      });
    });

    return this;
  }

  stop() {
    if (this.spawn) {
      this.spawn.kill();
      this.spawn = null;
    }

    return this;
  }

  use(module) {
    if (typeof module !== 'function') throw new Error('A module must be a function');

    if (this.modules.filter(m => m === module).length === 0) {
      this.modules.push(module);
      module.call(this);
    }

    return this;
  }

  sendRcon(command) {
    if(this.spawn){
      return new Promise((resolve) => {
        this.rcon.exec(command, result => resolve(result));
      });
    }
  }

  send(command){
    if(this.spawn){
      this.spawn.stdin.write(command + "\n")
    }
  }
}

module.exports = ScriptServer;