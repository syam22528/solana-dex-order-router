/**
 * WebSocket Test Client - HTTP → WebSocket Pattern
 * Run: node test-client.js
 */

const http = require('http');
const WebSocket = require('ws');

// Step 1: Submit order via POST
const orderData = JSON.stringify({
  tokenIn: 'SOL',
  tokenOut: 'USDC',
  amount: 1.5,
  slippage: 0.01  // 1%
});

console.log('📤 Submitting order via HTTP POST...\n');

const postOptions = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/orders/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(orderData)
  }
};

const req = http.request(postOptions, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 201) {
      console.error(`❌ HTTP Error ${res.statusCode}:`, responseData);
      process.exit(1);
    }

    const response = JSON.parse(responseData);
    console.log('✅ Order submitted successfully!');
    console.log(`   Order ID: ${response.orderId}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   WebSocket URL: ${response.websocketUrl}\n`);

    // Step 2: Connect to WebSocket for status updates
    console.log('� Connecting to WebSocket for real-time updates...\n');
    
    const ws = new WebSocket(`ws://127.0.0.1:3000${response.websocketUrl}`);

    ws.on('open', () => {
      console.log('✅ WebSocket connected\n');
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      const timestamp = new Date(message.timestamp).toLocaleTimeString();
      
      switch (message.type) {
        case 'connected':
          console.log(`🔗 [${timestamp}] Connected to order stream`);
          console.log(`   Current Status: ${message.currentStatus}`);
          break;
        
        case 'status_update':
          console.log(`\n📊 [${timestamp}] Status: ${message.status.toUpperCase()}`);
          
          if (message.data) {
            if (message.data.selectedDex) {
              console.log(`   Selected DEX: ${message.data.selectedDex}`);
              console.log(`   Raydium: $${message.data.raydiumPrice?.toFixed(2)}`);
              console.log(`   Meteora: $${message.data.meteoraPrice?.toFixed(2)}`);
              console.log(`   Reason: ${message.data.reason}`);
            }
            
            if (message.data.txHash) {
              console.log(`   TX Hash: ${message.data.txHash}`);
              console.log(`   Executed Price: $${message.data.executedPrice?.toFixed(2)}`);
              console.log(`   Actual Output: ${message.data.actualOutput?.toFixed(2)} USDC`);
            }
            
            if (message.data.error) {
              console.log(`   Error: ${message.data.error}`);
              console.log(`   Retry Count: ${message.data.retryCount}`);
            }
          }
          
          // Close connection on final status
          if (message.status === 'confirmed' || message.status === 'failed') {
            console.log(`\n${message.status === 'confirmed' ? '🎉' : '❌'} Order ${message.status}!`);
            console.log('\nClosing connection...');
            setTimeout(() => {
              ws.close();
              process.exit(0);
            }, 1000);
          }
          break;
          
        case 'error':
          console.error(`\n❌ Error: ${message.error}`);
          ws.close();
          process.exit(1);
          break;
      }
    });

    ws.on('close', () => {
      console.log('\n🔌 WebSocket closed');
    });

    ws.on('error', (error) => {
      console.error('\n❌ WebSocket error:', error.message);
      process.exit(1);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\n⚠️  Interrupted by user');
      ws.close();
      process.exit(0);
    });
  });
});

req.on('error', (error) => {
  console.error('❌ HTTP Request error:', error.message);
  process.exit(1);
});

req.write(orderData);
req.end();
