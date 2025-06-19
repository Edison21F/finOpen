const mongoose = require('mongoose');
const logger = require('./logger');

// Configuración de MongoDB
mongoose.set('strictQuery', false);

// Función para conectar a MongoDB
async function connectMongoDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    logger.info('✅ MongoDB connection established successfully');
  } catch (error) {
    logger.error('❌ Unable to connect to MongoDB:', error);
    throw error;
  }
}

// Eventos de conexión
mongoose.connection.on('connected', () => {
  logger.info('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ Mongoose disconnected from MongoDB');
});

// Cerrar conexión gracefully
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('🔒 MongoDB connection closed due to app termination');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
});

module.exports = {
  connectMongoDB,
  mongoose
};