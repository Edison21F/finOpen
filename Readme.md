# OpenBlind Backend API

API backend para OpenBlind - Plataforma de asistencia para personas con discapacidad visual y turismo accesible.

## 🚀 Características

- **Arquitectura MVC** con separación clara de responsabilidades
- **Base de datos híbrida**: PostgreSQL para datos sensibles, MongoDB para datos generales
- **Autenticación JWT** con sesiones persistentes
- **Sistema de roles y permisos** granular
- **Logging completo** de todas las operaciones
- **Validación de datos** con Joi
- **Geolocalización** con MongoDB geospatial queries
- **Rate limiting** y medidas de seguridad
- **Documentación Postman** incluida

## 📁 Estructura del Proyecto

```
src/
├── config/           # Configuraciones de BD y logging
├── controllers/      # Lógica de negocio
├── middleware/       # Autenticación, autorización, errores
├── routes/          # Definición de rutas
├── validators/      # Validadores de datos
├── database/        # Migraciones y seeds
└── server.js        # Punto de entrada

logs/                # Archivos de logs
uploads/             # Archivos subidos
database.sql         # Schema PostgreSQL
database.orm.js      # Modelos MongoDB
```

## 🛠️ Instalación

### Prerrequisitos

- Node.js 16+
- PostgreSQL 12+
- MongoDB 5+

### Configuración

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd openblind-backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. **Configurar bases de datos**

**PostgreSQL:**
```bash
# Crear base de datos
createdb openblind_secure

# Ejecutar migraciones
npm run migrate
```

**MongoDB:**
```bash
# Asegúrate de que MongoDB esté ejecutándose
mongosh
use openblind_general
```

5. **Poblar datos iniciales**
```bash
npm run seed
```

6. **Iniciar servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📊 Bases de Datos

### PostgreSQL (Datos Sensibles)
- Usuarios y autenticación
- Sesiones activas
- Roles y permisos
- Logs de auditoría

### MongoDB (Datos Generales)
- Rutas y navegación
- Mensajes personalizados
- Puntos turísticos
- Guías de voz
- Actividad de usuarios

## 🔐 Autenticación y Autorización

### Roles del Sistema
- **admin**: Acceso completo al sistema
- **moderator**: Permisos limitados de gestión
- **user**: Usuario# OpenBlind Backend API

API backend para OpenBlind - Plataforma de asistencia para personas con discapacidad visual y turismo accesible.

## 🚀 Características

- **Arquitectura MVC** con separación clara de responsabilidades
- **Base de datos híbrida**: PostgreSQL para datos sensibles, MongoDB