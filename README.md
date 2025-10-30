# MERN DevOps Demo Application

A production-ready MERN stack application designed for DevOps infrastructure testing, connectivity monitoring, and CI/CD pipeline demonstrations.

## 🎯 Purpose

This application is specifically built for DevOps engineers to:
- Test and validate infrastructure connectivity
- Demonstrate CI/CD pipeline implementations
- Monitor service health and status
- Validate containerization and orchestration
- Test deployment strategies

## 🏗️ Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Backend   │─────▶│   MongoDB   │
│   (React)   │      │  (Express)  │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            │
                            ▼
                     ┌─────────────┐
                     │    Redis    │
                     │  (Optional) │
                     └─────────────┘
```

## 📋 Features

### Backend (Node.js + Express)
- ✅ Health check endpoint
- ✅ Detailed status reporting
- ✅ MongoDB connectivity monitoring
- ✅ Redis connectivity monitoring (optional)
- ✅ Application uptime tracking
- ✅ Structured logging with Winston
- ✅ Error handling middleware
- ✅ CORS configuration
- ✅ Environment-based configuration

### Frontend (React + Vite)
- ✅ Real-time status dashboard
- ✅ Auto-refresh functionality
- ✅ Service connectivity indicators
- ✅ Uptime display
- ✅ Responsive design with TailwindCSS
- ✅ Error handling and retry logic

### DevOps Features
- ✅ Multi-stage Docker builds
- ✅ Health checks for all services
- ✅ Non-root user execution
- ✅ Docker Compose orchestration
- ✅ Volume persistence
- ✅ Network isolation
- ✅ Production-ready configurations

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Using Docker Compose (Recommended)

1. **Clone and navigate to the project:**
```bash
git clone <repository-url>
cd mern-devops-demo
```

2. **Start all services:**
```bash
docker-compose up -d
```

3. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- MongoDB: localhost:27017
- Redis: localhost:6379

4. **View logs:**
```bash
docker-compose logs -f
```

5. **Stop all services:**
```bash
docker-compose down
```

6. **Stop and remove volumes:**
```bash
docker-compose down -v
```

### Local Development

#### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
# Create .env file
echo "VITE_API_URL=http://localhost:5000/api" > .env
npm run dev
```

## 📡 API Endpoints

