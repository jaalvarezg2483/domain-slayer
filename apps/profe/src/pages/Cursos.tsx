import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, BookOpen, Users, UserPlus, Copy, Search, ClipboardList, CheckSquare, ChevronDown, ChevronRight, FileSearch } from 'lucide-react';

export default function Cursos() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentsDialogOpen, setStudentsDialogOpen] = useState(false);
  const [evaluationsDialogOpen, setEvaluationsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<any>(null);
  const [selectedCourseForEvaluations, setSelectedCourseForEvaluations] = useState<any>(null);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [courseEvaluations, setCourseEvaluations] = useState<any[]>([]);
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<any>(null);
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evaluationFormData, setEvaluationFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    percentage: '',
    activityTypeId: '',
    rubricId: '',
    totalPoints: '',
    periodNumber: '',
  });
  const [gradingDialogOpen, setGradingDialogOpen] = useState(false);
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [selectedEvaluationForGrading, setSelectedEvaluationForGrading] = useState<any>(null);
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<number, { score: number; criteriaScores?: Record<number, number>; subCriteriaScores?: Record<number, number> }>>({});
  const [expandedSubCriteria, setExpandedSubCriteria] = useState<Set<string>>(new Set());
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [cedulaLookupPending, setCedulaLookupPending] = useState(false);
  const [sharedStudentNotice, setSharedStudentNotice] = useState('');
  const addStudentInFlightRef = useRef(false);
  const sharedAutofillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newStudentForm, setNewStudentForm] = useState({
    identifier: '',
    fullName: '',
    email: '',
    phone: '',
  });
  const [reuseFromCourseId, setReuseFromCourseId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [gradesViewOpen, setGradesViewOpen] = useState(false);
  const [selectedCourseForGrades, setSelectedCourseForGrades] = useState<any>(null);
  const [courseGradesData, setCourseGradesData] = useState<any>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    section: '',
    groupId: '',
    periodId: '',
    gradeDistributionId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesData, groupsData, periodsData, studentsData, distributionsData, rubricsData, activityTypesData] = await Promise.all([
        ipc.courses.getAll().catch(() => []),
        ipc.groups.getAll().catch(() => []),
        ipc.periods.getAll().catch(() => []),
        ipc.students.getAll().catch(() => []),
        ipc.gradeDistributions.getAll().catch(() => []),
        ipc.rubrics.getAll().catch(() => []),
        ipc.activityTypes.getActive().catch(() => []),
      ]);
      setCourses(coursesData || []);
      setGroups(groupsData || []);
      setPeriods(periodsData || []);
      setAllStudents(studentsData || []);
      setDistributions(distributionsData || []);
      setRubrics(rubricsData || []);
      setActivityTypes(activityTypesData || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setCourses([]);
      setGroups([]);
      setPeriods([]);
      setAllStudents([]);
      setDistributions([]);
      setRubrics([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCourseStudents = async (courseId: number) => {
    try {
      const students = await ipc.studentCourses.getByCourseId(courseId);
      setCourseStudents(students || []);
    } catch (error) {
      console.error('Error cargando estudiantes del curso:', error);
      setCourseStudents([]);
    }
  };

  const normalizeCedulaInput = (raw: string) => raw.replace(/[\s-]/g, '').trim();

  const tryAutofillFromSharedStudent = useCallback(async (rawIdentifier: string, mode: 'debounced' | 'immediate') => {
    const key = normalizeCedulaInput(rawIdentifier);
    if (key.length < 5) {
      setSharedStudentNotice('');
      return;
    }
    try {
      const s = await ipc.students.getByIdentifier(key);
      if (!s) {
        setSharedStudentNotice('');
        return;
      }
      setNewStudentForm((f) => {
        if (normalizeCedulaInput(f.identifier) !== key) return f;
        return {
          ...f,
          fullName: f.fullName.trim() ? f.fullName : (s.fullName || ''),
          email: f.email.trim() ? f.email : (s.email || ''),
          phone: f.phone.trim() ? f.phone : (s.phone || ''),
        };
      });
      setSharedStudentNotice(
        mode === 'immediate'
          ? 'Esta cédula ya está en el sistema: se completaron los campos vacíos con la ficha compartida.'
          : 'Ficha compartida: otro docente ya registró esta cédula; revisa los datos sugeridos.',
      );
    } catch {
      setSharedStudentNotice('');
    }
  }, []);

  useEffect(() => {
    if (!studentsDialogOpen) return;
    const raw = newStudentForm.identifier;
    const key = normalizeCedulaInput(raw);
    if (key.length < 5) {
      setSharedStudentNotice('');
      return;
    }
    if (sharedAutofillTimerRef.current) clearTimeout(sharedAutofillTimerRef.current);
    sharedAutofillTimerRef.current = setTimeout(() => {
      void tryAutofillFromSharedStudent(raw, 'debounced');
    }, 500);
    return () => {
      if (sharedAutofillTimerRef.current) clearTimeout(sharedAutofillTimerRef.current);
    };
  }, [newStudentForm.identifier, studentsDialogOpen, tryAutofillFromSharedStudent]);

  const handleOpenStudentsDialog = async (course: any) => {
    addStudentInFlightRef.current = false;
    setIsAddingStudent(false);
    setSharedStudentNotice('');
    setNewStudentForm({ identifier: '', fullName: '', email: '', phone: '' });
    setSelectedCourseForStudents(course);
    setReuseFromCourseId('');
    setSearchQuery('');
    setSearchResults([]);
    await loadCourseStudents(course.id);
    setStudentsDialogOpen(true);
  };

  const handleFillNameFromCedula = async () => {
    const idTrim = newStudentForm.identifier.trim();
    if (!idTrim) {
      alert('Escribe primero el número de cédula.');
      return;
    }
    setCedulaLookupPending(true);
    try {
      const r = await ipc.personLookup.query(idTrim);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      if (r.fullName) {
        setNewStudentForm((f) => ({ ...f, fullName: r.fullName! }));
      } else {
        alert(
          'La respuesta no incluyó un nombre reconocible. Ajusta tu proxy para enviar fullName, nombreCompleto, name o nombre + apellido1.',
        );
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al consultar');
    } finally {
      setCedulaLookupPending(false);
    }
  };

  const handleAddNewStudent = async () => {
    if (addStudentInFlightRef.current) return;

    if (!selectedCourseForStudents) {
      alert('Error: No hay un curso seleccionado');
      return;
    }

    const idTrim = newStudentForm.identifier.trim();
    const nameTrim = newStudentForm.fullName.trim();
    if (!idTrim || !nameTrim) {
      alert('Cédula y nombre son requeridos');
      return;
    }

    addStudentInFlightRef.current = true;
    setIsAddingStudent(true);
    try {

      let student = await ipc.students.getByIdentifier(idTrim);

      if (!student) {
        student = await ipc.students.create({
          identifier: idTrim,
          fullName: nameTrim,
          email: newStudentForm.email || undefined,
          phone: newStudentForm.phone || undefined,
        });
        setAllStudents([...allStudents, student]);
      }

      const exists = await ipc.studentCourses.exists(student.id, selectedCourseForStudents.id);
      if (exists) {
        alert('El estudiante ya está en este curso');
        return;
      }

      await ipc.studentCourses.create({
        studentId: student.id,
        courseId: selectedCourseForStudents.id,
      });

      setNewStudentForm({ identifier: '', fullName: '', email: '', phone: '' });

      loadCourseStudents(selectedCourseForStudents.id).catch((err) => {
        console.error('Error recargando estudiantes:', err);
      });
      loadData().catch((err) => {
        console.error('Error recargando datos:', err);
      });

      alert('Estudiante agregado exitosamente');
    } catch (error: any) {
      console.error('❌ Error agregando estudiante:', error);
      alert(`Error al agregar el estudiante: ${error.message || 'Error desconocido'}`);
    } finally {
      addStudentInFlightRef.current = false;
      setIsAddingStudent(false);
    }
  };

  const handleReuseFromCourse = async () => {
    try {
      if (!selectedCourseForStudents) {
        alert('Error: No hay un curso seleccionado');
        return;
      }

      if (!reuseFromCourseId) {
        alert('Selecciona un curso para reutilizar estudiantes');
        return;
      }

      const sourceCourseId = parseInt(reuseFromCourseId);
      const sourceStudents = await ipc.studentCourses.getByCourseId(sourceCourseId);
      
      if (!sourceStudents || sourceStudents.length === 0) {
        alert('El curso seleccionado no tiene estudiantes');
        return;
      }

      // Agregar estudiantes que no estén ya en el curso actual
      const studentsToAdd = [];
      for (const sc of sourceStudents) {
        const exists = await ipc.studentCourses.exists(sc.studentId, selectedCourseForStudents.id);
        if (!exists) {
          studentsToAdd.push({
            studentId: sc.studentId,
            courseId: selectedCourseForStudents.id,
          });
        }
      }

      if (studentsToAdd.length === 0) {
        alert('Todos los estudiantes ya están en este curso');
        return;
      }

      await ipc.studentCourses.createMany(studentsToAdd);
      setReuseFromCourseId('');
      await loadCourseStudents(selectedCourseForStudents.id);
      alert(`${studentsToAdd.length} estudiante(s) agregado(s) exitosamente`);
    } catch (error: any) {
      console.error('Error reutilizando estudiantes:', error);
      alert(`Error al reutilizar estudiantes: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleRemoveStudent = async (studentCourseId: number) => {
    if (!confirm('¿Está seguro de eliminar este estudiante del curso?')) return;
    try {
      await ipc.studentCourses.delete(studentCourseId);
      await loadCourseStudents(selectedCourseForStudents.id);
    } catch (error) {
      console.error('Error eliminando estudiante:', error);
      alert('Error al eliminar el estudiante');
    }
  };

  const handleSearchStudents = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await ipc.students.search(query);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Error buscando estudiantes:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchedStudent = async (student: any) => {
    try {
      if (!selectedCourseForStudents) {
        alert('Error: No hay un curso seleccionado');
        return;
      }

      // Verificar si ya está en el curso
      const exists = await ipc.studentCourses.exists(student.id, selectedCourseForStudents.id);
      if (exists) {
        alert('El estudiante ya está en este curso');
        return;
      }

      // Agregar al curso
      await ipc.studentCourses.create({
        studentId: student.id,
        courseId: selectedCourseForStudents.id,
      });

      setSearchQuery('');
      setSearchResults([]);
      await loadCourseStudents(selectedCourseForStudents.id);
      alert('Estudiante agregado exitosamente');
    } catch (error: any) {
      console.error('Error agregando estudiante:', error);
      alert(`Error al agregar el estudiante: ${error.message || 'Error desconocido'}`);
    }
  };

  const handleOpenDialog = (course?: any) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        name: course.name || '',
        description: course.description || '',
        section: course.section || '',
        groupId: course.groupId?.toString() || '',
        periodId: course.periodId?.toString() || '',
        gradeDistributionId: course.gradeDistributionId?.toString() || 'none',
      });
    } else {
      setEditingCourse(null);
      setFormData({
        name: '',
        description: '',
        section: '',
        groupId: '',
        periodId: '',
        gradeDistributionId: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        section: formData.section || undefined,
        groupId: parseInt(formData.groupId),
        periodId: parseInt(formData.periodId),
        gradeDistributionId: formData.gradeDistributionId && formData.gradeDistributionId !== 'none' ? parseInt(formData.gradeDistributionId) : undefined,
      };
      if (editingCourse) {
        await ipc.courses.update(editingCourse.id, data);
      } else {
        await ipc.courses.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error guardando curso:', error);
      alert('Error al guardar el curso');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este curso? Se eliminarán todos los estudiantes asociados.')) return;
    try {
      await ipc.courses.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando curso:', error);
      alert('Error al eliminar el curso');
    }
  };

  const getGroupName = (groupId: number) => {
    const group = groups.find(g => g.id === groupId);
    return group ? `${group.name}${group.level ? ` - Nivel ${group.level}` : ''}` : 'Grupo desconocido';
  };

  const getCourseDisplayName = (course: any) => {
    const group = groups.find(g => g.id === course.groupId);
    const hasLevel = group?.level;
    const hasSection = course.section;
    
    if (hasLevel && hasSection) {
      return `${course.name} ${group.level}-${course.section}`;
    } else if (hasSection) {
      return `${course.name} - Sección ${course.section}`;
    } else {
      return course.name;
    }
  };

  const shouldShowCourseDescription = (course: any) => {
    const d = course.description?.trim();
    if (!d) return false;
    const name = (course.name ?? '').trim().toLowerCase();
    return d.toLowerCase() !== name;
  };

  const getPeriodLabel = (periodId: number) => {
    const period = periods.find(p => p.id === periodId);
    return period ? `${period.year} - ${period.type === 'trimestral' ? 'Trimestral' : 'Semestral'}` : 'Período desconocido';
  };

  const handleOpenEvaluationsDialog = async (course: any) => {
    setSelectedCourseForEvaluations(course);
    await loadCourseEvaluations(course.id);
    // Asegurar que las distribuciones estén cargadas con sus categorías
    if (course.gradeDistributionId) {
      const distribution = distributions.find(d => d.id === course.gradeDistributionId);
      if (!distribution || !distribution.categories || distribution.categories.length === 0) {
        // Recargar la distribución con categorías
        try {
          const fullDistribution = await ipc.gradeDistributions.getWithCategories(course.gradeDistributionId);
          if (fullDistribution) {
            setDistributions(distributions.map(d => 
              d.id === course.gradeDistributionId ? fullDistribution : d
            ));
          }
        } catch (error) {
          console.error('Error cargando distribución completa:', error);
        }
      }
    }
    setEvaluationsDialogOpen(true);
  };

  const loadCourseEvaluations = async (courseId: number) => {
    try {
      const evaluations = await ipc.evaluations.getByCourseId(courseId);
      setCourseEvaluations(evaluations || []);
    } catch (error) {
      console.error('Error cargando evaluaciones del curso:', error);
      setCourseEvaluations([]);
    }
  };

  // Función para calcular el porcentaje máximo disponible para una categoría
  const getMaxAvailablePercentage = (categoryId: string, periodNumber: string): number => {
    if (!categoryId || !periodNumber || !selectedCourseForEvaluations) {
      return 100; // Valor por defecto si no hay datos
    }

    const distribution = getCourseDistribution(selectedCourseForEvaluations);
    const selectedCategory = distribution?.categories?.find((cat: any) => 
      cat.id.toString() === categoryId
    );

    if (!selectedCategory) {
      return 100;
    }

    const categoryMax = selectedCategory.percentage || 0;
    const selectedPeriodNumber = parseInt(periodNumber);
    const categoryIdNum = parseInt(categoryId);

    // Filtrar evaluaciones del mismo semestre y categoría (excluyendo la que se está editando)
    const periodEvaluations = courseEvaluations.filter((evalItem: any) => {
      const evalCategoryId = typeof evalItem.categoryId === 'number' 
        ? evalItem.categoryId 
        : parseInt(evalItem.categoryId);
      const matchesCategory = evalCategoryId === categoryIdNum;
      
      const evalPeriodNumber = typeof evalItem.periodNumber === 'number'
        ? evalItem.periodNumber
        : evalItem.periodNumber ? parseInt(evalItem.periodNumber) : null;
      const matchesPeriod = selectedPeriodNumber !== null && evalPeriodNumber === selectedPeriodNumber;
      
      // Excluir la evaluación que se está editando
      if (editingEvaluation && evalItem.id === editingEvaluation.id) {
        return false;
      }
      
      return matchesCategory && matchesPeriod;
    });

    // Calcular porcentaje ya asignado en el semestre
    const categoryPercentage = periodEvaluations.reduce(
      (sum: number, evalItem: any) => sum + (evalItem.percentage || 0),
      0
    );

    // Retornar el porcentaje disponible
    return Math.max(0, categoryMax - categoryPercentage);
  };

  const handleOpenEvaluationDialog = (evaluation?: any, categoryId?: number) => {
    // Siempre limpiar primero el estado de edición
    setEditingEvaluation(null);
    
    if (evaluation) {
      // Si se está editando, establecer los datos de la evaluación
      setEditingEvaluation(evaluation);
      setEvaluationFormData({
        name: evaluation.name || '',
        description: evaluation.description || '',
        categoryId: evaluation.categoryId?.toString() || '',
        percentage: evaluation.percentage?.toString() || '',
        activityTypeId: evaluation.activityTypeId?.toString() || '',
        rubricId: evaluation.rubricId?.toString() || 'none',
        totalPoints: evaluation.totalPoints?.toString() || '',
        periodNumber: evaluation.periodNumber?.toString() || '',
      });
    } else {
      // Si es nueva evaluación, resetear completamente el formulario
      setEditingEvaluation(null);
      setEvaluationFormData({
        name: '',
        description: '',
        categoryId: categoryId?.toString() || '',
        percentage: '',
        activityTypeId: '',
        rubricId: '',
        totalPoints: '',
        periodNumber: '',
      });
    }
    setEvaluationDialogOpen(true);
  };

  const handleSaveEvaluation = async () => {
    // Prevenir múltiples envíos
    if (isSavingEvaluation) {
      return;
    }

    try {
      setIsSavingEvaluation(true);
      
      if (!evaluationFormData.name || !evaluationFormData.categoryId || !evaluationFormData.percentage) {
        alert('Nombre, categoría y porcentaje son requeridos');
        setIsSavingEvaluation(false);
        return;
      }

      // Validar que tenga período asignado
      if (!evaluationFormData.periodNumber) {
        alert('Debes seleccionar un período (Semestre/Cuatrimestre) para la evaluación');
        setIsSavingEvaluation(false);
        return;
      }

      // Validar que tenga tipo de actividad
      if (!evaluationFormData.activityTypeId) {
        alert('Debes seleccionar un tipo de actividad');
        setIsSavingEvaluation(false);
        return;
      }

      // Mostrar evaluaciones que coinciden con el semestre seleccionado
      if (evaluationFormData.categoryId && evaluationFormData.periodNumber) {
        const selectedPeriodNumber = parseInt(evaluationFormData.periodNumber);
        const categoryId = parseInt(evaluationFormData.categoryId);
        
        // Filtrar evaluaciones del mismo semestre y categoría
        const periodEvaluations = courseEvaluations.filter((evalItem: any) => {
          const evalCategoryId = typeof evalItem.categoryId === 'number' 
            ? evalItem.categoryId 
            : parseInt(evalItem.categoryId);
          const matchesCategory = evalCategoryId === categoryId;
          
          const evalPeriodNumber = typeof evalItem.periodNumber === 'number'
            ? evalItem.periodNumber
            : evalItem.periodNumber ? parseInt(evalItem.periodNumber) : null;
          const matchesPeriod = evalPeriodNumber === selectedPeriodNumber;
          
          return matchesCategory && matchesPeriod;
        });
        
        console.log(`Evaluaciones del semestre ${selectedPeriodNumber}:`, periodEvaluations);
      }

      // Verificar si el tipo de actividad requiere rúbrica
      const selectedType = activityTypes.find(t => t.id.toString() === evaluationFormData.activityTypeId);
      const requiresRubric = selectedType?.allowsRubric === true || selectedType?.evaluationModel === 'RUBRICA_CRITERIOS';
      
      // Filtrar rúbricas disponibles para este tipo
      const filteredRubrics = evaluationFormData.activityTypeId
        ? rubrics.filter(r => 
            r.activityTypeId && r.activityTypeId.toString() === evaluationFormData.activityTypeId
          )
        : [];

      // Si requiere rúbrica pero no hay ninguna disponible
      if (requiresRubric && filteredRubrics.length === 0) {
        const confirmMessage = `⚠️ No hay rúbricas creadas para el tipo de actividad "${selectedType?.name}".\n\n` +
          `Para crear una evaluación de este tipo, primero debes crear una rúbrica.\n\n` +
          `¿Deseas ir a la página de Rúbricas para crear una ahora?`;
        
        if (confirm(confirmMessage)) {
          setEvaluationDialogOpen(false);
          navigate('/rubricas');
        }
        setIsSavingEvaluation(false);
        return;
      }

      // Si requiere rúbrica pero no está seleccionada
      if (requiresRubric && !evaluationFormData.rubricId) {
        alert(`⚠️ Este tipo de actividad requiere una rúbrica.\n\nPor favor, selecciona una rúbrica de la lista o crea una nueva en la página de Rúbricas.`);
        setIsSavingEvaluation(false);
        return;
      }

      // MOSTRAR TODOS LOS DATOS DEL FORMULARIO ANTES DE ENVIAR
      console.log('📋 DATOS DEL FORMULARIO ANTES DE ENVIAR:', {
        evaluationFormData: evaluationFormData,
        editingEvaluation: editingEvaluation,
        selectedCourseForEvaluations: selectedCourseForEvaluations
      });
      
      const data: any = {
        courseId: selectedCourseForEvaluations.id,
        categoryId: parseInt(evaluationFormData.categoryId),
        activityTypeId: evaluationFormData.activityTypeId ? parseInt(evaluationFormData.activityTypeId) : undefined,
        name: evaluationFormData.name,
        percentage: parseInt(evaluationFormData.percentage),
        description: evaluationFormData.description || undefined,
        periodNumber: evaluationFormData.periodNumber ? parseInt(evaluationFormData.periodNumber) : undefined,
      };
      
      // Calcular el porcentaje REAL asignado al semestre seleccionado (suma de evaluaciones)
      const selectedPeriodNumber = evaluationFormData.periodNumber ? parseInt(evaluationFormData.periodNumber) : null;
      const categoryId = parseInt(evaluationFormData.categoryId);
      
      // Filtrar evaluaciones del mismo semestre y categoría (excluyendo la que se está editando)
      const periodEvaluations = courseEvaluations.filter((evalItem: any) => {
        const evalCategoryId = typeof evalItem.categoryId === 'number' 
          ? evalItem.categoryId 
          : parseInt(evalItem.categoryId);
        const matchesCategory = evalCategoryId === categoryId;
        
        const evalPeriodNumber = typeof evalItem.periodNumber === 'number'
          ? evalItem.periodNumber
          : evalItem.periodNumber ? parseInt(evalItem.periodNumber) : null;
        const matchesPeriod = selectedPeriodNumber !== null && evalPeriodNumber === selectedPeriodNumber;
        
        // Excluir la evaluación que se está editando
        if (editingEvaluation && evalItem.id === editingEvaluation.id) {
          return false;
        }
        
        return matchesCategory && matchesPeriod;
      });
      
      // SUMAR los porcentajes de las evaluaciones del semestre seleccionado
      const categoryPercentage = periodEvaluations.reduce(
        (sum: number, evalItem: any) => sum + (evalItem.percentage || 0),
        0
      );
      
      const distribution = getCourseDistribution(selectedCourseForEvaluations);
      const selectedCategory = distribution?.categories?.find((cat: any) => 
        cat.id.toString() === evaluationFormData.categoryId
      );
      
      // Validar porcentaje por semestre ANTES de enviar al backend
      const newPercentage = parseInt(evaluationFormData.percentage);
      const newTotal = categoryPercentage + newPercentage;
      const categoryMax = selectedCategory?.percentage || 0;
      
      if (newTotal > categoryMax) {
        const available = categoryMax - categoryPercentage;
        let message = `⚠️ El porcentaje total de evaluaciones en esta categoría no puede exceder ${categoryMax}% por semestre.\n\n`;
        
        if (periodEvaluations.length > 0) {
          message += `Ya existen ${periodEvaluations.length} ${periodEvaluations.length === 1 ? 'evaluación' : 'evaluaciones'} en esta categoría para el semestre ${selectedPeriodNumber}:\n`;
          periodEvaluations.forEach((evalItem: any, index: number) => {
            message += `  ${index + 1}. ${evalItem.name}: ${evalItem.percentage}%\n`;
          });
          message += `Total ya asignado: ${categoryPercentage}%\n\n`;
        } else {
          message += `Ya asignado en el semestre ${selectedPeriodNumber}: ${categoryPercentage}%\n\n`;
        }
        
        message += `Intenta agregar: ${newPercentage}%\n`;
        message += `Nuevo total sería: ${newTotal}% (excede el máximo de ${categoryMax}%)\n\n`;
        message += `Disponible máximo: ${available}%\n\n`;
        message += `Por favor, ajusta el porcentaje a ${available}% o menos.`;
        
        alert(message);
        setIsSavingEvaluation(false);
        return;
      }
      
      console.log('🔍 DATOS QUE SE ENVIARÁN AL BACKEND:', {
        data: data,
        categoryId: data.categoryId,
        categoryName: selectedCategory?.name,
        categoryPercentage: categoryPercentage, // SUMA de evaluaciones del semestre, NO el límite fijo
        categoryMax: selectedCategory?.percentage, // Límite máximo de la categoría
        periodNumber: data.periodNumber,
        periodNumberType: typeof data.periodNumber,
        periodNumberFromForm: evaluationFormData.periodNumber,
        name: data.name,
        percentage: data.percentage,
        periodEvaluations: periodEvaluations // Evaluaciones del semestre
      });

      if (evaluationFormData.rubricId) {
        data.rubricId = parseInt(evaluationFormData.rubricId);
        if (evaluationFormData.totalPoints) {
          data.totalPoints = parseInt(evaluationFormData.totalPoints);
        }
      } else if (requiresRubric) {
        // Si requiere rúbrica pero no se proporcionó, usar los puntos del tipo de actividad
        data.totalPoints = selectedType?.maxScore || 100;
      }

      if (editingEvaluation) {
        const updateData: any = {
          ...data,
          periodNumber: evaluationFormData.periodNumber ? parseInt(evaluationFormData.periodNumber) : undefined,
        };
        await ipc.evaluations.update(editingEvaluation.id, updateData);
      } else {
        await ipc.evaluations.create(data);
      }

      // Solo cerrar el diálogo si se guardó exitosamente
      setEvaluationDialogOpen(false);
      setEditingEvaluation(null);
      setEvaluationFormData({
        name: '',
        description: '',
        categoryId: '',
        percentage: '',
        activityTypeId: '',
        rubricId: '',
        totalPoints: '',
        periodNumber: '',
      });
      await loadCourseEvaluations(selectedCourseForEvaluations.id);
      setIsSavingEvaluation(false);
    } catch (error: any) {
      console.error('Error guardando evaluación:', error);
      setIsSavingEvaluation(false);
      // NO cerrar el diálogo si hay error, para que el usuario pueda corregir
      // NO limpiar el estado si hay error
      alert(error.message || 'Error al guardar la evaluación');
    }
  };

  const handleDeleteEvaluation = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta evaluación?')) return;
    try {
      await ipc.evaluations.delete(id);
      
      // Si se está editando la evaluación que se eliminó, cerrar el diálogo y limpiar el estado
      if (editingEvaluation && editingEvaluation.id === id) {
        setEvaluationDialogOpen(false);
        setEditingEvaluation(null);
        setEvaluationFormData({
          name: '',
          description: '',
          categoryId: '',
          percentage: '',
          activityTypeId: '',
          rubricId: '',
          totalPoints: '',
          periodNumber: '',
        });
      }
      
      await loadCourseEvaluations(selectedCourseForEvaluations.id);
    } catch (error) {
      console.error('Error eliminando evaluación:', error);
      alert('Error al eliminar la evaluación');
    }
  };


  const getCourseDistribution = (course: any) => {
    if (!course || !course.gradeDistributionId) return null;
    return distributions.find(d => d.id === course.gradeDistributionId);
  };

  // Función para calcular nota final de un estudiante
  const calculateFinalGrade = (studentId: number, evaluations: any[], allGrades: any[]) => {
    const distribution = getCourseDistribution(selectedCourseForGrades);
    if (!distribution || !distribution.categories) return null;

    let totalPercentage = 0;
    let earnedPercentage = 0;

    // Por cada categoría de la distribución
    for (const category of distribution.categories) {
      // Obtener evaluaciones de esta categoría
      const categoryEvaluations = evaluations.filter(e => e.categoryId === category.id);
      
      if (categoryEvaluations.length === 0) continue;

      // Calcular porcentaje total de evaluaciones en esta categoría
      const categoryTotalPercentage = categoryEvaluations.reduce((sum, e) => sum + e.percentage, 0);
      
      if (categoryTotalPercentage === 0) continue;

      // Calcular nota promedio en esta categoría
      let categoryEarned = 0;
      let categoryTotal = 0;

      for (const evaluation of categoryEvaluations) {
        const grade = allGrades.find(
          g => g.evaluationId === evaluation.id && g.studentId === studentId
        );

        if (grade) {
          const evaluationPercentage = (evaluation.percentage / categoryTotalPercentage) * category.percentage;
          const evaluationScore = (grade.score / grade.totalScore) * 100;
          
          categoryEarned += (evaluationScore * evaluationPercentage) / 100;
          categoryTotal += evaluationPercentage;
        } else {
          // Si no tiene calificación, cuenta como 0 pero suma al total
          const evaluationPercentage = (evaluation.percentage / categoryTotalPercentage) * category.percentage;
          categoryTotal += evaluationPercentage;
        }
      }

      if (categoryTotal > 0) {
        earnedPercentage += (categoryEarned / categoryTotal) * category.percentage;
      }
      totalPercentage += categoryTotal;
    }

    if (totalPercentage === 0) return null;

    const finalGrade = (earnedPercentage / totalPercentage) * 100;
    return {
      percentage: finalGrade,
      letter: getLetterGrade(finalGrade),
      status: getGradeStatus(finalGrade),
    };
  };

  const getLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const getGradeStatus = (percentage: number): string => {
    if (percentage >= 70) return 'Aprobado';
    return 'Reprobado';
  };

  // Cargar datos de calificaciones para un curso
  const loadCourseGrades = async (course: any) => {
    try {
      setSelectedCourseForGrades(course);
      
      // Cargar estudiantes del curso
      const students = await ipc.studentCourses.getByCourseId(course.id);
      
      // Cargar evaluaciones del curso
      const evaluations = await ipc.evaluations.getByCourseId(course.id);
      
      // Cargar todas las calificaciones
      const allGrades: any[] = [];
      for (const evaluation of evaluations) {
        const grades = await ipc.evaluationGrades.getByEvaluationId(evaluation.id);
        allGrades.push(...(grades || []));
      }

      // Cargar distribución con categorías
      const distribution = await ipc.gradeDistributions.getWithCategories(course.gradeDistributionId);
      
      // Enriquecer evaluaciones con datos de categoría y rúbrica
      const enrichedEvaluations = await Promise.all(
        evaluations.map(async (evaluation: any) => {
          const category = distribution?.categories?.find((c: any) => c.id === evaluation.categoryId);
          let rubric = null;
          if (evaluation.rubricId) {
            rubric = await ipc.rubrics.getById(evaluation.rubricId);
          }
          return {
            ...evaluation,
            category,
            rubric,
          };
        })
      );

      setCourseGradesData({
        students: students || [],
        evaluations: enrichedEvaluations,
        grades: allGrades,
        distribution,
      });
      
      setGradesViewOpen(true);
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
      alert('Error al cargar las calificaciones');
    }
  };

  const handleOpenGradingDialog = async (evaluation: any) => {
    try {
      
      // Cargar estudiantes del curso primero
      const students = await ipc.studentCourses.getByCourseId(evaluation.courseId);
      
      if (!students || students.length === 0) {
        alert('No hay estudiantes inscritos en este curso. Por favor, agrega estudiantes primero.');
        return;
      }
      
      setStudentGrades(students || []);
      
      // Cargar rúbrica si existe (puede que ya venga en evaluation.rubric)
      let evaluationWithRubric = { ...evaluation };
      if (evaluation.rubricId && !evaluation.rubric) {
        try {
          const rubric = await ipc.rubrics.getById(evaluation.rubricId);
          if (rubric) {
            evaluationWithRubric = {
              ...evaluation,
              rubric: rubric,
            };
          }
        } catch (error) {
          console.error('Error cargando rúbrica:', error);
        }
      }
      
      // Establecer la evaluación con rúbrica
      setSelectedEvaluationForGrading(evaluationWithRubric);
      
      // Cargar calificaciones existentes
      const existingGrades = await ipc.evaluationGrades.getByEvaluationId(evaluation.id);
      const gradesMap: Record<number, { score: number; criteriaScores?: Record<number, number>; subCriteriaScores?: Record<number, number> }> = {};
      
      existingGrades.forEach((grade: any) => {
        const criteriaScores: Record<number, number> = {};
        const subCriteriaScores: Record<number, number> = {};
        
        if (grade.criteriaScores) {
          grade.criteriaScores.forEach((cs: any) => {
            criteriaScores[cs.criterionId] = cs.score;
          });
        }
        
        // Si la rúbrica tiene subcriterios, inicializar los scores en 0
        // Los subcriterios se calcularán cuando el usuario los llene
        if (evaluationWithRubric?.rubric?.criteria) {
          evaluationWithRubric.rubric.criteria.forEach((criterion: any) => {
            if (criterion.subCriteria && criterion.subCriteria.length > 0) {
              // Inicializar subcriterios en 0 (se llenarán manualmente)
              criterion.subCriteria.forEach((subCriterion: any) => {
                if (!subCriteriaScores[subCriterion.id]) {
                  subCriteriaScores[subCriterion.id] = 0;
                }
              });
            }
          });
        }
        
        gradesMap[grade.studentId] = {
          score: grade.score,
          criteriaScores: Object.keys(criteriaScores).length > 0 ? criteriaScores : undefined,
          subCriteriaScores: Object.keys(subCriteriaScores).length > 0 ? subCriteriaScores : undefined,
        };
      });
      
      setGrades(gradesMap);
      setGradingDialogOpen(true);
    } catch (error) {
      console.error('Error abriendo diálogo de calificación:', error);
      alert('Error al cargar los datos para calificar. Por favor, intenta nuevamente.');
    }
  };

  const handleSaveGrades = async () => {
    if (!selectedEvaluationForGrading || isSavingGrades) return;
    
    try {
      setIsSavingGrades(true);
      const totalScore = selectedEvaluationForGrading.totalPoints || 100;
      
      for (const student of studentGrades) {
        const studentGrade = grades[student.studentId];
        if (!studentGrade || studentGrade.score === undefined) continue;
        
        let criteriaScores: Array<{ criterionId: number; score: number; maxScore: number }> | undefined;
        
        // Si tiene rúbrica, calcular criterios
        if (selectedEvaluationForGrading.rubric && studentGrade.criteriaScores) {
          criteriaScores = [];
          selectedEvaluationForGrading.rubric.criteria.forEach((criterion: any) => {
            let score = studentGrade.criteriaScores![criterion.id] || 0;
            
            // Si el criterio tiene subcriterios, calcular el total desde los subcriterios
            if (criterion.subCriteria && criterion.subCriteria.length > 0 && studentGrade.subCriteriaScores) {
              score = criterion.subCriteria.reduce((sum: number, subCriterion: any) => {
                return sum + (studentGrade.subCriteriaScores![subCriterion.id] || 0);
              }, 0);
            }
            
            criteriaScores!.push({
              criterionId: criterion.id,
              score: score,
              maxScore: criterion.points,
            });
          });
        }
        
        await ipc.evaluationGrades.upsert({
          evaluationId: selectedEvaluationForGrading.id,
          studentId: student.studentId,
          score: studentGrade.score,
          totalScore: totalScore,
          criteriaScores: criteriaScores,
        });
      }
      
      setIsSavingGrades(false);
      setGradingDialogOpen(false);
      alert('Calificaciones guardadas exitosamente');
      // Recargar datos de calificaciones si la vista está abierta (en segundo plano)
      if (selectedCourseForGrades) {
        loadCourseGrades(selectedCourseForGrades).catch(err => {
          console.error('Error recargando calificaciones:', err);
        });
      }
    } catch (error: any) {
      console.error('Error guardando calificaciones:', error);
      setIsSavingGrades(false);
      // NO cerrar el diálogo si hay error
      alert(error.message || 'Error al guardar las calificaciones');
    }
  };

  const handleRubricChange = (rubricId: string) => {
    if (rubricId && rubricId !== 'none') {
      const rubric = rubrics.find(r => r.id === parseInt(rubricId));
      if (rubric) {
        setEvaluationFormData({ 
          ...evaluationFormData, 
          rubricId, 
          totalPoints: rubric.totalPoints.toString() 
        });
      }
    } else {
      setEvaluationFormData({ ...evaluationFormData, rubricId: '', totalPoints: '' });
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cursos / Secciones</h1>
          <p className="text-muted-foreground mt-2">Gestiona los cursos y secciones académicas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Curso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCourse ? 'Editar Curso' : 'Nuevo Curso'}</DialogTitle>
              <DialogDescription>
                {editingCourse ? 'Modifica los datos del curso' : 'Crea un nuevo curso o sección académica'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Curso/Materia *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Matemáticas, Programación, Inglés"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción del curso"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="section">Sección (Opcional)</Label>
                  <Input
                    id="section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="Ej: 3 (para 1-3)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupId">Grupo *</Label>
                  <Select
                    value={formData.groupId}
                    onValueChange={(value) => setFormData({ ...formData, groupId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}{group.level ? ` - Nivel ${group.level}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodId">Período *</Label>
                <Select
                  value={formData.periodId}
                  onValueChange={(value) => setFormData({ ...formData, periodId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id.toString()}>
                        {period.year} - {period.type === 'trimestral' ? 'Trimestral' : 'Semestral'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gradeDistributionId">Distribución de Calificación (Opcional)</Label>
                <Select
                  value={formData.gradeDistributionId}
                  onValueChange={(value) => setFormData({ ...formData, gradeDistributionId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar distribución" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin distribución</SelectItem>
                    {distributions.map((distribution) => (
                      <SelectItem key={distribution.id} value={distribution.id.toString()}>
                        {distribution.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define cómo se distribuyen los porcentajes de calificación para este curso
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!formData.name || !formData.groupId || !formData.periodId}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <CardTitle className="text-lg font-semibold leading-snug tracking-tight break-words">
                    {getCourseDisplayName(course)}
                  </CardTitle>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenStudentsDialog(course)} title="Gestionar estudiantes">
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEvaluationsDialog(course)} title="Gestionar evaluaciones">
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(course)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(course.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {shouldShowCourseDescription(course) && (
                <p className="text-sm text-muted-foreground mb-2">{course.description}</p>
              )}
              <p className="text-sm text-muted-foreground mb-1">Grupo: {getGroupName(course.groupId)}</p>
              <p className="text-sm text-muted-foreground mb-2">Período: {getPeriodLabel(course.periodId)}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenStudentsDialog(course)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Estudiantes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenEvaluationsDialog(course)}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Evaluaciones
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {courses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay cursos registrados. Crea uno para comenzar.</p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={studentsDialogOpen}
        onOpenChange={(open) => {
          setStudentsDialogOpen(open);
          if (!open) {
            addStudentInFlightRef.current = false;
            setIsAddingStudent(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Estudiantes - {selectedCourseForStudents ? getCourseDisplayName(selectedCourseForStudents) : ''}
            </DialogTitle>
            <DialogDescription>
              La cédula es única en todo el sistema: un mismo alumno puede estar en varios cursos y con varios
              docentes; aquí solo matriculas en este curso. Puedes reutilizar de otros cursos o crear la ficha si no
              existe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Agregar nuevo estudiante */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Agregar Nuevo Estudiante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier">Cédula/ID *</Label>
                    <Input
                      id="identifier"
                      value={newStudentForm.identifier}
                      onChange={(e) => setNewStudentForm({ ...newStudentForm, identifier: e.target.value })}
                      onBlur={(e) => void tryAutofillFromSharedStudent(e.target.value, 'immediate')}
                      placeholder="Ej. 101110111 (sin guiones)"
                    />
                    {sharedStudentNotice ? (
                      <p className="text-sm text-muted-foreground">{sharedStudentNotice}</p>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={cedulaLookupPending}
                      onClick={handleFillNameFromCedula}
                    >
                      <FileSearch className="h-4 w-4 mr-2" />
                      {cedulaLookupPending ? 'Consultando…' : 'Rellenar nombre desde servicio (cédula)'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Requiere URL configurada por el administrador en Usuarios (proxy propio o proveedor autorizado).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nombre Completo *</Label>
                    <Input
                      id="fullName"
                      value={newStudentForm.fullName}
                      onChange={(e) => setNewStudentForm({ ...newStudentForm, fullName: e.target.value })}
                      placeholder="Nombre completo del estudiante"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newStudentForm.email}
                      onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono (Opcional)</Label>
                    <Input
                      id="phone"
                      value={newStudentForm.phone}
                      onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                      placeholder="Teléfono"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleAddNewStudent} 
                  disabled={isAddingStudent}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {isAddingStudent ? 'Agregando...' : 'Agregar Estudiante'}
                </Button>
              </CardContent>
            </Card>

            {/* Buscar y agregar estudiante existente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Buscar y Agregar Estudiante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="searchStudent">Buscar por Nombre o Cédula</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="searchStudent"
                      value={searchQuery}
                      onChange={(e) => handleSearchStudents(e.target.value)}
                      placeholder="Escribe nombre o cédula para buscar..."
                      className="pl-10"
                    />
                  </div>
                </div>
                {isSearching && (
                  <p className="text-sm text-muted-foreground">Buscando...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {searchResults.map((student) => {
                      const alreadyInCourse = courseStudents.some(
                        (sc: any) => sc.studentId === student.id
                      );
                      return (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{student.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              Cédula: {student.identifier}
                              {student.email && ` • ${student.email}`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddSearchedStudent(student)}
                            disabled={alreadyInCourse}
                            variant={alreadyInCourse ? "outline" : "default"}
                          >
                            {alreadyInCourse ? 'Ya está en el curso' : 'Agregar'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No se encontraron estudiantes
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Reutilizar de otro curso */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reutilizar Estudiantes de Otro Curso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reuseFromCourse">Seleccionar Curso</Label>
                  <Select
                    value={reuseFromCourseId}
                    onValueChange={setReuseFromCourseId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar curso para copiar estudiantes" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses
                        .filter(c => c.id !== selectedCourseForStudents?.id)
                        .map((course) => (
                          <SelectItem key={course.id} value={course.id.toString()}>
                            {getCourseDisplayName(course)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleReuseFromCourse} disabled={!reuseFromCourseId} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Estudiantes del Curso Seleccionado
                </Button>
              </CardContent>
            </Card>

            {/* Lista de estudiantes del curso */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Estudiantes del Curso ({courseStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {courseStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay estudiantes en este curso. Agrega uno para comenzar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {courseStudents.map((sc: any) => (
                      <div key={sc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{sc.student.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            Cédula: {sc.student.identifier}
                            {sc.student.email && ` • ${sc.student.email}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveStudent(sc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Evaluaciones */}
      <Dialog open={evaluationsDialogOpen} onOpenChange={setEvaluationsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Evaluaciones - {selectedCourseForEvaluations ? getCourseDisplayName(selectedCourseForEvaluations) : ''}
            </DialogTitle>
            <DialogDescription>
              Gestiona las evaluaciones de este curso. Define cómo se calificará cada evaluación usando rúbricas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedCourseForEvaluations ? (
              <p>Cargando...</p>
            ) : (() => {
              const distribution = getCourseDistribution(selectedCourseForEvaluations);
              if (!distribution) {
                return (
                  <Card>
                    <CardContent className="py-8 text-center space-y-4">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2 font-medium">
                        Este curso no tiene una distribución de calificación asignada.
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Para crear evaluaciones, primero debes asignar una distribución de calificación al curso.
                      </p>
                      <Button
                        onClick={() => {
                          setEvaluationsDialogOpen(false);
                          handleOpenDialog(selectedCourseForEvaluations);
                        }}
                        variant="default"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar Curso y Asignar Distribución
                      </Button>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <>
                  <Card className="mb-4 bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Distribución: {distribution.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {distribution.categories?.map((cat: any) => `${cat.name} (${cat.percentage}%)`).join(', ')}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-medium mb-3">Crear nueva evaluación:</p>
                        <div className="flex flex-wrap gap-2">
                          {distribution.categories && distribution.categories.length > 0 ? (
                            distribution.categories.map((category: any) => (
                              <Button
                                key={category.id}
                                variant="default"
                                size="default"
                                onClick={() => handleOpenEvaluationDialog(undefined, category.id)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Nueva en {category.name}
                              </Button>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Esta distribución no tiene categorías. Edítala en la página de Distribuciones.
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {courseEvaluations.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          No hay evaluaciones registradas. Crea una para comenzar.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {distribution.categories?.map((category: any) => {
                        const categoryEvaluations = courseEvaluations.filter(
                          (evalItem: any) => evalItem.categoryId === category.id
                        );
                        
                        // NO calcular porcentaje total sumando todos los semestres
                        // El porcentaje se muestra individualmente por semestre abajo
                        const isExpanded = expandedCategories.has(category.id);
                        
                        return (
                          <Card key={category.id}>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const newExpanded = new Set(expandedCategories);
                                      if (newExpanded.has(category.id)) {
                                        newExpanded.delete(category.id);
                                      } else {
                                        newExpanded.add(category.id);
                                      }
                                      setExpandedCategories(newExpanded);
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <CardTitle className="text-base">
                                    {category.name} ({category.percentage}%)
                                  </CardTitle>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  Límite por semestre: {category.percentage}%
                                </span>
                              </div>
                            </CardHeader>
                            {isExpanded && (
                            <CardContent>
                              {categoryEvaluations.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                  No hay evaluaciones en esta categoría
                                </p>
                              ) : (() => {
                                // Obtener información del período del curso
                                const coursePeriod = selectedCourseForEvaluations 
                                  ? periods.find(p => p.id === selectedCourseForEvaluations.periodId)
                                  : null;
                                const periodType = coursePeriod?.type || 'semestral';
                                const maxPeriods = periodType === 'trimestral' ? 3 : 2;
                                const periodLabel = periodType === 'trimestral' ? 'Cuatrimestre' : 'Semestre';
                                
                                // Debug: ver qué evaluaciones tenemos
                                
                                // Filtrar evaluaciones: solo las que tienen período válido (1 a maxPeriods)
                                // Eliminar duplicados por ID
                                const seenIds = new Set<number>();
                                const validEvaluations = categoryEvaluations.filter((evalItem: any) => {
                                  // Evitar duplicados
                                  if (seenIds.has(evalItem.id)) {
                                    return false;
                                  }
                                  seenIds.add(evalItem.id);
                                  
                                  // Solo mostrar evaluaciones con período válido (1 a maxPeriods)
                                  // Convertir a número si es string o null/undefined
                                  const periodNum = evalItem.periodNumber 
                                    ? (typeof evalItem.periodNumber === 'string' 
                                        ? parseInt(evalItem.periodNumber, 10) 
                                        : Number(evalItem.periodNumber))
                                    : null;
                                  
                                  // Si no tiene período, no mostrarla
                                  if (!periodNum || isNaN(periodNum)) {
                                    return false;
                                  }
                                  
                                  // Validar que esté en el rango válido
                                  return periodNum >= 1 && periodNum <= maxPeriods;
                                });
                                
                                // Agrupar evaluaciones por período
                                const evaluationsByPeriod: Record<number, any[]> = {};
                                validEvaluations.forEach((evalItem: any) => {
                                  // Convertir a número si es necesario
                                  const periodNum = typeof evalItem.periodNumber === 'string' 
                                    ? parseInt(evalItem.periodNumber, 10) 
                                    : evalItem.periodNumber;
                                  
                                  if (periodNum && periodNum >= 1 && periodNum <= maxPeriods) {
                                    if (!evaluationsByPeriod[periodNum]) {
                                      evaluationsByPeriod[periodNum] = [];
                                    }
                                    evaluationsByPeriod[periodNum].push(evalItem);
                                  }
                                });
                                
                                // Ordenar períodos (solo 1, 2, o 3 según corresponda)
                                const sortedPeriods = Object.keys(evaluationsByPeriod)
                                  .map(Number)
                                  .filter(p => p >= 1 && p <= maxPeriods)
                                  .sort((a, b) => a - b);
                                
                                if (sortedPeriods.length === 0) {
                                  return (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                      No hay evaluaciones con período asignado en esta categoría
                                    </p>
                                  );
                                }
                                
                                return (
                                  <div className="space-y-4">
                                    {sortedPeriods.map((periodNum) => {
                                      const periodEvaluations = evaluationsByPeriod[periodNum];
                                      const periodPercentage = periodEvaluations.reduce(
                                        (sum: number, evalItem: any) => sum + evalItem.percentage,
                                        0
                                      );
                                      const romanNum = periodNum === 1 ? 'I' : periodNum === 2 ? 'II' : 'III';
                                      
                                      return (
                                        <div key={periodNum} className="border-l-4 border-purple-400 pl-4">
                                          <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-semibold text-purple-700">
                                              {romanNum} {periodLabel}
                                            </h4>
                                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                              {periodPercentage}% de {category.percentage}%
                                            </span>
                                          </div>
                                          <div className="space-y-2 ml-2">
                                            {periodEvaluations.map((evalItem: any) => (
                                              <div
                                                key={evalItem.id}
                                                className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                                              >
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <p className="font-medium">{evalItem.name}</p>
                                                    <span className="text-sm text-muted-foreground">
                                                      ({evalItem.percentage}%)
                                                    </span>
                                                    {evalItem.rubric && (
                                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                        {evalItem.rubric.name} ({evalItem.totalPoints} pts)
                                                      </span>
                                                    )}
                                                  </div>
                                                  {evalItem.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                      {evalItem.description}
                                                    </p>
                                                  )}
                                                  {evalItem.rubric && evalItem.rubric.criteria && (
                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                      <p className="font-medium mb-1">Criterios:</p>
                                                      <ul className="list-disc list-inside space-y-1">
                                                        {evalItem.rubric.criteria.map((crit: any) => (
                                                          <li key={crit.id}>
                                                            {crit.name}: {crit.points} pts
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="flex gap-2">
                                                  <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => handleOpenGradingDialog(evalItem)}
                                                  >
                                                    <CheckSquare className="h-4 w-4 mr-1" />
                                                    Calificar
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenEvaluationDialog(evalItem)}
                                                  >
                                                    <Edit className="h-4 w-4 mr-1" />
                                                    Editar
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteEvaluation(evalItem.id)}
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                    Eliminar
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvaluationsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Crear/Editar Evaluación */}
      <Dialog 
        open={evaluationDialogOpen} 
        onOpenChange={(open) => {
          // NO permitir cerrar si está guardando
          if (!open && isSavingEvaluation) {
            return;
          }
          
          setEvaluationDialogOpen(open);
          if (!open && !isSavingEvaluation) {
            // Limpiar estado cuando se cierra el diálogo (solo si no está guardando)
            setEditingEvaluation(null);
            setIsSavingEvaluation(false);
            setEvaluationFormData({
              name: '',
              description: '',
              categoryId: '',
              percentage: '',
              activityTypeId: '',
              rubricId: '',
              totalPoints: '',
              periodNumber: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEvaluation ? 'Editar Evaluación' : 'Nueva Evaluación'}
            </DialogTitle>
            <DialogDescription>
              {editingEvaluation
                ? 'Modifica los datos de la evaluación'
                : 'Crea una nueva evaluación para el curso'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="evalName">Nombre de la Evaluación *</Label>
              <Input
                id="evalName"
                value={evaluationFormData.name || ''}
                onChange={(e) => setEvaluationFormData({ ...evaluationFormData, name: e.target.value })}
                placeholder="Ej: Examen 1, Tarea 1, Proyecto Final"
                disabled={false}
                readOnly={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evalDescription">Descripción (Opcional)</Label>
              <textarea
                id="evalDescription"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={evaluationFormData.description}
                onChange={(e) => setEvaluationFormData({ ...evaluationFormData, description: e.target.value })}
                placeholder="Descripción de la evaluación"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evalActivityType">Tipo de Actividad *</Label>
              <Select
                value={evaluationFormData.activityTypeId}
                onValueChange={(value) => {
                  const selectedType = activityTypes.find(t => t.id.toString() === value);
                  const requiresRubric = selectedType?.allowsRubric === true || selectedType?.evaluationModel === 'RUBRICA_CRITERIOS';
                  
                  // Limpiar rúbrica cuando cambia el tipo de actividad
                  setEvaluationFormData({
                    ...evaluationFormData,
                    activityTypeId: value,
                    rubricId: '', // Limpiar rúbrica al cambiar tipo
                    totalPoints: requiresRubric ? '' : (selectedType?.maxScore?.toString() || '100'),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de actividad" />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name} ({type.evaluationModel === 'RUBRICA_CRITERIOS' ? 'Rúbrica' : type.evaluationModel === 'PUNTAJE_DIRECTO' ? 'Puntaje Directo' : 'Portafolio'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El tipo de actividad determina cómo se evaluará esta actividad
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="evalCategory">Categoría *</Label>
                <Select
                  value={evaluationFormData.categoryId}
                  onValueChange={(value) => {
                    const newFormData = { ...evaluationFormData, categoryId: value };
                    // Si hay período seleccionado, validar y ajustar el porcentaje
                    if (newFormData.periodNumber) {
                      const maxAvailable = getMaxAvailablePercentage(value, newFormData.periodNumber);
                      const currentPercentage = parseInt(newFormData.percentage) || 0;
                      if (currentPercentage > maxAvailable) {
                        newFormData.percentage = maxAvailable > 0 ? maxAvailable.toString() : '';
                      }
                    }
                    setEvaluationFormData(newFormData);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCourseForEvaluations ? (() => {
                      const distribution = getCourseDistribution(selectedCourseForEvaluations);
                      return distribution?.categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name} ({cat.percentage}%)
                        </SelectItem>
                      ));
                    })() : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evalPercentage">Porcentaje (%) *</Label>
                <Input
                  id="evalPercentage"
                  type="number"
                  min="1"
                  max={evaluationFormData.categoryId && evaluationFormData.periodNumber 
                    ? getMaxAvailablePercentage(evaluationFormData.categoryId, evaluationFormData.periodNumber) 
                    : 100}
                  value={evaluationFormData.percentage}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Validar que no exceda el máximo disponible
                    if (evaluationFormData.categoryId && evaluationFormData.periodNumber) {
                      const maxAvailable = getMaxAvailablePercentage(evaluationFormData.categoryId, evaluationFormData.periodNumber);
                      const numValue = parseInt(value);
                      if (value && !isNaN(numValue) && numValue > maxAvailable) {
                        // Obtener información de evaluaciones existentes para el mensaje
                        const selectedPeriodNumber = parseInt(evaluationFormData.periodNumber);
                        const categoryIdNum = parseInt(evaluationFormData.categoryId);
                        const existingEvaluations = courseEvaluations.filter((evalItem: any) => {
                          const evalCategoryId = typeof evalItem.categoryId === 'number' 
                            ? evalItem.categoryId 
                            : parseInt(evalItem.categoryId);
                          const matchesCategory = evalCategoryId === categoryIdNum;
                          
                          const evalPeriodNumber = typeof evalItem.periodNumber === 'number'
                            ? evalItem.periodNumber
                            : evalItem.periodNumber ? parseInt(evalItem.periodNumber) : null;
                          const matchesPeriod = selectedPeriodNumber !== null && evalPeriodNumber === selectedPeriodNumber;
                          
                          if (editingEvaluation && evalItem.id === editingEvaluation.id) {
                            return false;
                          }
                          
                          return matchesCategory && matchesPeriod;
                        });
                        
                        const distribution = getCourseDistribution(selectedCourseForEvaluations);
                        const selectedCategory = distribution?.categories?.find((cat: any) => 
                          cat.id.toString() === evaluationFormData.categoryId
                        );
                        const categoryMax = selectedCategory?.percentage || 0;
                        const assignedPercentage = existingEvaluations.reduce(
                          (sum: number, evalItem: any) => sum + (evalItem.percentage || 0),
                          0
                        );
                        
                        let message = `⚠️ El porcentaje máximo disponible es ${maxAvailable}%.\n\n`;
                        if (existingEvaluations.length > 0) {
                          message += `Ya existen ${existingEvaluations.length} ${existingEvaluations.length === 1 ? 'evaluación' : 'evaluaciones'} en esta categoría con ${assignedPercentage}% asignado.\n`;
                          message += `El máximo de la categoría es ${categoryMax}%, por lo que solo puedes asignar ${maxAvailable}% más.\n\n`;
                        } else {
                          message += `El máximo de la categoría es ${categoryMax}%.\n\n`;
                        }
                        message += `Por favor, ingresa un valor entre 1 y ${maxAvailable}%.`;
                        
                        alert(message);
                        // Limitar el valor al máximo disponible
                        setEvaluationFormData({ ...evaluationFormData, percentage: maxAvailable.toString() });
                        return;
                      }
                    }
                    setEvaluationFormData({ ...evaluationFormData, percentage: value });
                  }}
                  placeholder="Ej: 20"
                />
                {evaluationFormData.categoryId && evaluationFormData.periodNumber && (() => {
                  const maxAvailable = getMaxAvailablePercentage(evaluationFormData.categoryId, evaluationFormData.periodNumber);
                  const distribution = getCourseDistribution(selectedCourseForEvaluations);
                  const selectedCategory = distribution?.categories?.find((cat: any) => 
                    cat.id.toString() === evaluationFormData.categoryId
                  );
                  const categoryMax = selectedCategory?.percentage || 0;
                  
                  // Calcular evaluaciones existentes para mostrar información detallada
                  const selectedPeriodNumber = parseInt(evaluationFormData.periodNumber);
                  const categoryIdNum = parseInt(evaluationFormData.categoryId);
                  const existingEvaluations = courseEvaluations.filter((evalItem: any) => {
                    const evalCategoryId = typeof evalItem.categoryId === 'number' 
                      ? evalItem.categoryId 
                      : parseInt(evalItem.categoryId);
                    const matchesCategory = evalCategoryId === categoryIdNum;
                    
                    const evalPeriodNumber = typeof evalItem.periodNumber === 'number'
                      ? evalItem.periodNumber
                      : evalItem.periodNumber ? parseInt(evalItem.periodNumber) : null;
                    const matchesPeriod = selectedPeriodNumber !== null && evalPeriodNumber === selectedPeriodNumber;
                    
                    // Excluir la evaluación que se está editando
                    if (editingEvaluation && evalItem.id === editingEvaluation.id) {
                      return false;
                    }
                    
                    return matchesCategory && matchesPeriod;
                  });
                  
                  const assignedPercentage = existingEvaluations.reduce(
                    (sum: number, evalItem: any) => sum + (evalItem.percentage || 0),
                    0
                  );
                  const countEvaluations = existingEvaluations.length;
                  
                  return (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {maxAvailable > 0 ? (
                          <>
                            Máximo disponible: <span className="font-semibold text-blue-600">{maxAvailable}%</span> de {categoryMax}% de la categoría
                            {countEvaluations > 0 && (
                              <span className="block mt-1">
                                Ya hay {countEvaluations} {countEvaluations === 1 ? 'evaluación' : 'evaluaciones'} con {assignedPercentage}% asignado. 
                                La suma total no debe exceder {categoryMax}%.
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-red-600 font-semibold">
                            ⚠️ No hay porcentaje disponible. Ya se alcanzó el máximo de {categoryMax}% para esta categoría en este semestre.
                            {countEvaluations > 0 && (
                              <span className="block mt-1 font-normal">
                                Ya existen {countEvaluations} {countEvaluations === 1 ? 'evaluación' : 'evaluaciones'} con {assignedPercentage}% asignado.
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
            {selectedCourseForEvaluations && (() => {
              const coursePeriod = periods.find(p => p.id === selectedCourseForEvaluations.periodId);
              const periodType = coursePeriod?.type || 'semestral';
              const maxPeriods = periodType === 'trimestral' ? 3 : 2;
              const periodLabel = periodType === 'trimestral' ? 'Cuatrimestre' : 'Semestre';
              
              return (
                <div className="space-y-2">
                  <Label htmlFor="evalPeriodNumber">{periodLabel} *</Label>
                  <Select
                    value={evaluationFormData.periodNumber}
                    onValueChange={(value) => {
                      const newFormData = { ...evaluationFormData, periodNumber: value };
                      // Si hay categoría seleccionada, validar y ajustar el porcentaje
                      if (newFormData.categoryId) {
                        const maxAvailable = getMaxAvailablePercentage(newFormData.categoryId, value);
                        const currentPercentage = parseInt(newFormData.percentage) || 0;
                        if (currentPercentage > maxAvailable) {
                          newFormData.percentage = maxAvailable > 0 ? maxAvailable.toString() : '';
                        }
                      }
                      setEvaluationFormData(newFormData);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Seleccionar ${periodLabel.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxPeriods }, (_, i) => i + 1).map((num) => {
                        const romanNum = num === 1 ? 'I' : num === 2 ? 'II' : 'III';
                        return (
                          <SelectItem key={num} value={num.toString()}>
                            {romanNum} {periodLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Período académico según la configuración del curso ({periodType === 'trimestral' ? 'Cuatrimestral' : 'Semestral'})
                  </p>
                </div>
              );
            })()}
            {(() => {
              const selectedType = activityTypes.find(t => t.id.toString() === evaluationFormData.activityTypeId);
              
              // Filtrar rúbricas SOLO por tipo de actividad seleccionado
              const filteredRubrics = evaluationFormData.activityTypeId
                ? rubrics.filter(r => 
                    r.activityTypeId && r.activityTypeId.toString() === evaluationFormData.activityTypeId
                  )
                : [];
              
              const hasNoRubrics = !!(evaluationFormData.activityTypeId && filteredRubrics.length === 0);
              const hasRubricSelected = !!evaluationFormData.rubricId;
              
              // Si hay tipo de actividad seleccionado, mostrar selector de rúbricas
              if (!evaluationFormData.activityTypeId) {
                return null;
              }
              
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="evalRubric">Rúbrica {hasNoRubrics ? '(Opcional)' : '*'}</Label>
                      <Select
                        value={evaluationFormData.rubricId || ''}
                        onValueChange={handleRubricChange}
                        disabled={hasNoRubrics}
                      >
                        <SelectTrigger className={hasNoRubrics ? 'border-yellow-500' : ''}>
                          <SelectValue placeholder="Seleccionar rúbrica" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredRubrics.length > 0 ? (
                            filteredRubrics.map((rubric) => (
                              <SelectItem key={rubric.id} value={rubric.id.toString()}>
                                {rubric.name} ({rubric.totalPoints} pts)
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>
                              No hay rúbricas disponibles
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {hasNoRubrics ? (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm font-medium text-yellow-800 mb-2">
                            ⚠️ No hay rúbricas creadas para "{selectedType?.name}"
                          </p>
                          <p className="text-xs text-yellow-700 mb-3">
                            Puedes crear una rúbrica para usar sus puntos automáticamente, o ingresar los puntos manualmente.
                          </p>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setEvaluationDialogOpen(false);
                              navigate('/rubricas');
                            }}
                            className="w-full"
                          >
                            Ir a Crear Rúbrica
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {filteredRubrics.length > 0 
                            ? `Rúbricas para ${selectedType?.name} (${filteredRubrics.length} disponible${filteredRubrics.length !== 1 ? 's' : ''})`
                            : 'Selecciona primero un tipo de actividad para ver las rúbricas disponibles'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evalTotalPoints">Total de Puntos *</Label>
                      <Input
                        id="evalTotalPoints"
                        type="number"
                        min="1"
                        value={evaluationFormData.totalPoints}
                        onChange={(e) => setEvaluationFormData({ ...evaluationFormData, totalPoints: e.target.value })}
                        placeholder="Total de puntos"
                        disabled={hasRubricSelected}
                        readOnly={hasRubricSelected}
                        className={hasRubricSelected ? 'bg-gray-100' : ''}
                      />
                      {hasRubricSelected ? (
                        <p className="text-xs text-green-600 font-medium">
                          ✓ Los puntos se toman automáticamente de la rúbrica seleccionada
                        </p>
                      ) : hasNoRubrics ? (
                        <p className="text-xs text-muted-foreground">
                          Ingresa manualmente el total de puntos (ej: 100)
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Se establecerán automáticamente al seleccionar una rúbrica, o ingresa manualmente
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvaluationDialogOpen(false)}>Cancelar</Button>
            {(() => {
              const selectedType = activityTypes.find(t => t.id.toString() === evaluationFormData.activityTypeId);
              const requiresRubric = selectedType?.allowsRubric === true || selectedType?.evaluationModel === 'RUBRICA_CRITERIOS';
              const filteredRubrics = evaluationFormData.activityTypeId
                ? rubrics.filter(r => 
                    r.activityTypeId && r.activityTypeId.toString() === evaluationFormData.activityTypeId
                  )
                : [];
              const hasNoRubrics = !!(evaluationFormData.activityTypeId && filteredRubrics.length === 0);
              const needsRubricButNone = requiresRubric && hasNoRubrics;
              const needsRubricButNotSelected = requiresRubric && !evaluationFormData.rubricId && !hasNoRubrics;
              
              return (
                <>
                  {needsRubricButNone && (
                    <p className="text-xs text-red-600 mr-auto">
                      ⚠️ Debes crear una rúbrica para este tipo de actividad antes de guardar
                    </p>
                  )}
                  {needsRubricButNotSelected && (
                    <p className="text-xs text-red-600 mr-auto">
                      ⚠️ Debes seleccionar una rúbrica para este tipo de actividad
                    </p>
                  )}
                  <Button
                    onClick={handleSaveEvaluation}
                    disabled={
                      isSavingEvaluation ||
                      !evaluationFormData.name ||
                      !evaluationFormData.categoryId ||
                      !evaluationFormData.percentage ||
                      !evaluationFormData.activityTypeId ||
                      !evaluationFormData.periodNumber ||
                      !evaluationFormData.totalPoints ||
                      needsRubricButNone ||
                      needsRubricButNotSelected
                    }
                  >
                    {isSavingEvaluation ? 'Guardando...' : 'Guardar'}
                  </Button>
                </>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Calificación */}
      <Dialog 
        open={gradingDialogOpen} 
        onOpenChange={(open) => {
          // NO permitir cerrar si está guardando
          if (!open && isSavingGrades) {
            return;
          }
          setGradingDialogOpen(open);
          if (!open && !isSavingGrades) {
            // Limpiar estado cuando se cierra (solo si no está guardando)
            setSelectedEvaluationForGrading(null);
            setStudentGrades([]);
            setGrades({});
            setIsSavingGrades(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Calificar: {selectedEvaluationForGrading?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedEvaluationForGrading?.rubric
                ? 'Califica a cada estudiante según los criterios de la rúbrica'
                : 'Ingresa la calificación directa para cada estudiante'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedEvaluationForGrading ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Cargando información de la evaluación...</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {selectedEvaluationForGrading?.rubric && (
                  <Card className="mb-4 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-sm">Rúbrica: {selectedEvaluationForGrading.rubric.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Total: {selectedEvaluationForGrading.totalPoints} puntos
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedEvaluationForGrading.rubric.criteria && selectedEvaluationForGrading.rubric.criteria.length > 0 ? (
                          selectedEvaluationForGrading.rubric.criteria.map((criterion: any) => (
                            <div key={criterion.id} className="text-xs">
                              <div className="font-medium text-blue-700">{criterion.name}: {criterion.points} pts</div>
                              {criterion.subCriteria && criterion.subCriteria.length > 0 && (
                                <div className="ml-3 mt-1 space-y-1">
                                  {criterion.subCriteria.map((subCriterion: any) => (
                                    <div key={subCriterion.id} className="text-green-700">
                                      • {subCriterion.name}: {subCriterion.points} pts
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No hay criterios definidos en esta rúbrica</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <div className="space-y-3">
                  {studentGrades.length === 0 ? (
                    <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground mb-4">
                      No hay estudiantes inscritos en este curso.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Por favor, agrega estudiantes al curso antes de calificar.
                    </p>
                  </CardContent>
                    </Card>
                  ) : (
                    studentGrades.map((student: any) => {
                      const studentGrade = grades[student.studentId] || { score: 0, criteriaScores: {} };
                      const hasRubric = selectedEvaluationForGrading?.rubric;
                      
                      return (
                        <Card key={student.studentId}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{student.student.fullName}</p>
                                  <p className="text-sm text-muted-foreground">{student.student.identifier}</p>
                                </div>
                                {!hasRubric && (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={selectedEvaluationForGrading?.totalPoints || 100}
                                      value={studentGrade.score || ''}
                                      disabled={isSavingGrades}
                                      onChange={(e) => {
                                        const score = parseFloat(e.target.value) || 0;
                                        setGrades({
                                          ...grades,
                                          [student.studentId]: { score },
                                        });
                                      }}
                                      className="w-24"
                                      placeholder="Puntos"
                                    />
                                    <span className="text-sm text-muted-foreground">
                                      / {selectedEvaluationForGrading?.totalPoints || 100}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {hasRubric && selectedEvaluationForGrading.rubric.criteria && (
                                <div className="space-y-3 border-t pt-3">
                                  {selectedEvaluationForGrading.rubric.criteria.map((criterion: any) => {
                                    const hasSubCriteria = criterion.subCriteria && criterion.subCriteria.length > 0;
                                    // Calcular el score del criterio: si tiene subcriterios, sumarlos; si no, usar el score directo
                                    let criterionScore = 0;
                                    if (hasSubCriteria && studentGrade.subCriteriaScores) {
                                      criterionScore = criterion.subCriteria.reduce((sum: number, sc: any) => {
                                        return sum + (studentGrade.subCriteriaScores![sc.id] || 0);
                                      }, 0);
                                    } else {
                                      criterionScore = studentGrade.criteriaScores?.[criterion.id] || 0;
                                    }
                                    
                                    return (
                                      <div key={criterion.id} className="border rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex-1">
                                            <p className="text-sm font-semibold text-blue-700">{criterion.name}</p>
                                            {criterion.description && (
                                              <p className="text-xs text-muted-foreground">{criterion.description}</p>
                                            )}
                                          </div>
                                          {!hasSubCriteria && (
                                            <div className="flex items-center gap-2">
                                              <Input
                                                type="number"
                                                min="0"
                                                max={criterion.points}
                                                value={criterionScore || ''}
                                                disabled={isSavingGrades}
                                                onChange={(e) => {
                                                  let score = parseFloat(e.target.value) || 0;
                                                  
                                                  // VALIDAR: No permitir exceder el máximo del criterio
                                                  if (score > criterion.points) {
                                                    score = criterion.points;
                                                    alert(`⚠️ El puntaje máximo para "${criterion.name}" es ${criterion.points} puntos.`);
                                                  }
                                                  
                                                  // VALIDAR: No permitir valores negativos
                                                  if (score < 0) {
                                                    score = 0;
                                                  }
                                                  
                                                  const newCriteriaScores = {
                                                    ...(studentGrade.criteriaScores || {}),
                                                    [criterion.id]: score,
                                                  };
                                                  // Calcular total
                                                  const total = Object.values(newCriteriaScores).reduce((sum: number, s: any) => sum + (s || 0), 0);
                                                  setGrades({
                                                    ...grades,
                                                    [student.studentId]: {
                                                      score: total,
                                                      criteriaScores: newCriteriaScores,
                                                    },
                                                  });
                                                }}
                                                className="w-20"
                                                placeholder="0"
                                              />
                                              <span className="text-sm text-muted-foreground">
                                                / {criterion.points}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Mostrar subcriterios si existen */}
                                        {hasSubCriteria && (
                                          <div className="ml-4 space-y-2 mt-2 border-l-2 border-green-300 pl-3">
                                            {criterion.subCriteria.map((subCriterion: any) => {
                                              const subCriterionScore = studentGrade.subCriteriaScores?.[subCriterion.id] || 0;
                                              const subCriterionKey = `${student.studentId}-${subCriterion.id}`;
                                              const isExpanded = expandedSubCriteria.has(subCriterionKey);
                                              
                                              return (
                                                <div key={subCriterion.id} className="bg-green-50 rounded border border-green-200">
                                                  {/* Header del subcriterio - siempre visible */}
                                                  <div className="flex items-center justify-between p-2">
                                                    <div className="flex items-center gap-2 flex-1">
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 w-5 p-0"
                                                        onClick={() => {
                                                          const newExpanded = new Set(expandedSubCriteria);
                                                          if (isExpanded) {
                                                            newExpanded.delete(subCriterionKey);
                                                          } else {
                                                            newExpanded.add(subCriterionKey);
                                                          }
                                                          setExpandedSubCriteria(newExpanded);
                                                        }}
                                                      >
                                                        {isExpanded ? (
                                                          <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                          <ChevronRight className="h-4 w-4" />
                                                        )}
                                                      </Button>
                                                      <p className="text-xs font-medium text-green-800">{subCriterion.name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        max={subCriterion.points}
                                                        value={subCriterionScore || ''}
                                                        disabled={isSavingGrades}
                                                        onChange={(e) => {
                                                          let score = parseFloat(e.target.value) || 0;
                                                          
                                                          // VALIDAR: No permitir exceder el máximo del subcriterio
                                                          if (score > subCriterion.points) {
                                                            score = subCriterion.points;
                                                            alert(`⚠️ El puntaje máximo para "${subCriterion.name}" es ${subCriterion.points} puntos.`);
                                                          }
                                                          
                                                          // VALIDAR: No permitir valores negativos
                                                          if (score < 0) {
                                                            score = 0;
                                                          }
                                                          
                                                          const newSubCriteriaScores = {
                                                            ...(studentGrade.subCriteriaScores || {}),
                                                            [subCriterion.id]: score,
                                                          };
                                                          
                                                          // Calcular total del criterio sumando subcriterios
                                                          const criterionSubTotal = criterion.subCriteria.reduce((sum: number, sc: any) => {
                                                            return sum + (newSubCriteriaScores[sc.id] || 0);
                                                          }, 0);
                                                          
                                                          // VALIDAR: No permitir que el total del criterio exceda su máximo
                                                          if (criterionSubTotal > criterion.points) {
                                                            // Ajustar el score actual para que el total no exceda
                                                            const maxAllowed = criterion.points - (criterionSubTotal - score);
                                                            if (maxAllowed < 0) {
                                                              score = 0;
                                                            } else if (score > maxAllowed) {
                                                              score = maxAllowed;
                                                              alert(`⚠️ El total del criterio "${criterion.name}" no puede exceder ${criterion.points} puntos. Ajustado a ${score}.`);
                                                            }
                                                            // Recalcular con el score ajustado
                                                            const adjustedSubCriteriaScores = {
                                                              ...newSubCriteriaScores,
                                                              [subCriterion.id]: score,
                                                            };
                                                            const adjustedCriterionSubTotal = criterion.subCriteria.reduce((sum: number, sc: any) => {
                                                              return sum + (adjustedSubCriteriaScores[sc.id] || 0);
                                                            }, 0);
                                                            
                                                            const newCriteriaScores = {
                                                              ...(studentGrade.criteriaScores || {}),
                                                              [criterion.id]: adjustedCriterionSubTotal,
                                                            };
                                                            
                                                            const total = Object.values(newCriteriaScores).reduce((sum: number, s: any) => sum + (s || 0), 0);
                                                            
                                                            setGrades({
                                                              ...grades,
                                                              [student.studentId]: {
                                                                score: total,
                                                                criteriaScores: newCriteriaScores,
                                                                subCriteriaScores: adjustedSubCriteriaScores,
                                                              },
                                                            });
                                                            return;
                                                          }
                                                          
                                                          // Actualizar score del criterio
                                                          const newCriteriaScores = {
                                                            ...(studentGrade.criteriaScores || {}),
                                                            [criterion.id]: criterionSubTotal,
                                                          };
                                                          
                                                          // Calcular total general
                                                          const total = Object.values(newCriteriaScores).reduce((sum: number, s: any) => sum + (s || 0), 0);
                                                          
                                                          setGrades({
                                                            ...grades,
                                                            [student.studentId]: {
                                                              score: total,
                                                              criteriaScores: newCriteriaScores,
                                                              subCriteriaScores: newSubCriteriaScores,
                                                            },
                                                          });
                                                        }}
                                                        className="w-16 h-8 text-xs"
                                                        placeholder="0"
                                                      />
                                                      <span className="text-xs text-muted-foreground">
                                                        / {subCriterion.points}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  {/* Descripción - solo visible si está expandido */}
                                                  {isExpanded && subCriterion.description && (
                                                    <div className="px-2 pb-2 pt-1 border-t border-green-200">
                                                      <p className="text-xs text-green-600">{subCriterion.description}</p>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                      </div>
                                    )}
                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-green-200">
                                      <span className="text-xs font-medium text-green-700">Subtotal {criterion.name}:</span>
                                      <span className="text-xs font-bold text-green-700">
                                        {criterionScore} / {criterion.points}
                                      </span>
                                    </div>
                                    </div>
                                  );
                                })}
                                  <div className="flex items-center justify-end gap-4 border-t-2 pt-3 mt-3 bg-blue-50 p-3 rounded-lg">
                                    <div className="text-right">
                                      <span className="text-sm font-medium text-gray-700">Total: </span>
                                      <span className="text-lg font-bold text-blue-700">
                                        {studentGrade.score || 0} / {selectedEvaluationForGrading?.totalPoints || 0}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-sm font-medium text-gray-700">Porcentaje: </span>
                                      <span className="text-lg font-bold text-green-700">
                                        {selectedEvaluationForGrading?.totalPoints 
                                          ? `${((studentGrade.score || 0) / selectedEvaluationForGrading.totalPoints * 100).toFixed(1)}%`
                                          : '0%'}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-sm font-medium text-gray-700">Nota: </span>
                                      <span className="text-lg font-bold text-purple-700">
                                        {selectedEvaluationForGrading?.totalPoints 
                                          ? Math.round((studentGrade.score || 0) / selectedEvaluationForGrading.totalPoints * 100)
                                          : 0}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveGrades}
              disabled={isSavingGrades}
            >
              {isSavingGrades ? 'Guardando...' : 'Guardar Calificaciones'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Vista de Calificaciones */}
      <Dialog open={gradesViewOpen} onOpenChange={setGradesViewOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Calificaciones - {selectedCourseForGrades ? getCourseDisplayName(selectedCourseForGrades) : ''}
            </DialogTitle>
            <DialogDescription>
              Vista completa de calificaciones por estudiante. Las notas finales se calculan automáticamente según la distribución.
            </DialogDescription>
          </DialogHeader>
          {courseGradesData && (
            <div className="space-y-4 py-4">
              {/* Resumen de distribución */}
              {courseGradesData.distribution && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Distribución: {courseGradesData.distribution.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {courseGradesData.distribution.categories?.map((cat: any) => (
                        <span key={cat.id} className="px-3 py-1 bg-blue-100 rounded-full text-sm font-medium">
                          {cat.name}: {cat.percentage}%
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabla de calificaciones */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left font-semibold sticky left-0 bg-gray-100 z-10">
                        Estudiante
                      </th>
                      {courseGradesData.evaluations.map((evaluation: any) => (
                        <th key={evaluation.id} className="border p-2 text-center font-semibold min-w-[120px]">
                          <div className="flex flex-col">
                            <span className="text-xs font-normal text-muted-foreground">{evaluation.category?.name}</span>
                            <span className="text-sm">{evaluation.name}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {evaluation.percentage}% • {evaluation.totalPoints || 100} pts
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="border p-2 text-center font-semibold bg-green-50 sticky right-0 z-10">
                        <div className="flex flex-col">
                          <span className="text-sm">Nota Final</span>
                          <span className="text-xs font-normal text-muted-foreground">% • Letra</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseGradesData.students.map((studentCourse: any) => {
                      const studentId = studentCourse.studentId;
                      const finalGrade = calculateFinalGrade(
                        studentId,
                        courseGradesData.evaluations,
                        courseGradesData.grades
                      );

                      return (
                        <tr key={studentId} className="hover:bg-gray-50">
                          <td className="border p-2 sticky left-0 bg-white z-10">
                            <div>
                              <p className="font-medium">{studentCourse.student.fullName}</p>
                              <p className="text-xs text-muted-foreground">{studentCourse.student.identifier}</p>
                            </div>
                          </td>
                          {courseGradesData.evaluations.map((evaluation: any) => {
                            const grade = courseGradesData.grades.find(
                              (g: any) => g.evaluationId === evaluation.id && g.studentId === studentId
                            );
                            const percentage = grade
                              ? ((grade.score / grade.totalScore) * 100).toFixed(1)
                              : '-';
                            const score = grade ? `${grade.score}/${grade.totalScore}` : '-';

                            return (
                              <td key={evaluation.id} className="border p-2 text-center">
                                <div className="flex flex-col items-center">
                                  <span className="font-medium">{score}</span>
                                  <span className="text-xs text-muted-foreground">{percentage}%</span>
                                  {!grade && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1 h-6 text-xs"
                                      onClick={() => {
                                        handleOpenGradingDialog(evaluation);
                                        setGradesViewOpen(false);
                                      }}
                                    >
                                      Calificar
                                    </Button>
                                  )}
                                  {grade && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1 h-6 text-xs"
                                      onClick={() => {
                                        handleOpenGradingDialog(evaluation);
                                        setGradesViewOpen(false);
                                      }}
                                    >
                                      Editar
                                    </Button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="border p-2 text-center bg-green-50 sticky right-0 z-10">
                            {finalGrade ? (
                              <div className="flex flex-col items-center">
                                <span className={`font-bold text-lg ${finalGrade.status === 'Aprobado' ? 'text-green-600' : 'text-red-600'}`}>
                                  {finalGrade.percentage.toFixed(1)}%
                                </span>
                                <span className="text-sm font-semibold">{finalGrade.letter}</span>
                                <span className={`text-xs ${finalGrade.status === 'Aprobado' ? 'text-green-600' : 'text-red-600'}`}>
                                  {finalGrade.status}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Sin calificaciones</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen por categoría */}
              {courseGradesData.distribution?.categories && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {courseGradesData.distribution.categories.map((category: any) => {
                    const categoryEvaluations = courseGradesData.evaluations.filter(
                      (e: any) => e.categoryId === category.id
                    );
                    const categoryGrades = courseGradesData.grades.filter((g: any) =>
                      categoryEvaluations.some((e: any) => e.id === g.evaluationId)
                    );

                    return (
                      <Card key={category.id} className="bg-gray-50">
                        <CardHeader>
                          <CardTitle className="text-sm">{category.name} ({category.percentage}%)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1 text-xs">
                            <p>Evaluaciones: {categoryEvaluations.length}</p>
                            <p>Calificaciones: {categoryGrades.length}</p>
                            {categoryEvaluations.length > 0 && (
                              <div className="mt-2 space-y-1">
                            {categoryEvaluations.map((evaluation: any) => (
                              <div key={evaluation.id} className="flex justify-between">
                                <span>{evaluation.name}</span>
                                <span className="text-muted-foreground">{evaluation.percentage}%</span>
                              </div>
                            ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradesViewOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
