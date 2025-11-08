# Deployment Guide - Solana DEX Order Router

## 🚀 Deployment Options

### Option 1: Railway (Recommended)

**Step 1: Install Railway CLI**
```bash
npm install -g @railway/cli
```

**Step 2: Login to Railway**
```bash
railway login
```

**Step 3: Initialize Project**
```bash
railway init
```

**Step 4: Add Database Services**
```bash
railway add --plugin postgres
railway add --plugin redis
```

**Step 5: Configure Environment Variables**

Railway will auto-configure DATABASE_URL and REDIS_URL. Add these additional variables:

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
```

**Step 6: Deploy**
```bash
railway up
```

**Step 7: Access Your Application**
```bash
railway open
```

Your application will be available at: `https://your-app.railway.app`

---

### Option 2: Render

**Step 1: Create a New Web Service**
1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository

**Step 2: Configure Build Settings**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Node

**Step 3: Add PostgreSQL Database**
1. Click "New" → "PostgreSQL"
2. Name it (e.g., `dex-router-db`)
3. Copy the Internal Database URL

**Step 4: Add Redis Instance**
1. Click "New" → "Redis"
2. Name it (e.g., `dex-router-redis`)
3. Copy the Internal Redis URL

**Step 5: Set Environment Variables**

In your Web Service → Environment:
```
NODE_ENV=production
PORT=10000
DATABASE_URL=<your-postgres-internal-url>
REDIS_URL=<your-redis-internal-url>
QUEUE_CONCURRENCY=10
QUEUE_MAX_RETRIES=3
```

**Step 6: Deploy**
- Click "Create Web Service"
- Wait for deployment to complete
- Access at: `https://your-app.onrender.com`

---

### Option 3: Heroku

**Step 1: Install Heroku CLI**
```bash
# On Windows with npm
npm install -g heroku
```

**Step 2: Login**
```bash
heroku login
```

**Step 3: Create App**
```bash
heroku create your-dex-router
```

**Step 4: Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:mini
```

**Step 5: Add Redis**
```bash
heroku addons:create heroku-redis:mini
```

**Step 6: Set Environment Variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set QUEUE_CONCURRENCY=10
heroku config:set QUEUE_MAX_RETRIES=3
```

**Step 7: Deploy**
```bash
git push heroku main
```

**Step 8: Open Application**
```bash
heroku open
```

---

### Option 4: Docker + Cloud (AWS/GCP/Azure)

**Build Docker Image**
```bash
docker build -t dex-router:latest .
```

**Push to Container Registry**
```bash
# AWS ECR example
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker tag dex-router:latest your-account.dkr.ecr.us-east-1.amazonaws.com/dex-router:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/dex-router:latest
```

**Deploy to ECS/Cloud Run/Container Apps**
- AWS: Use ECS Fargate
- GCP: Use Cloud Run
- Azure: Use Container Apps

---

## 📋 Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Redis connection tested
- [ ] WebSocket endpoint accessible
- [ ] Health check endpoint responding
- [ ] Production build tested (`npm run build && npm start`)

---

## 🔒 Production Configuration

**Recommended Environment Variables:**

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://default:pass@host:6379

# Queue Settings
QUEUE_CONCURRENCY=10
QUEUE_MAX_RETRIES=3

# DEX Settings
MOCK_DEX_ENABLED=false  # Set to false for real DEX integration
BASE_PRICE=50000        # Only used if MOCK_DEX_ENABLED=true
```

---

## 📊 Post-Deployment Verification

**1. Check Health Endpoint**
```bash
curl https://your-app.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T04:47:00.000Z"
}
```

**2. Test WebSocket Connection**
```javascript
// Using browser console or Node.js
const ws = new WebSocket('wss://your-app.com/api/orders/execute');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

**3. Check Queue Metrics**
```bash
curl https://your-app.com/api/queue/metrics
```

**4. Submit Test Order**
```bash
# First, establish WebSocket connection, then send:
{
  "type": "submit_order",
  "order": {
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 1.0,
    "slippage": 0.01
  }
}
```

---

## 🐛 Troubleshooting

**Issue: "Cannot connect to database"**
- Verify DATABASE_URL is set correctly
- Check database is running and accessible
- Ensure firewall rules allow connection

**Issue: "Redis connection failed"**
- Verify REDIS_URL is set correctly
- Check Redis instance is running
- Test connection with `redis-cli ping`

**Issue: "WebSocket connection refused"**
- Ensure WebSocket route uses GET method
- Check reverse proxy WebSocket support
- Verify port is open and accessible

**Issue: "Queue not processing jobs"**
- Check worker is started (`Worker started` in logs)
- Verify Redis connection
- Check QUEUE_CONCURRENCY setting

---

## 📈 Monitoring

**Key Metrics to Monitor:**
- Queue job processing rate
- Order success/failure ratio
- Average order execution time
- WebSocket connection count
- Database query performance
- Redis memory usage

**Logging:**
- All orders logged to PostgreSQL
- Routing decisions saved in `routing_logs` table
- Application logs available via platform dashboard

---

## 🔐 Security Considerations

**Production Security:**
- [ ] Use HTTPS/WSS (not HTTP/WS)
- [ ] Enable database SSL connections
- [ ] Set strong database passwords
- [ ] Implement rate limiting
- [ ] Add authentication middleware
- [ ] Enable CORS with whitelist
- [ ] Use environment variables (never commit secrets)
- [ ] Regular security updates (`npm audit fix`)

---

## 📞 Support

For deployment issues:
1. Check application logs
2. Verify environment variables
3. Test database/Redis connectivity
4. Review platform-specific documentation
5. Check GitHub Issues

---

## ✅ Success Criteria

Your deployment is successful when:
- ✅ Health endpoint returns 200 OK
- ✅ WebSocket connections establish successfully
- ✅ Orders can be submitted and processed
- ✅ Queue metrics show active workers
- ✅ Database queries execute without errors
- ✅ Redis cache is operational
- ✅ All tests pass in production environment
