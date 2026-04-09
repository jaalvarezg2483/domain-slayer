# Gestor Académico - Sistema de Gestión para Profesores

Sistema completo de gestión académica para profesores, diseñado para funcionar completamente offline, sin necesidad de servidor ni base de datos en la nube. Todo se almacena localmente en SQLite.

## Características

- ✅ **Gestión de Colegios/Instituciones**
- ✅ **Gestión de Grupos por año lectivo**
- ✅ **Gestión de Estudiantes** (con importación masiva desde CSV)
- ✅ **Gestión de Cursos/Materias**
- ✅ **Sistema de Rúbricas** reutilizables y versionables
- ✅ **Actividades Evaluativas** (tareas, exámenes, proyectos, etc.)
- ✅ **Sistema de Calificaciones** con captura rápida
- ✅ **Registro de Asistencia** por sesión
- ✅ **Reportes PDF** personalizables con logos y encabezados
- ✅ **Sistema de Respaldos** (exportar/importar)

## Tecnologías

- **Electron** - Aplicación de escritorio
- **React** + **TypeScript** - Frontend
- **Vite** - Build tool
- **Tailwind CSS** + **shadcn/ui** - UI moderna
- **SQLite** (better-sqlite3) - Base de datos local
- **Drizzle ORM** - Gestión de base de datos
- **pdf-lib** - Generación de PDFs
- **jszip** - Empaquetado de respaldos

## Requisitos Previos

- Node.js 18+ y npm
- Windows 10/11 (para build de Windows)

## Instalación

1. **Clonar o descargar el proyecto**

2. **Instalar dependencias:**
```bash
npm install
```

3. **Ejecutar en modo desarrollo:**
```bash
npm run electron:dev
```

Esto iniciará:
- El servidor de desarrollo de Vite (puerto 5173)
- La aplicación Electron

## Construcción para Producción

### Windows

```bash
npm run electron:build
```

El ejecutable se generará en la carpeta `release/`.

## Estructura del Proyecto

```
gestor-academico/
├── electron/              # Código del proceso principal de Electron
│   ├── main.ts           # Punto de entrada de Electron
│   ├── preload.ts        # Script de preload (seguridad)
│   └── database/         # Base de datos y repositorios
│       ├── schema.ts     # Esquema de Drizzle
│       ├── db.ts         # Inicialización de BD
│       ├── repositories/ # Repositorios de datos
│       └── services/     # Servicios (reportes, respaldos)
├── src/                  # Código del frontend React
│   ├── components/       # Componentes React
│   │   ├── ui/          # Componentes shadcn/ui
│   │   └── Layout.tsx    # Layout principal
│   ├── pages/           # Páginas principales
│   ├── lib/             # Utilidades
│   └── App.tsx          # Componente raíz
└── public/              # Assets estáticos
```

## Uso

### Primera Configuración

1. **Configuración del Profesor:**
   - Ve a "Configuración"
   - Completa tus datos personales
   - Configura encabezados y pies de página para reportes

2. **Crear Colegios:**
   - Ve a "Colegios"
   - Agrega las instituciones donde impartes clases
   - Opcionalmente sube logos para los reportes

3. **Crear Años Lectivos:**
   - Los años lectivos se crean desde la base de datos o puedes agregarlos manualmente

4. **Crear Grupos:**
   - Ve a "Grupos"
   - Asocia cada grupo a un colegio y año lectivo

5. **Agregar Estudiantes:**
   - Ve a "Estudiantes"
   - Puedes agregar manualmente o importar desde CSV
   - Formato CSV esperado: `identificador,nombre,email,telefono,observaciones`

6. **Crear Cursos:**
   - Ve a "Cursos"
   - Crea las materias que impartes

7. **Asignar Cursos a Grupos:**
   - Desde "Grupos", selecciona un grupo y asigna cursos

### Trabajo Diario

- **Actividades:** Crea actividades evaluativas por curso y grupo
- **Calificaciones:** Captura notas de forma rápida por actividad
- **Asistencia:** Registra asistencia por sesión de clase
- **Reportes:** Genera reportes PDF personalizados

### Respaldos

- **Exportar:** Ve a "Reportes" → "Exportar Respaldo"
  - Se crea un archivo ZIP con la base de datos y logos
- **Importar:** Ve a "Reportes" → "Importar Respaldo"
  - Restaura todos los datos desde un respaldo anterior

## Ubicación de Datos

En Windows, los datos se almacenan en:
```
%APPDATA%/gestor-academico/
├── database/
│   └── gestor_academico.db
└── logos/
    └── (archivos de logos)
```

## Desarrollo

### Scripts Disponibles

- `npm run dev` - Inicia solo el servidor de desarrollo de Vite
- `npm run electron:dev` - Inicia Vite + Electron en modo desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run lint` - Ejecuta el linter

### Estructura de la Base de Datos

La base de datos SQLite se crea automáticamente en el primer inicio. El esquema incluye:

- `schools` - Colegios
- `academic_years` - Años lectivos
- `groups` - Grupos
- `students` - Estudiantes
- `group_students` - Relación grupo-estudiante
- `courses` - Cursos
- `group_courses` - Relación grupo-curso
- `rubric_templates` - Plantillas de rúbricas
- `rubric_instances` - Instancias de rúbricas por grupo-curso
- `assessments` - Actividades evaluativas
- `grades` - Calificaciones
- `attendance_sessions` - Sesiones de asistencia
- `attendance_records` - Registros de asistencia
- `teacher_config` - Configuración del profesor

## Notas Importantes

- **Offline First:** La aplicación funciona completamente sin conexión a internet
- **Portable:** Puedes exportar respaldos y restaurarlos en otra computadora
- **Local:** Todos los datos permanecen en tu computadora
- **Seguro:** No hay comunicación con servidores externos

## Solución de Problemas

### La aplicación no inicia
- Verifica que Node.js 18+ esté instalado
- Ejecuta `npm install` nuevamente
- Verifica que no haya errores en la consola

### Error al generar reportes PDF
- Verifica que los logos sean archivos PNG o JPG válidos
- Revisa que los datos estén completos

### Error al importar CSV
- Verifica el formato del CSV (debe tener encabezados)
- Asegúrate de que las columnas sean: identificador, nombre, email, telefono, observaciones

## Licencia

Este proyecto es de uso personal/educativo.

## Soporte

Para problemas o preguntas, revisa los comentarios en el código o la estructura del proyecto.



