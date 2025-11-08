#!/usr/bin/env node

/**
 * Pre-Submission Verification Script
 * Checks that all deliverables are complete and ready
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Eterna Placement Test Deliverables...\n');

const checks = [];
let passed = 0;
let failed = 0;

// Helper function to check if file exists
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  checks.push({
    name: description,
    status: exists ? '✅' : '❌',
    passed: exists
  });
  if (exists) passed++;
  else failed++;
  return exists;
}

// Helper function to check file content
function checkFileContent(filePath, description, minLines = 0) {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    checks.push({
      name: description,
      status: '❌',
      passed: false,
      detail: 'File not found'
    });
    failed++;
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  const hasSufficientContent = lines >= minLines;
  
  checks.push({
    name: description,
    status: hasSufficientContent ? '✅' : '⚠️',
    passed: hasSufficientContent,
    detail: `${lines} lines`
  });
  
  if (hasSufficientContent) passed++;
  else failed++;
  
  return hasSufficientContent;
}

console.log('📁 Checking Source Files...');
checkFile('src/server.ts', 'Main server file');
checkFile('src/config/index.ts', 'Configuration');
checkFile('src/database/index.ts', 'Database client');
checkFile('src/database/schema.ts', 'Database schema');
checkFile('src/queue/orderQueue.ts', 'Queue processor');
checkFile('src/routes/orderRoutes.ts', 'API routes');
checkFile('src/services/MockDexRouter.ts', 'DEX router service');
checkFile('src/types/index.ts', 'Type definitions');

console.log('\n🧪 Checking Test Files...');
checkFile('src/services/MockDexRouter.test.ts', 'DEX router tests');
checkFile('src/queue/orderQueue.test.ts', 'Queue tests');
checkFile('jest.config.js', 'Jest configuration');

console.log('\n📚 Checking Documentation...');
checkFileContent('README.md', 'Main README', 800);
checkFileContent('QUICKSTART.md', 'Quick start guide', 50);
checkFileContent('PROJECT_SUMMARY.md', 'Project summary', 50);
checkFileContent('IMPLEMENTATION_COMPLETE.md', 'Implementation checklist', 30);
checkFileContent('DEPLOYMENT.md', 'Deployment guide', 200);
checkFileContent('FINAL_DELIVERABLES.md', 'Final deliverables summary', 200);

console.log('\n🔧 Checking Configuration Files...');
checkFile('package.json', 'Package configuration');
checkFile('tsconfig.json', 'TypeScript configuration');
checkFile('docker-compose.yml', 'Docker Compose');
checkFile('.env.example', 'Environment template');

console.log('\n🛠️ Checking Tools...');
checkFile('test-client.js', 'WebSocket test client');
checkFile('websocket-client.html', 'HTML test client');
checkFile('Solana_DEX_Router_Postman_Collection.json', 'Postman collection');

console.log('\n📦 Checking Dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = [
  'fastify',
  '@fastify/websocket',
  'bullmq',
  'ioredis',
  'pg',
  'dotenv',
  'typescript'
];

let depsOk = true;
requiredDeps.forEach(dep => {
  const installed = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
  checks.push({
    name: `Dependency: ${dep}`,
    status: installed ? '✅' : '❌',
    passed: installed,
    detail: installed || 'Not installed'
  });
  if (installed) passed++;
  else { failed++; depsOk = false; }
});

console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION RESULTS');
console.log('='.repeat(60));

// Print all checks
checks.forEach(check => {
  const detail = check.detail ? ` (${check.detail})` : '';
  console.log(`${check.status} ${check.name}${detail}`);
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n🎉 ALL CHECKS PASSED! Ready for submission! 🚀\n');
  console.log('Next steps:');
  console.log('1. Run tests: npm test');
  console.log('2. Start server: npm run docker:up && npm run dev');
  console.log('3. Test order: node test-client.js');
  console.log('4. Record demo video');
  console.log('5. Deploy to Railway/Render');
  console.log('6. Submit deliverables\n');
  process.exit(0);
} else {
  console.log('\n⚠️ Some checks failed. Please review and fix before submission.\n');
  process.exit(1);
}
