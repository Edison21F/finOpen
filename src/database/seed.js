require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectPostgreSQL, User } = require('../config/postgresql');
const { connectMongoDB } = require('../config/mongodb');
const { Route, PersonalizedMessage, TouristSpot } = require('../../database.orm');
const { logger } = require('../config/logger');

async function seedDatabase() {
  try {
    // Conectar a las bases de datos
    await connectPostgreSQL();
    await connectMongoDB();

    logger.info('Starting database seeding...');

    // Crear usuario administrador
    await seedAdminUser();
    
    // Crear datos de ejemplo
    await seedSampleData();

    logger.info('✅ Database seeding completed successfully');
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    throw error;
  }
}

async function seedAdminUser() {
  try {
    // Verificar si ya existe un admin
    const existingAdmin = await User.findOne({ where: { email: 'admin@openblind.com' } });
    
    if (existingAdmin) {
      logger.info('Admin user already exists, skipping...');
      return;
    }

    // Crear usuario administrador
    const passwordHash = await bcrypt.hash('admin123456', 12);
    
    const adminUser = await User.create({
      email: 'admin@openblind.com',
      passwordHash,
      nombres: 'Administrador',
      apellidos: 'OpenBlind',
      telefono: '0999999999',
      role: 'admin',
      emailVerified: true,
      isActive: true
    });

    logger.info(`Admin user created: ${adminUser.email}`);
  } catch (error) {
    logger.error('Error creating admin user:', error);
    throw error;
  }
}

async function seedSampleData() {
  try {
    // Obtener el usuario admin para asignar como creador
    const adminUser = await User.findOne({ where: { email: 'admin@openblind.com' } });
    
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    // Crear rutas de ejemplo
    await seedRoutes(adminUser.id);
    
    // Crear puntos turísticos de ejemplo
    await seedTouristSpots(adminUser.id);
    
    // Crear mensajes personalizados de ejemplo
    await seedMessages(adminUser.id);

  } catch (error) {
    logger.error('Error seeding sample data:', error);
    throw error;
  }
}

async function seedRoutes(userId) {
  const routes = [
    {
      name: 'Ruta del Bellavista',
      location: 'Centro Histórico',
      transportName: 'Bus Tipo Bellavista',
      description: 'Ruta turística por el centro histórico de Quito',
      coordinates: {
        type: 'Point',
        coordinates: [-78.5249, -0.2201]
      },
      beacons: [
        {
          id: 'beacon_001',
          position: [-78.5249, -0.2201],
          type: 'info'
        }
      ],
      tags: ['histórico', 'turismo', 'centro'],
      difficulty: 'easy',
      createdBy: userId
    },
    {
      name: 'Ruta alimentador del recreo a solanda',
      location: 'El Recreo',
      transportName: 'Juan Pablo II',
      description: 'Ruta de transporte público conectando El Recreo con Solanda',
      coordinates: {
        type: 'Point',
        coordinates: [-78.5170, -0.2902]
      },
      beacons: [
        {
          id: 'beacon_002',
          position: [-78.5170, -0.2902],
          type: 'transport'
        }
      ],
      tags: ['transporte', 'sur', 'metro'],
      difficulty: 'medium',
      createdBy: userId
    },
    {
      name: 'Estación de Carapungo - El Labrador',
      location: 'AV. Simón Bolívar, pasa por Calderón y San Carlos',
      transportName: 'Autobús: A102, B205 y Metro: LÍNEA 3',
      description: 'Ruta del metro que conecta el norte de Quito',
      coordinates: {
        type: 'Point',
        coordinates: [-78.4678, -0.1089]
      },
      beacons: [
        {
          id: 'beacon_003',
          position: [-78.4678, -0.1089],
          type: 'metro'
        }
      ],
      tags: ['metro', 'norte', 'transporte'],
      difficulty: 'easy',
      createdBy: userId
    }
  ];

  for (const routeData of routes) {
    const existingRoute = await Route.findOne({ name: routeData.name });
    if (!existingRoute) {
      await Route.create(routeData);
      logger.info(`Route created: ${routeData.name}`);
    }
  }
}

async function seedTouristSpots(userId) {
  const touristSpots = [
    {
      lugarDestino: 'San Francisco',
      nombre: 'Centro Histórico',
      descripcion: 'El convento, la iglesia de San Francisco y estación del metro',
      ubicacion: {
        type: 'Point',
        coordinates: [-78.5249, -0.2201]
      },
      category: 'historical',
      accessibility: {
        hasRamp: true,
        hasBraille: false,
        hasAudioGuide: true,
        hasGuideAssistance: true
      },
      tags: ['iglesia', 'convento', 'histórico'],
      createdBy: userId
    },
    {
      lugarDestino: 'Centro comercial el Recreo',
      nombre: 'El Recreo',
      descripcion: 'Estación el Recreo',
      ubicacion: {
        type: 'Point',
        coordinates: [-78.5170, -0.2902]
      },
      category: 'commercial',
      accessibility: {
        hasRamp: true,
        hasBraille: true,
        hasAudioGuide: false,
        hasGuideAssistance: false
      },
      tags: ['comercial', 'metro', 'shopping'],
      createdBy: userId
    },
    {
      lugarDestino: 'Estación El Labrador',
      nombre: 'El Labrador',
      descripcion: 'Cerca de la parada del metro',
      ubicacion: {
        type: 'Point',
        coordinates: [-78.4678, -0.1089]
      },
      category: 'transport',
      accessibility: {
        hasRamp: true,
        hasBraille: true,
        hasAudioGuide: true,
        hasGuideAssistance: false
      },
      tags: ['metro', 'transporte', 'estación'],
      createdBy: userId
    }
  ];

  for (const spotData of touristSpots) {
    const existingSpot = await TouristSpot.findOne({ nombre: spotData.nombre });
    if (!existingSpot) {
      await TouristSpot.create(spotData);
      logger.info(`Tourist spot created: ${spotData.nombre}`);
    }
  }
}

async function seedMessages(userId) {
  // Obtener las rutas creadas para asociar mensajes
  const routes = await Route.find({ createdBy: userId }).limit(3);
  
  if (routes.length === 0) {
    logger.warn('No routes found, skipping message seeding');
    return;
  }

  const messages = [
    {
      message: 'A tu derecha se encuentra la iglesia de San Francisco',
      estado: 'active',
      routeId: routes[0]._id,
      coordinates: {
        type: 'Point',
        coordinates: [-78.5249, -0.2201]
      },
      triggerRadius: 50,
      language: 'es',
      priority: 1,
      createdBy: userId
    },
    {
      message: 'Tienes el centro comercial el Recreo a tu lado derecho',
      estado: 'active',
      routeId: routes[1]._id,
      coordinates: {
        type: 'Point',
        coordinates: [-78.5170, -0.2902]
      },
      triggerRadius: 75,
      language: 'es',
      priority: 2,
      createdBy: userId
    },
    {
      message: 'Estás en la parada del metro Labrador',
      estado: 'active',
      routeId: routes[2]._id,
      coordinates: {
        type: 'Point',
        coordinates: [-78.4678, -0.1089]
      },
      triggerRadius: 30,
      language: 'es',
      priority: 1,
      createdBy: userId
    }
  ];

  for (const messageData of messages) {
    const existingMessage = await PersonalizedMessage.findOne({ 
      message: messageData.message 
    });
    if (!existingMessage) {
      await PersonalizedMessage.create(messageData);
      logger.info(`Message created: ${messageData.message.substring(0, 30)}...`);
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Database seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };