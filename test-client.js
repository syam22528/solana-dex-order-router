/**
 * Simple WebSocket Client for Testing
 * Run: node test-client.js
 */

const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:3000/api/orders/execute');

ws.on('open', () => {
  console.log('✅ Connected to Order Execution Engine\n');
  
  // Submit a test order
  const order = {
    type: 'submit_order',
    order: {
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 1.5,
      slippage: 0.01  // 1%
    }
  };
  
  console.log('📤 Submitting order:', JSON.stringify(order.order, null, 2));
  ws.send(JSON.stringify(order));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  const timestamp = new Date(message.timestamp).toLocaleTimeString();
  
  switch (message.type) {
    case 'order_accepted':
      console.log(`\n✅ [${timestamp}] Order Accepted`);
      console.log(`   Order ID: ${message.orderId}`);
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
  console.log('\n🔌 Connection closed');
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
