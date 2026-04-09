// Plantillas precargadas de rúbricas (machotes)
export interface RubricTemplate {
  id: string;
  name: string;
  description: string;
  activityType?: string; // Nombre del tipo de actividad sugerido
  totalPoints: number;
  criteria: Array<{
    name: string;
    description?: string;
    points: number;
  }>;
}

export const rubricTemplates: RubricTemplate[] = [
  {
    id: 'template-examen-general',
    name: 'Examen General',
    description: 'Plantilla para exámenes con secciones de opción múltiple, pareo y desarrollo',
    activityType: 'Examen',
    totalPoints: 100,
    criteria: [
      {
        name: 'Opción Múltiple',
        description: 'Preguntas de selección múltiple',
        points: 30,
      },
      {
        name: 'Pareo',
        description: 'Ejercicios de correspondencia',
        points: 20,
      },
      {
        name: 'Desarrollo',
        description: 'Preguntas de respuesta abierta y desarrollo',
        points: 50,
      },
    ],
  },
  {
    id: 'template-proyecto-basico',
    name: 'Proyecto Básico',
    description: 'Plantilla para evaluar proyectos con criterios de contenido, presentación y creatividad',
    activityType: 'Proyecto',
    totalPoints: 100,
    criteria: [
      {
        name: 'Contenido',
        description: 'Calidad y profundidad del contenido',
        points: 40,
      },
      {
        name: 'Presentación',
        description: 'Organización, formato y claridad visual',
        points: 30,
      },
      {
        name: 'Creatividad',
        description: 'Originalidad e innovación en el proyecto',
        points: 30,
      },
    ],
  },
  {
    id: 'template-tarea-completa',
    name: 'Tarea Completa',
    description: 'Plantilla para tareas que evalúan completitud, calidad y presentación',
    activityType: 'Tarea',
    totalPoints: 20,
    criteria: [
      {
        name: 'Completitud',
        description: 'Todos los ejercicios resueltos',
        points: 8,
      },
      {
        name: 'Calidad',
        description: 'Correcta resolución de los ejercicios',
        points: 10,
      },
      {
        name: 'Presentación',
        description: 'Orden, limpieza y claridad',
        points: 2,
      },
    ],
  },
  {
    id: 'template-practica-laboratorio',
    name: 'Práctica de Laboratorio',
    description: 'Plantilla para evaluar prácticas de laboratorio',
    activityType: 'Práctica',
    totalPoints: 50,
    criteria: [
      {
        name: 'Procedimiento',
        description: 'Seguimiento correcto del procedimiento',
        points: 15,
      },
      {
        name: 'Resultados',
        description: 'Obtención y registro de resultados',
        points: 20,
      },
      {
        name: 'Análisis',
        description: 'Análisis e interpretación de resultados',
        points: 15,
      },
    ],
  },
  {
    id: 'template-portafolio',
    name: 'Portafolio',
    description: 'Plantilla para evaluar portafolios académicos',
    activityType: 'Portafolio',
    totalPoints: 100,
    criteria: [
      {
        name: 'Organización',
        description: 'Estructura y organización del portafolio',
        points: 25,
      },
      {
        name: 'Contenido',
        description: 'Calidad y variedad del contenido incluido',
        points: 40,
      },
      {
        name: 'Reflexión',
        description: 'Análisis y reflexión sobre el aprendizaje',
        points: 20,
      },
      {
        name: 'Presentación',
        description: 'Diseño y presentación visual',
        points: 15,
      },
    ],
  },
  {
    id: 'template-trabajo-cotidiano',
    name: 'Trabajo Cotidiano',
    description: 'Plantilla para evaluar trabajos cotidianos en clase',
    activityType: 'Trabajo Cotidiano',
    totalPoints: 10,
    criteria: [
      {
        name: 'Participación',
        description: 'Participación activa en clase',
        points: 4,
      },
      {
        name: 'Ejercicios',
        description: 'Resolución de ejercicios en clase',
        points: 4,
      },
      {
        name: 'Comportamiento',
        description: 'Actitud y comportamiento',
        points: 2,
      },
    ],
  },
  {
    id: 'template-examen-corto',
    name: 'Examen Corto',
    description: 'Plantilla para exámenes cortos o quizzes',
    activityType: 'Examen',
    totalPoints: 20,
    criteria: [
      {
        name: 'Opción Múltiple',
        description: 'Preguntas de selección múltiple',
        points: 10,
      },
      {
        name: 'Respuesta Corta',
        description: 'Preguntas de respuesta corta',
        points: 10,
      },
    ],
  },
  {
    id: 'template-proyecto-avanzado',
    name: 'Proyecto Avanzado',
    description: 'Plantilla detallada para proyectos complejos',
    activityType: 'Proyecto',
    totalPoints: 100,
    criteria: [
      {
        name: 'Investigación',
        description: 'Calidad de la investigación y fuentes',
        points: 25,
      },
      {
        name: 'Análisis',
        description: 'Análisis crítico y profundidad',
        points: 25,
      },
      {
        name: 'Implementación',
        description: 'Ejecución y funcionalidad del proyecto',
        points: 30,
      },
      {
        name: 'Documentación',
        description: 'Documentación completa y clara',
        points: 10,
      },
      {
        name: 'Presentación',
        description: 'Presentación oral o escrita',
        points: 10,
      },
    ],
  },
];
