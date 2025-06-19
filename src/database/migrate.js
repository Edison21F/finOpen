require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { logger } = require('../config/logger');

// Configuración de la base de datos
const client = new Client({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
});

async function runMigrations() {
  try {
    await client.connect();
    logger.info('Connected to PostgreSQL for migrations');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../../database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar el SQL
    logger.info('Running database migrations...');
    await client.query(sql);
    
    logger.info('✅ Database migrations completed successfully');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };