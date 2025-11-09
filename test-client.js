/**
 * WebSocket Test Client - Submit 5 Orders Simultaneously
 * Run: node test-client.js
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');

// Test orders with different amounts and tokens
const testOrders = [
  { tokenIn: 'SOL', tokenOut: 'USDC', amount: 1.5, slippage: 0.01 },
  { tokenIn: 'SOL', tokenOut: 'USDC', amount: 2.0, slippage: 0.01 },
  { tokenIn: 'USDC', tokenOut: 'SOL', amount: 100, slippage: 0.01 },
  { tokenIn: 'SOL', tokenOut: 'USDC', amount: 0.5, slippage: 0.01 },
  { tokenIn: 'USDC', tokenOut: 'SOL', amount: 50, slippage: 0.01 },
];

console.log('========================================');
console.log('Submitting 5 orders simultaneously...');
console.log('========================================\n');

// Track active connections
let activeConnections = 0;
let completedOrders = 0;

// Configuration - switch between local and production
const USE_PRODUCTION = true; // Set to true for Railway deployment

const config = USE_PRODUCTION 
  ? { 
      hostname: 'web-production-12929.up.railway.app',
      port: 443,
      protocol: 'https:',
      wsProtocol: 'wss:'
    }
  : {
      hostname: '127.0.0.1',
      port: 3000,
      protocol: 'http:',
      wsProtocol: 'ws:'
    };

console.log(`Connecting to: ${config.protocol}//${config.hostname}:${config.port}\n`);

// Function to submit order and connect to WebSocket
function submitOrder(orderData, orderIndex) {
  const data = JSON.stringify(orderData);
  
  const postOptions = {
    hostname: config.hostname,
    port: config.port,
    path: '/api/orders/execute',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const httpModule = USE_PRODUCTION ? https : http;
  const req = httpModule.request(postOptions, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      if (res.statusCode !== 201) {
        console.error(`[Order ${orderIndex}] HTTP Error ${res.statusCode}:`, responseData);
        return;
      }

      const response = JSON.parse(responseData);
      const shortId = response.orderId.substring(0, 8);
      console.log(`[Order ${orderIndex}] Submitted: ${orderData.amount} ${orderData.tokenIn} -> ${orderData.tokenOut} (ID: ${shortId}...)`);

      // Connect to WebSocket for status updates
      activeConnections++;
      const wsUrl = `${config.wsProtocol}//${config.hostname}${config.port === 443 || config.port === 80 ? '' : ':' + config.port}${response.websocketUrl}`;
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        console.log(`[Order ${orderIndex}] WebSocket connected\n`);
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'connected':
            console.log(`[Order ${orderIndex}] Status: ${message.currentStatus}`);
            break;
          
          case 'status_update':
            console.log(`[Order ${orderIndex}] Status: ${message.status.toUpperCase()}`);
            
            if (message.data) {
              if (message.data.selectedDex) {
                console.log(`[Order ${orderIndex}] DEX Selection: ${message.data.selectedDex}`);
                console.log(`[Order ${orderIndex}]   Raydium: $${message.data.raydiumPrice?.toFixed(2)} | Meteora: $${message.data.meteoraPrice?.toFixed(2)}`);
                console.log(`[Order ${orderIndex}]   Reason: ${message.data.reason}\n`);
              }
              
              if (message.data.txHash) {
                console.log(`[Order ${orderIndex}] TX: ${message.data.txHash.substring(0, 16)}...`);
                console.log(`[Order ${orderIndex}] Price: $${message.data.executedPrice?.toFixed(2)}\n`);
              }
            }
            
            // Close connection on final status
            if (message.status === 'confirmed' || message.status === 'failed') {
              console.log(`[Order ${orderIndex}] ${message.status === 'confirmed' ? 'COMPLETED' : 'FAILED'}!\n`);
              completedOrders++;
              
              setTimeout(() => {
                ws.close();
                activeConnections--;
                
                // Exit when all orders complete
                if (completedOrders === testOrders.length) {
                  console.log('========================================');
                  console.log(`All ${testOrders.length} orders completed!`);
                  console.log('========================================\n');
                  process.exit(0);
                }
              }, 500);
            }
            break;
            
          case 'error':
            console.error(`[Order ${orderIndex}] Error: ${message.error}\n`);
            completedOrders++;
            ws.close();
            activeConnections--;
            break;
        }
      });

      ws.on('error', (error) => {
        console.error(`[Order ${orderIndex}] WebSocket error: ${error.message}`);
      });
    });
  });

  req.on('error', (error) => {
    console.error(`[Order ${orderIndex}] HTTP error: ${error.message}`);
  });

  req.write(data);
  req.end();
}

// Submit all orders simultaneously
testOrders.forEach((order, index) => {
  submitOrder(order, index + 1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nInterrupted by user');
  process.exit(0);
});