### `GET /api/`
Returns basic backend status
```json
{
  "status": "Backend running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### `GET /api/health`
Health check endpoint for monitoring tools
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `GET /api/status`
Detailed status of all services
```json
{
  "application": {
    "name": "MERN DevOps Demo",
    "version": "1.0.0",
    "environment": "production",
    "status": "running"
  },
  "uptime": {
    "milliseconds": 123456,
    "seconds": 123,
    "formatted": "0d 0h 2m 3s"
  },
  "services": {
    "mongodb": {
      "connected": true,
      "message": "Connected",
      "lastChecked": "2024-01-01T00:00:00.000Z"
    },
    "redis": {
      "connected": true,
      "message": "Connected",
      "lastChecked": "2024-01-01T00:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🐳 Docker Commands

### Build Images
```bash
# Backend
docker build -t mern-devops-backend ./backend

# Frontend
docker build -t mern-devops-frontend ./frontend
```

### Run Containers Individually
```bash
# MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Redis
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Backend
docker run -d -p 5000:5000 \
  -e MONGO_URI=mongodb://mongodb:27017/devops-demo \
  -e REDIS_URI=redis://redis:6379 \
  --name backend mern-devops-backend

# Frontend
docker run -d -p 3000:3000 --name frontend mern-devops-frontend
```

## 🔧 Configuration

### Backend Environment Variables
```env
PORT=5000                    # Server port
NODE_ENV=production          # Environment mode
LOG_LEVEL=info              # Logging level
CORS_ORIGIN=*               # CORS allowed origins
MONGO_URI=mongodb://...     # MongoDB connection string
REDIS_URI=redis://...       # Redis connection string (optional)
```

### Frontend Environment Variables
```env
VITE_API_URL=http://localhost:5000/api  # Backend API URL
```

## 📊 Monitoring

### Health Checks
All services include health checks:
- **Backend**: `http://localhost:5000/api/health`
- **Frontend**: `http://localhost:3000`
- **MongoDB**: Internal mongosh ping
- **Redis**: redis-cli ping

### Logging
Backend uses Winston for structured logging:
- Console output with colorization
- JSON format for production
- Configurable log levels


## 🧪 Testing Scenarios

This application is ideal for testing:
- ✅ Container orchestration
- ✅ Service discovery
- ✅ Network connectivity
- ✅ Volume persistence
- ✅ Health check implementations
- ✅ Rolling deployments
- ✅ Blue-green deployments
- ✅ Canary releases
- ✅ Load balancing
- ✅ Auto-scaling
- ✅ Monitoring integration
- ✅ Logging aggregation

## 📈 Kubernetes Deployment

Example Kubernetes manifests would include:
- Deployments for frontend, backend
- StatefulSets for MongoDB, Redis
- Services for inter-pod communication
- ConfigMaps for configuration
- Secrets for sensitive data
- Ingress for external access
- HPA for auto-scaling

## 🔒 Security Considerations

- Non-root user in containers
- No sensitive data in images
- Environment-based configuration
- CORS properly configured
- Security headers in nginx
- Health check timeouts
- Graceful shutdown handling

## 🤝 Contributing

This is a demo application for DevOps testing. Feel free to:
- Add more monitoring endpoints
- Integrate with APM tools
- Add more database examples
- Enhance logging
- Add metrics endpoints

## 📝 License

MIT License - Free for educational and commercial use

## 🆘 Troubleshooting

### Backend can't connect to MongoDB
```bash
# Check MongoDB is running
docker-compose ps
# Check MongoDB logs
docker-compose logs mongodb
# Verify network
docker network inspect mern-devops-demo_devops-network
```

### Frontend can't reach backend
```bash
# Check CORS configuration in backend
# Verify VITE_API_URL in frontend build
# Check backend logs
docker-compose logs backend
```

### Services fail health checks
```bash
# Increase start_period in docker-compose.yml
# Check service logs
docker-compose logs [service-name]
```

## 📞 Support

For DevOps-related questions or issues:
- Check logs: `docker-compose logs -f`
- Verify environment variables
- Check service health: `docker-compose ps`
- Inspect networks: `docker network ls`

---

**Built for DevOps Engineers | Production-Ready | Container-Native**



==================================================================


To Extend Retry Time:
# Backend .env

MONGO_MAX_RETRIES=20
MONGO_RETRY_DELAY=10000
REDIS_MAX_RETRIES=20
REDIS_RETRY_DELAY=10000

The App Already Has Infinite Retry Capability:
1. Continuous Reconnection (Infinite Retry)
mongoose.connection.on('disconnected', () => {
  // This triggers automatic reconnection
  // Will keep trying forever until connected
});
MongoDB's driver has built-in automatic reconnection
Redis client also has built-in reconnection strategy
They keep trying indefinitely in the background
2. Initial Connection vs Ongoing Connection
The maxRetries (10 attempts, ~4.5 min) only applies to:

Initial connection attempt when app starts
After max retries, the app doesn't crash - it continues running
Background reconnection continues forever
3. What Actually Happens:
App starts → Try connecting (10 attempts, ~4.5 min)
  ↓
If fails after 10 attempts:
  ✅ App still runs (doesn't crash)
  ✅ MongoDB/Redis keep trying to reconnect forever
  ✅ Frontend shows "Disconnected" status
  ✅ When DB comes back online → Auto reconnects
  ↓
Connection restored automatically ✓
Real-World Scenario:
Time 0:00 - App starts, MongoDB is down
Time 0:00-4:30 - Tries 10 times (initial retry)
Time 4:30 - Gives up initial connection
Time 4:30+ - App runs, keeps trying in background (forever)
Time 10:00 - MongoDB comes online
Time 10:00 - Auto-reconnects immediately ✓
So Extending Retry Time Only Helps If:
You want the app to wait longer during startup before accepting traffic
You're using health checks that fail if DB isn't connected initially
You want cleaner startup logs (fewer "still trying..." messages)
For Your Template Use Case:
Current settings are perfect because:

✅ App doesn't crash if DB is down
✅ Auto-reconnects when DB comes back
✅ Developers see real-world resilient behavior
✅ Shows production-ready patterns
Verdict: No need to extend retry time. The continuous background reconnection handles everything.

=======================================================================================================

## Docker Compose Architecture Overview

The following table summarizes the different Docker Compose configurations available with their corresponding database architectures:

| File Name | MongoDB Architecture | Redis Architecture |
|-----------|---------------------|-------------------|
| docker-compose-standalone.yml | Standalone | Standalone |
| docker-compose-mongodb-replicaset-redis-standalone.yml | Replica Set (3 nodes) | Standalone |
| docker-compose-mongodb-standalone-redis-replication.yml | Standalone | Master-Replica (1+2) |
| docker-compose-mongodb-replicaset-redis-sentinel.yml | Replica Set (3 nodes) | Sentinel (3 sentinels) |
| docker-compose-mongodb-standalone-redis-cluster.yml | Standalone | Cluster (6 nodes) |
| docker-compose-mongodb-sharded-redis-cluster.yml | Sharded (2 shards + config servers) | Cluster (6 nodes) |

docker compose -f filename up -d 
docker compose -f filename down -v
