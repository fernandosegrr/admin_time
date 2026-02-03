# Gestión de Tiempo Académico

Aplicación móvil para gestión de tiempo académico y personal con integración a Google Classroom.

## 📱 Stack Tecnológico

### Frontend (Expo React Native)
- **Framework**: Expo SDK 50 con Expo Router
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **UI**: React Native con diseño moderno oscuro
- **Notificaciones**: Expo Push Notifications

### Backend (Node.js/Express)
- **API**: Express.js con TypeScript
- **ORM**: Prisma
- **Base de Datos**: PostgreSQL
- **Autenticación**: JWT
- **Integración**: Google Classroom API
- **IA**: OpenAI GPT-4o-mini

## 🚀 Instalación

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

## 📋 Funcionalidades

### ✅ Implementadas
- [x] Autenticación JWT (registro/login)
- [x] Dashboard con timeline del día
- [x] Vista semanal con calendario
- [x] Gestión de tareas con filtros
- [x] Sugerencias de IA para programar tareas
- [x] CRUD de horarios (clases, gym, propedéutico)
- [x] Importar horarios desde JSON
- [x] Conexión con Google Classroom (email-only para escuelas bloqueadas)
- [x] Sincronización de tareas de Classroom
- [x] Notificaciones push configurables
- [x] Recordatorios automáticos

### 📝 Configuración Google OAuth (Opcional)

Si deseas usar OAuth completo en lugar del modo "solo email":

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilita Google Classroom API
3. Configura OAuth consent screen
4. Crea credenciales OAuth 2.0
5. Añade los scopes:
   - classroom.courses.readonly
   - classroom.coursework.me.readonly
   - classroom.announcements.readonly

## 📦 Estructura del Proyecto

```
gestion_tiempo/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── routes/
│       ├── services/
│       ├── middleware/
│       └── jobs/
│
└── frontend/
    ├── app/
    │   ├── (auth)/
    │   └── (tabs)/
    ├── stores/
    ├── services/
    └── hooks/
```

## 🔧 Variables de Entorno

### Backend (.env)
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="tu-secreto"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
OPENAI_API_KEY="..."
```

### Frontend (.env)
```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

## 📱 Uso con Expo Go

1. Inicia el backend: `npm run dev`
2. Inicia el frontend: `npx expo start`
3. Escanea el QR con Expo Go

## 💡 Formato JSON para Importar Horarios

```json
{
  "clases": [
    {
      "nombre": "Fundamentos de Matemáticas",
      "diaSemana": 1,
      "horaInicio": "08:00",
      "horaFin": "10:00",
      "color": "#FF5733"
    }
  ]
}
```
