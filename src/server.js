require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Importar configuraciones
const { connectPostgreSQL } = require('./config/postgresql');
const { connectMongoDB } = require('./config/mongodb');
const logger = require('./config/logger');

// Importar middlewares
const { authenticate } = require('./middleware/auth');
const { authorize } = require('./middleware/authorization');
const errorHandler = require('./middleware/errorHandler');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const routeRoutes = require('./routes/routes');
const messageRoutes = require('./routes/messages');
const touristSpotRoutes = require('./routes/touristSpots');
const voiceGuideRoutes = require('./routes/voiceGuides');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de seguridad
app.use(helmet());
app.use(limiter);

// Configurar CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://tu-dominio.com'] 
    : ['http://localhost:4200', 'http://localhost:3000'],
  credentials: true
}));

// Middleware de logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/routes', authenticate, routeRoutes);
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/tourist-spots', authenticate, touristSpotRoutes);
app.use('/api/voice-guides', authenticate, voiceGuideRoutes);

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Función para inicializar el servidor
async function startServer() {
  try {
    // Conectar a las bases de datos
    await connectPostgreSQL();
    await connectMongoDB();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`🚀 OpenBlind Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar servidor
startServer();

module.exports = app;