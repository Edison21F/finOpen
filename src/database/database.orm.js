// MongoDB Schemas - Datos generales y no sensibles
const mongoose = require('mongoose');

// Schema para rutas
const routeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  transportName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  beacons: [{
    id: String,
    position: {
      type: [Number] // [longitude, latitude]
    },
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String, // UUID del usuario de PostgreSQL
    required: true
  },
  tags: [String],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Schema para mensajes personalizados
const personalizedMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  estado: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },
  touristSpotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TouristSpot'
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  triggerRadius: {
    type: Number,
    default: 50 // metros
  },
  language: {
    type: String,
    default: 'es'
  },
  audioUrl: String,
  priority: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: String, // UUID del usuario de PostgreSQL
    required: true
  }
}, {
  timestamps: true
});

// Schema para registro turístico
const touristSpotSchema = new mongoose.Schema({
  lugarDestino: {
    type: String,
    required: true,
    trim: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true,
    trim: true
  },
  ubicacion: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  category: {
    type: String,
    enum: ['historical', 'cultural', 'recreational', 'commercial', 'transport', 'other'],
    default: 'other'
  },
  accessibility: {
    hasRamp: { type: Boolean, default: false },
    hasBraille: { type: Boolean, default: false },
    hasAudioGuide: { type: Boolean, default: false },
    hasGuideAssistance: { type: Boolean, default: false }
  },
  images: [String],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  schedule: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  contact: {
    phone: String,
    email: String,
    website: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String, // UUID del usuario de PostgreSQL
    required: true
  },
  tags: [String]
}, {
  timestamps: true
});

// Schema para guía de voz
const voiceGuideSchema = new mongoose.Schema({
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalizedMessage',
    required: true
  },
  mapImageUrl: {
    type: String,
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  estado: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  fechaRegistro: {
    type: Date,
    default: Date.now
  },
  duration: Number, // duración en segundos
  language: {
    type: String,
    default: 'es'
  },
  quality: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  createdBy: {
    type: String, // UUID del usuario de PostgreSQL
    required: true
  }
}, {
  timestamps: true
});

// Schema para logs de actividad del usuario
const userActivitySchema = new mongoose.Schema({
  userId: {
    type: String, // UUID del usuario de PostgreSQL
    required: true
  },
  action: {
    type: String,
    required: true
  },
  resource: String,
  resourceId: String,
  metadata: mongoose.Schema.Types.Mixed,
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: [Number]
  },
  device: {
    type: String,
    userAgent: String,
    platform: String
  }
}, {
  timestamps: true
});

// Índices adicionales para optimización
routeSchema.index({ name: 'text', location: 'text', description: 'text' });
personalizedMessageSchema.index({ message: 'text' });
touristSpotSchema.index({ nombre: 'text', descripcion: 'text', lugarDestino: 'text' });
userActivitySchema.index({ userId: 1, createdAt: -1 });

// Middleware para validaciones adicionales
routeSchema.pre('save', function(next) {
  if (this.coordinates && this.coordinates.coordinates) {
    const [lng, lat] = this.coordinates.coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return next(new Error('Invalid coordinates'));
    }
  }
  next();
});

// Métodos de instancia útiles
touristSpotSchema.methods.calculateDistance = function(lat, lng) {
  const [spotLng, spotLat] = this.ubicacion.coordinates;
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat - spotLat) * Math.PI / 180;
  const dLng = (lng - spotLng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(spotLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distancia en km
};

// Crear modelos
const Route = mongoose.model('Route', routeSchema);
const PersonalizedMessage = mongoose.model('PersonalizedMessage', personalizedMessageSchema);
const TouristSpot = mongoose.model('TouristSpot', touristSpotSchema);
const VoiceGuide = mongoose.model('VoiceGuide', voiceGuideSchema);
const UserActivity = mongoose.model('UserActivity', userActivitySchema);

module.exports = {
  Route,
  PersonalizedMessage,
  TouristSpot,
  VoiceGuide,
  UserActivity
};