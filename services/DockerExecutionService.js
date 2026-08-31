// DockerExecutionService.js
// Manages Docker containers for interactive code execution via SSH to Piston server

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');

class DockerExecutionService extends EventEmitter {
  constructor() {
    super();
    this.activeContainers = new Map(); // sessionId -> container info
    this.containerTimeout = parseInt(process.env.CONTAINER_TIMEOUT) || 30000; // 30 seconds default
    this.maxOutputSize = parseInt(process.env.MAX_OUTPUT_SIZE) || 1024 * 1024; // 1MB max output
    
    // SSH Configuration for Piston Server
    this.pistonHost = process.env.PISTON_SSH_HOST || process.env.PISTON_URL || 'localhost';
    this.pistonSshUser = process.env.PISTON_SSH_USER || 'ubuntu';
    this.pistonSshPort = process.env.PISTON_SSH_PORT || '22';
    this.pistonSshKey = process.env.PISTON_SSH_KEY || ''; // Path to SSH private key
    
    console.log(`[Docker] Configured to use Piston server at ${this.pistonSshUser}@${this.pistonHost}`);
  }

  /**
   * Language to Docker image mapping (standard Docker Hub images)
   */
  getDockerImage(language) {
    const imageMap = {
      'python': 'python:3.10-slim',
      'javascript': 'node:18-slim',
      'node': 'node:18-slim',
      'java': 'eclipse-temurin:17-jdk',
      'c': 'gcc:12',
      'cpp': 'gcc:12',
      'c++': 'gcc:12',
      'typescript': 'node:18-slim',
      'go': 'golang:1.21-alpine',
      'rust': 'rust:1.70-slim',
      'ruby': 'ruby:3.2-slim',
      'php': 'php:8.2-cli',
      'csharp': 'mono:6.12',
    };
    return imageMap[language.toLowerCase()] || 'python:3.10-slim';
  }

  /**
   * Get file extension and run command for language
   */
  getLanguageConfig(language) {
    const configs = {
      'python': { 
        ext: '.py', 
        compile: null, 
        run: 'python {file}',
        fileName: 'main.py'
      },
      'javascript': { 
        ext: '.js', 
        compile: null, 
        run: 'node {file}',
        fileName: 'main.js'
      },
      'node': { 
        ext: '.js', 
        compile: null, 
        run: 'node {file}',
        fileName: 'main.js'
      },
      'java': { 
        ext: '.java', 
        compile: 'javac {file}', 
        run: 'java Main',
        fileName: 'Main.java'
      },
      'c': { 
        ext: '.c', 
        compile: 'gcc -o main {file}', 
        run: './main',
        fileName: 'main.c'
      },
      'cpp': { 
        ext: '.cpp', 
        compile: 'g++ -o main {file}', 
        run: './main',
        fileName: 'main.cpp'
      },
      'c++': { 
        ext: '.cpp', 
        compile: 'g++ -o main {file}', 
        run: './main',
        fileName: 'main.cpp'
      },
      'typescript': { 
        ext: '.ts', 
        compile: 'npx tsc {file}', 
        run: 'node {fileNoExt}.js',
        fileName: 'main.ts'
      },
      'go': { 
        ext: '.go', 
        compile: null, 
        run: 'go run {file}',
        fileName: 'main.go'
      },
      'rust': { 
        ext: '.rs', 
        compile: 'rustc -o main {file}', 
        run: './main',
        fileName: 'main.rs'
      },
      'ruby': { 
        ext: '.rb', 
        compile: null, 
        run: 'ruby {file}',
        fileName: 'main.rb'
      },
      'php': { 
        ext: '.php', 
        compile: null, 
        run: 'php {file}',
        fileName: 'main.php'
      },
      'csharp': { 
        ext: '.cs', 
        compile: 'mcs -out:main.exe {file}', 
        run: 'mono main.exe',
        fileName: 'Main.cs'
      },
    };
    return configs[language.toLowerCase()] || configs['python'];
  }

  /**
   * Create and start a Docker container for code execution
   * @param {string} sessionId - Unique session identifier
   * @param {string} language - Programming language
   * @param {string} code - Source code to execute
   * @returns {Promise<Object>} Container info
   */
  async createContainer(sessionId, language, code) {
    const config = this.getLanguageConfig(language);
    const containerName = `code-exec-${sessionId}-${Date.now()}`;
    
    // Store container info
    const containerInfo = {
      sessionId,
      containerName,
      language,
      config,
      process: null,
      outputSize: 0,
      startTime: Date.now(),
      isKilled: false,
      timeoutId: null,
      outputBuffer: '',
      lastOutputTime: Date.now(),
      infiniteLoopDetected: false
    };

    this.activeContainers.set(sessionId, containerInfo);

    return containerInfo;
  }

  /**
   * Build SSH arguments for connecting to Piston server
   */
  buildSshArgs() {
    const sshArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-p', this.pistonSshPort,
    ];
    
    // Add SSH key if provided
    if (this.pistonSshKey) {
      sshArgs.push('-i', this.pistonSshKey);
    }
    
