# 🚀 Quick Start Guide

Get your Solana DEX Order Router running in **5 minutes**!

---

## ⚡ Fast Track (3 Commands)

```bash
npm install
npm run docker:up
npm run dev
```

**That's it!** Server running on `http://localhost:3000` 🎉

---

## 🧪 Test It Now

### Option 1: Node.js Test Client (Easiest)

```bash
node test-client.js
```

Watch your order go through all stages:

- ✅ Order accepted
- 📊 Routing (DEX comparison)
- 🔨 Building transaction
- 📤 Submitted
- 🎉 Confirmed!

### Option 2: wscat (Interactive)

```bash
# Install wscat globally
npm install -g wscat

# Connect
wscat -c ws://localhost:3000/api/orders/execute

# Paste this and press Enter:
{"type":"submit_order","order":{"tokenIn":"SOL","tokenOut":"USDC","amount":1.5}}
```

### Option 3: PowerShell (5 Concurrent Orders)

```powershell
1..5 | ForEach-Object {
  node test-client.js &
}
```

---

## 📊 Check System Status

```bash
# Health check
curl http://localhost:3000/health

# Queue metrics
curl http://localhost:3000/api/queue/metrics

# Get all orders
curl http://localhost:3000/api/orders
```

---

## 🐳 Docker Commands

```bash
# Start services (PostgreSQL + Redis)
npm run docker:up

# Check logs
docker-compose logs -f

# Stop services
npm run docker:down

# Restart services
docker-compose restart
```

---

## 🔧 Troubleshooting

### "Cannot connect to database"

```bash
# Ensure Docker is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres
```

### "Redis connection refused"

```bash
# Check Redis status
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### "Port 3000 already in use"

```bash
# Change port in .env
echo "PORT=3001" >> .env

# Or kill process using port 3000 (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

---

## 📝 Environment Setup

Create `.env` file (optional, defaults work):

```bash
# Copy example
cp .env.example .env

# Edit if needed
# PORT=3000
# REDIS_HOST=localhost
# DB_HOST=localhost
```

---

## 🎯 What's Next?

1. ✅ **Test with multiple orders** - See concurrent processing
2. ✅ **Check routing logs** - `GET /api/orders/:id/routing`
3. ✅ **Watch queue metrics** - `GET /api/queue/metrics`
4. ✅ **Simulate failures** - Orders have 5% random failure rate
5. ✅ **Review documentation** - See README.md for full API docs

---

## 📚 Key Endpoints

| Method  | Endpoint                  | Purpose                     |
| ------- | ------------------------- | --------------------------- |
| **WS**  | `/api/orders/execute`     | Submit order + live updates |
| **GET** | `/api/orders/:id`         | Get order status            |
| **GET** | `/api/orders`             | List all orders             |
| **GET** | `/api/orders/:id/routing` | DEX routing decision        |
| **GET** | `/api/queue/metrics`      | Queue statistics            |
| **GET** | `/health`                 | System health               |

---

## 🎉 Success Checklist

- [ ] Docker services running (`docker-compose ps`)
- [ ] Server started (`npm run dev`)
- [ ] Health check passes (`curl http://localhost:3000/health`)
- [ ] Test order submitted (`node test-client.js`)
- [ ] Status updates received (WebSocket)
- [ ] Order confirmed (check console logs)

---

**Need help?** Check the full README.md for detailed documentation!
