// WebSocketServer.js
// WebSocket server for interactive code execution

const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const DockerExecutionService = require('./DockerExecutionService');

class CodeExecutionWebSocketServer {
  constructor() {
    this.wss = null;
    this.sessions = new Map(); // ws -> sessionId
    this.connections = new Map(); // sessionId -> ws
  }

  /**
   * Initialize WebSocket server
   * @param {http.Server} server - HTTP server instance
   */
  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/code-execute'
    });

    console.log('[WebSocket] Server initialized on path /ws/code-execute');

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const sessionId = uuidv4();
    this.sessions.set(ws, sessionId);
    this.connections.set(sessionId, ws);

    console.log(`[WebSocket] New connection: ${sessionId}`);

    // Send session ID to client
    this.send(ws, {
      type: 'connected',
      sessionId
    });

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleMessage(ws, sessionId, data);
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnect(ws, sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WebSocket] Connection error for ${sessionId}:`, error);
      this.handleDisconnect(ws, sessionId);
    });

    // Heartbeat to keep connection alive
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(ws, sessionId, data) {
    try {
      const message = JSON.parse(data.toString());
      
      console.log(`[WebSocket] Message from ${sessionId}:`, message.type);

      switch (message.type) {
        case 'execute':
          await this.handleExecute(ws, sessionId, message);
          break;
        
        case 'input':
          this.handleInput(sessionId, message);
          break;
        
        case 'kill':
          await this.handleKill(sessionId);
          break;
        
        case 'ping':
          this.send(ws, { type: 'pong' });
          break;
        
        default:
          this.send(ws, { 
            type: 'error', 
            message: `Unknown message type: ${message.type}` 
          });
      }

    } catch (error) {
      console.error(`[WebSocket] Error handling message from ${sessionId}:`, error);
      this.send(ws, { 
        type: 'error', 
        message: 'Failed to process message' 
      });
    }
  }

  /**
   * Handle code execution request
   */
  async handleExecute(ws, sessionId, message) {
    const { language, code } = message;

    if (!language || !code) {
      this.send(ws, {
        type: 'error',
        message: 'Language and code are required'
      });
      return;
    }

    // Check if there's already an execution running for this session
    if (DockerExecutionService.activeContainers.has(sessionId)) {
      await DockerExecutionService.killContainer(sessionId);
    }

    // Notify client that execution is starting
    this.send(ws, {
      type: 'status',
      status: 'starting',
      message: `Starting ${language} execution...`
    });

    // Start execution
    await DockerExecutionService.executeInteractive(
      sessionId,
      language,
      code,
      // onOutput callback
      (output) => {
        if (ws.readyState === ws.OPEN) {
          this.send(ws, {
            type: 'output',
            data: output
          });
        }
      },
      // onExit callback
      (exitCode) => {
        if (ws.readyState === ws.OPEN) {
          this.send(ws, {
            type: 'exit',
            exitCode,
            message: exitCode === 0 ? 'Program completed successfully' : `Program exited with code ${exitCode}`
          });
        }
      },
      // onError callback
      (error) => {
        if (ws.readyState === ws.OPEN) {
          this.send(ws, {
            type: 'error',
            message: error.message || 'Execution failed'
          });
        }
      }
    );

    // Notify client that execution has started
    this.send(ws, {
      type: 'status',
      status: 'running',
      message: 'Code is now running'
    });
  }

  /**
   * Handle user input
   */
  handleInput(sessionId, message) {
    const { input } = message;
    
    const success = DockerExecutionService.sendInput(sessionId, input || '');
    
    if (!success) {
      const ws = this.connections.get(sessionId);
      if (ws) {
        this.send(ws, {
          type: 'error',
          message: 'Failed to send input - no active execution'
        });
      }
    }
  }

  /**
   * Handle kill request
   */
  async handleKill(sessionId) {
    await DockerExecutionService.killContainer(sessionId);
    
    const ws = this.connections.get(sessionId);
    if (ws && ws.readyState === ws.OPEN) {
      this.send(ws, {
        type: 'status',
        status: 'killed',
        message: 'Execution terminated by user'
      });
    }
  }

  /**
   * Handle disconnection
   */
  async handleDisconnect(ws, sessionId) {
    console.log(`[WebSocket] Disconnection: ${sessionId}`);
    
    // Kill any running containers for this session
    await DockerExecutionService.killContainer(sessionId);
    
    // Clean up session
    this.sessions.delete(ws);
    this.connections.delete(sessionId);
  }

  /**
   * Send message to client
   */
  send(ws, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          const sessionId = this.sessions.get(ws);
          console.log(`[WebSocket] Terminating inactive connection: ${sessionId}`);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[WebSocket] Shutting down...');
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Kill all Docker containers
    await DockerExecutionService.killAll();

    // Close all WebSocket connections
    this.wss.clients.forEach((ws) => {
      this.send(ws, {
        type: 'error',
        message: 'Server shutting down'
      });
      ws.close();
    });

    console.log('[WebSocket] Shutdown complete');
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      connections: this.sessions.size,
      docker: DockerExecutionService.getStatus()
    };
  }
}

// Export singleton instance
module.exports = new CodeExecutionWebSocketServer();