    sshArgs.push(`${this.pistonSshUser}@${this.pistonHost}`);
    
    return sshArgs;
  }

  /**
   * Execute code in a Docker container on remote Piston server with interactive I/O
   * @param {string} sessionId - Session ID
   * @param {string} language - Programming language
   * @param {string} code - Source code
   * @param {Function} onOutput - Callback for stdout/stderr
   * @param {Function} onExit - Callback when process exits
   * @param {Function} onError - Callback for errors
   */
  async executeInteractive(sessionId, language, code, onOutput, onExit, onError) {
    try {
      const containerInfo = await this.createContainer(sessionId, language, code);
      const config = containerInfo.config;
      
      // Escape code for shell - handle special characters for SSH + Docker
      // Double escape: once for local shell, once for remote shell
      const escapedCode = code
        .replace(/\\/g, '\\\\\\\\')     // Backslash
        .replace(/'/g, "'\"'\"'")       // Single quotes
        .replace(/"/g, '\\"')           // Double quotes
        .replace(/\$/g, '\\$')          // Dollar sign
        .replace(/`/g, '\\`')           // Backticks
        .replace(/!/g, '\\!');          // Exclamation mark

      // Build the Docker command to run on remote server
      const dockerCommand = [
        'docker', 'run',
        '--rm',                           // Remove container after exit
        '-i',                             // Interactive mode (keep stdin open)
        '--name', containerInfo.containerName,
        '--network', 'none',              // No network access for security
        '--memory', '256m',               // Memory limit
        '--memory-swap', '256m',          // No swap
        '--cpus', '0.5',                  // CPU limit
        '--pids-limit', '64',             // Process limit
        '-w', '/tmp/code',                // Working directory
        this.getDockerImage(language),
        '/bin/sh', '-c',
        `"${this.buildExecutionScript(config, escapedCode)}"`
      ].join(' ');

      // Build SSH command
      const sshArgs = this.buildSshArgs();
      sshArgs.push(dockerCommand);

      console.log(`[Docker] Starting container on Piston server for session ${sessionId}`);
      console.log(`[Docker] SSH to: ${this.pistonSshUser}@${this.pistonHost}:${this.pistonSshPort}`);
      console.log(`[Docker] Container: ${containerInfo.containerName}`);

      // Spawn SSH process that will run docker on remote server
      const sshProcess = spawn('ssh', sshArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      containerInfo.process = sshProcess;

      // Set up timeout for infinite loop protection
      containerInfo.timeoutId = setTimeout(() => {
        this.handleTimeout(sessionId, onOutput, onExit);
      }, this.containerTimeout);

      // Set up infinite loop detection (rapid output detection)
      let outputCount = 0;
      let outputCheckInterval = setInterval(() => {
        if (outputCount > 1000) { // More than 1000 outputs per second
          containerInfo.infiniteLoopDetected = true;
          this.killContainer(sessionId);
          onOutput('\n\n⚠️ [INFINITE LOOP DETECTED] Execution terminated - too much output generated.\n');
          clearInterval(outputCheckInterval);
        }
        outputCount = 0;
      }, 1000);

      // Handle stdout
      sshProcess.stdout.on('data', (data) => {
        outputCount++;
        const output = data.toString();
        containerInfo.outputSize += output.length;
        containerInfo.lastOutputTime = Date.now();
        
        // Check output size limit
        if (containerInfo.outputSize > this.maxOutputSize) {
          this.killContainer(sessionId);
          onOutput('\n\n⚠️ [OUTPUT LIMIT EXCEEDED] Execution terminated.\n');
          return;
        }

        onOutput(output);
      });

      // Handle stderr
      sshProcess.stderr.on('data', (data) => {
        outputCount++;
        const output = data.toString();
        containerInfo.outputSize += output.length;
        
        // Filter out SSH and Docker-specific messages that aren't relevant to user
        if (!output.includes('Warning: Permanently added') && 
            !output.includes('OCI runtime') && 
            !output.includes('container') &&
            !output.includes('Connection to')) {
          onOutput(output);
        }
      });

      // Handle process exit
      sshProcess.on('close', (exitCode) => {
        console.log(`[Docker] SSH session for ${containerInfo.containerName} exited with code ${exitCode}`);
        clearTimeout(containerInfo.timeoutId);
        clearInterval(outputCheckInterval);
        this.cleanup(sessionId);
        
        if (!containerInfo.isKilled) {
          onExit(exitCode);
        }
      });

      // Handle errors
      sshProcess.on('error', (err) => {
        console.error(`[Docker] SSH process error for session ${sessionId}:`, err);
        clearTimeout(containerInfo.timeoutId);
        clearInterval(outputCheckInterval);
        this.cleanup(sessionId);
        onError(err);
      });

      return containerInfo;

    } catch (error) {
      console.error(`[Docker] Failed to create container for session ${sessionId}:`, error);
      this.cleanup(sessionId);
      onError(error);
    }
  }

  /**
   * Build the execution script for the container
   */
  buildExecutionScript(config, escapedCode) {
    const fileName = config.fileName;
    const fileNoExt = fileName.replace(/\.[^/.]+$/, '');
    
    let script = `mkdir -p /tmp/code && cd /tmp/code && echo '${escapedCode}' > ${fileName}`;
    
    // Add compile step if needed
    if (config.compile) {
      const compileCmd = config.compile.replace('{file}', fileName);
      script += ` && ${compileCmd}`;
    }
    
    // Add run command
    let runCmd = config.run
      .replace('{file}', fileName)
      .replace('{fileNoExt}', fileNoExt);
    
    script += ` && ${runCmd}`;
    
    return script;
  }

  /**
   * Send input to the running container
   * @param {string} sessionId - Session ID
   * @param {string} input - Input to send
   */
  sendInput(sessionId, input) {
    const containerInfo = this.activeContainers.get(sessionId);
    
    if (!containerInfo || !containerInfo.process || containerInfo.isKilled) {
      console.warn(`[Docker] Cannot send input - no active container for session ${sessionId}`);
      return false;
    }

    try {
      // Reset timeout when user provides input
      if (containerInfo.timeoutId) {
        clearTimeout(containerInfo.timeoutId);
        containerInfo.timeoutId = setTimeout(() => {
          this.handleTimeout(sessionId, () => {}, () => {});
        }, this.containerTimeout);
      }

      containerInfo.process.stdin.write(input + '\n');
      return true;
    } catch (error) {
      console.error(`[Docker] Failed to send input for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Handle execution timeout
   */
  handleTimeout(sessionId, onOutput, onExit) {
    const containerInfo = this.activeContainers.get(sessionId);
    if (!containerInfo || containerInfo.isKilled) return;

    console.log(`[Docker] Timeout reached for session ${sessionId}`);
    
    onOutput('\n\n⏱️ [TIMEOUT] Execution exceeded time limit (30 seconds). Process terminated.\nThis could be due to:\n- Infinite loop in your code\n- Program waiting for input that was never provided\n- Long-running computation\n');
    
    this.killContainer(sessionId);
    onExit(124); // Standard timeout exit code
  }

  /**
   * Kill a running container on the remote Piston server
   * @param {string} sessionId - Session ID
   */
  async killContainer(sessionId) {
    const containerInfo = this.activeContainers.get(sessionId);
    
    if (!containerInfo) {
      return;
    }

    containerInfo.isKilled = true;

    // Clear timeout
    if (containerInfo.timeoutId) {
      clearTimeout(containerInfo.timeoutId);
    }

    // Kill the local SSH process
    if (containerInfo.process) {
      try {
        containerInfo.process.kill('SIGKILL');
      } catch (err) {
        console.error(`[Docker] Error killing SSH process for session ${sessionId}:`, err);
      }
    }

    // Force remove container on remote server via SSH
    try {
      const sshArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        '-o', 'ConnectTimeout=5',
        '-p', this.pistonSshPort,
      ];
      
      if (this.pistonSshKey) {
        sshArgs.push('-i', this.pistonSshKey);
      }
      
      sshArgs.push(`${this.pistonSshUser}@${this.pistonHost}`);
      sshArgs.push(`docker rm -f ${containerInfo.containerName} 2>/dev/null || true`);

      const killProcess = spawn('ssh', sshArgs, {
        stdio: 'ignore'
      });
      
      // Don't wait for this, just fire and forget
      killProcess.on('error', () => {});
    } catch (err) {
      // Ignore errors - container might already be removed
    }

    console.log(`[Docker] Killed container ${containerInfo.containerName} for session ${sessionId}`);
    this.cleanup(sessionId);
  }

  /**
   * Clean up resources for a session
   */
  cleanup(sessionId) {
    const containerInfo = this.activeContainers.get(sessionId);
    
    if (containerInfo) {
      if (containerInfo.timeoutId) {
        clearTimeout(containerInfo.timeoutId);
      }
      this.activeContainers.delete(sessionId);
    }
    
    console.log(`[Docker] Cleaned up session ${sessionId}. Active containers: ${this.activeContainers.size}`);
  }

  /**
   * Get status of active containers
   */
  getStatus() {
    const status = {
      activeContainers: this.activeContainers.size,
      containers: []
    };

    for (const [sessionId, info] of this.activeContainers) {
      status.containers.push({
        sessionId,
        containerName: info.containerName,
        language: info.language,
        runningTime: Date.now() - info.startTime,
        outputSize: info.outputSize
      });
    }

    return status;
  }

  /**
   * Kill all active containers (for graceful shutdown)
   */
  async killAll() {
    console.log(`[Docker] Killing all ${this.activeContainers.size} active containers...`);
    
    const promises = [];
    for (const sessionId of this.activeContainers.keys()) {
      promises.push(this.killContainer(sessionId));
    }
    
    await Promise.all(promises);
    console.log('[Docker] All containers killed');
  }
}

// Export singleton instance
module.exports = new DockerExecutionService();

