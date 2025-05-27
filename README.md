# E-commerce Backend API

Backend Node.js con Express, PostgreSQL y Prisma para aplicación de e-commerce.

## 🚀 Inicio Rápido

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Base de Datos
```bash
# Crear base de datos PostgreSQL
createdb ecommerce_db

# O usando psql
psql -U postgres -c "CREATE DATABASE ecommerce_db;"
```

### 3. Configurar Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus configuraciones
# Especialmente DATABASE_URL y JWT secrets
```

### 4. Configurar Prisma
```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Sembrar datos iniciales
npm run db:seed
```

### 5. Iniciar Servidor
```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm start
```

## 📋 Scripts Disponibles

- `npm run dev` - Inicia servidor en modo desarrollo
- `npm start` - Inicia servidor en modo producción
- `npm run db:migrate` - Ejecuta migraciones de BD
- `npm run db:seed` - Siembra datos iniciales
- `npm run db:reset` - Resetea BD completamente
- `npm run db:studio` - Abre Prisma Studio
- `npm run lint` - Ejecuta ESLint
- `npm run format` - Formatea código con Prettier

## 🔗 Endpoints Disponibles

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/logout` - Cerrar sesión
- `POST /api/v1/auth/refresh` - Renovar token
- `GET /api/v1/auth/profile` - Obtener perfil
- `PUT /api/v1/auth/profile` - Actualizar perfil
- `POST /api/v1/auth/profile/change-password` - Cambiar contraseña

### Utilidades
- `GET /health` - Estado del servidor
- `GET /` - Información de la API

## 👤 Usuarios de Prueba

Después de ejecutar `npm run db:seed`:

**Administrador:**
- Email: `admin@ecommerce.com`
- Contraseña: `admin123`

**Cliente:**
- Email: `customer@test.com`
- Contraseña: `customer123`

## 🔧 Configuración

### Variables de Entorno Requeridas
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ecommerce_db"
JWT_SECRET="your_jwt_secret_here"
JWT_REFRESH_SECRET="your_refresh_secret_here"
```

### Variables Opcionales
Ver `.env.example` para configuraciones adicionales.

## 🗄️ Base de Datos

### Modelos Principales
- **User** - Usuarios del sistema
- **Category** - Categorías de productos
- **Product** - Productos del catálogo
- **Order** - Pedidos de clientes
- **Payment** - Pagos y comprobantes

### Migraciones
```bash
# Crear nueva migración
npx prisma migrate dev --name description

# Aplicar migraciones en producción
npm run db:deploy
```

## 🚨 Solución de Problemas

### Error de Conexión a BD
1. Verificar que PostgreSQL esté ejecutándose
2. Confirmar DATABASE_URL en .env
3. Verificar permisos de usuario de BD

### Error de Migraciones
```bash
# Resetear migraciones
npm run db:reset

# Regenerar cliente
npm run db:generate
```

### Puerto en Uso
```bash
# Cambiar puerto en .env
PORT=3002

# O matar proceso en puerto 3001
lsof -ti:3001 | xargs kill -9
```

## 📚 Tecnologías

- **Express.js** - Framework web
- **PostgreSQL** - Base de datos
- **Prisma** - ORM
- **Zod** - Validación de esquemas
- **bcryptjs** - Hash de contraseñas
- **jsonwebtoken** - Autenticación JWT
- **Winston** - Logging
- **Helmet** - Seguridad
- **CORS** - Políticas de origen cruzado

## 🔒 Seguridad

- Rate limiting habilitado
- Headers de seguridad con Helmet
- Validación de entrada con Zod
- Autenticación JWT con refresh tokens
- Hash de contraseñas con bcrypt
- CORS configurado

## 📊 Monitoreo

- Logs en `./logs/`
- Health check en `/health`
- Métricas de memoria y uptime
- Limpieza automática de tokens expirados