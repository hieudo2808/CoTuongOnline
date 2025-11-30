#!/usr/bin/env node

/**
 * WebSocket to TCP Bridge
 * Bridges WebSocket connections from browser to raw TCP C server
 */

const WebSocket = require('ws');
const net = require('net');

const WS_PORT = 8081;  // WebSocket port for browser
const TCP_HOST = '127.0.0.1';
const TCP_PORT = 8080; // C server port

const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`🌐 WebSocket Bridge started on port ${WS_PORT}`);
console.log(`📡 Forwarding to TCP server at ${TCP_HOST}:${TCP_PORT}`);

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`[WS] New client connected from ${clientIP}`);

    // Create TCP connection to C server
    const tcpClient = new net.Socket();
    
    tcpClient.connect(TCP_PORT, TCP_HOST, () => {
        console.log(`[TCP] Connected to C server`);
    });

    // Forward WebSocket messages to TCP
    ws.on('message', (message) => {
        try {
            const data = message.toString();
            console.log(`[WS→TCP] ${data.substring(0, 100)}...`);
            tcpClient.write(data + '\n');
        } catch (error) {
            console.error('[WS→TCP] Error:', error);
        }
    });

    // Forward TCP messages to WebSocket
    tcpClient.on('data', (data) => {
        try {
            const response = data.toString();
            console.log(`[TCP→WS] ${response.substring(0, 100)}...`);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(response);
            }
        } catch (error) {
            console.error('[TCP→WS] Error:', error);
        }
    });

    // Handle disconnections
    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        tcpClient.end();
    });

    tcpClient.on('close', () => {
        console.log('[TCP] Connection closed');
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    tcpClient.on('error', (error) => {
        console.error('[TCP] Error:', error.message);
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    ws.on('error', (error) => {
        console.error('[WS] Error:', error.message);
        tcpClient.end();
    });
});

wss.on('error', (error) => {
    console.error('[Server] Error:', error);
});

console.log('\n✅ Bridge ready! Connect browser to: ws://localhost:8081\n');
