import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, ClipboardList, X, FileText, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { rubricTemplates, type RubricTemplate } from '@/data/rubric-templates';

interface SubCriterion {
  name: string;
  description: string;
  points: number;
  orderIndex: number;
}

interface Criterion {
  name: string;
  description: string;
  points: number;
  orderIndex: number;
  subCriteria?: SubCriterion[];
}

export default function Rubricas() {
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<any>(null);
  const [creationMode, setCreationMode] = useState<'template' | 'new' | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<RubricTemplate | any | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    activityTypeId: '',
    totalPoints: '',
  });
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [newCriterion, setNewCriterion] = useState({ name: '', description: '', points: '' });
  const [expandedCriteria, setExpandedCriteria] = useState<Set<number>>(new Set());
  const [newSubCriterion, setNewSubCriterion] = useState<{ [key: number]: { name: string; description: string; points: string } }>({});
  const [originalTemplateState, setOriginalTemplateState] = useState<{
    name: string;
    totalPoints: number;
    criteria: Criterion[];
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rubricsData, templatesData, activityTypesData] = await Promise.all([
        ipc.rubrics.getAll().catch(() => []),
        ipc.rubrics.getTemplates().catch(() => []),
        ipc.activityTypes.getActive().catch(() => []),
      ]);
      setRubrics(rubricsData || []);
      setSavedTemplates(templatesData || []);
      setActivityTypes(activityTypesData || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setRubrics([]);
      setSavedTemplates([]);
      setActivityTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rubric?: any) => {
    if (rubric) {
      // Modo edición - solo para rúbricas normales, no plantillas
      // Si es una plantilla, no permitir edición directa
      if (rubric.isTemplate) {
        // Cargar como plantilla en lugar de editar
        handleSelectTemplate(rubric);
        setDialogOpen(true);
        return;
      }
      
      setEditingRubric(rubric);
      setCreationMode(null);
      setSelectedTemplate(null);
      setOriginalTemplateState(null);
      setSaveAsTemplate(false);
      setFormData({
        name: rubric.name || '',
        description: rubric.description || '',
        activityTypeId: rubric.activityTypeId?.toString() || '',
        totalPoints: rubric.totalPoints?.toString() || '',
      });
      setCriteria(
        (rubric.criteria || []).map((crit: any, index: number) => ({
          name: crit.name || '',
          description: crit.description || '',
          points: crit.points || 0,
          orderIndex: crit.orderIndex !== undefined ? crit.orderIndex : index,
          subCriteria: (crit.subCriteria || []).map((sub: any, subIndex: number) => ({
            name: sub.name || '',
            description: sub.description || '',
            points: sub.points || 0,
            orderIndex: sub.orderIndex !== undefined ? sub.orderIndex : subIndex,
          })),
        }))
      );
      setDialogOpen(true);
    } else {
      // Modo creación - mostrar opciones
      setEditingRubric(null);
      setCreationMode(null);
      setSelectedTemplate(null);
      setOriginalTemplateState(null);
      setSaveAsTemplate(false);
      setFormData({
        name: '',
        description: '',
        activityTypeId: '',
        totalPoints: '',
      });
      setCriteria([]);
      setNewCriterion({ name: '', description: '', points: '' });
      setDialogOpen(true);
    }
  };

  const handleSelectTemplate = (template: RubricTemplate | any) => {
    setSelectedTemplate(template);
    setCreationMode('template');
    setEditingRubric(null); // No estamos editando, estamos creando desde plantilla
    
    let loadedCriteria: Criterion[] = [];
    
    // Si es una plantilla guardada (tiene id numérico), usar directamente
    if (template.id && typeof template.id === 'number') {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        activityTypeId: template.activityTypeId?.toString() || '',
        totalPoints: template.totalPoints?.toString() || '',
      });
      loadedCriteria = (template.criteria || []).map((crit: any, index: number) => ({
        name: crit.name || '',
        description: crit.description || '',
        points: crit.points || 0,
        orderIndex: crit.orderIndex !== undefined ? crit.orderIndex : index,
      }));
    } else {
      // Es una plantilla precargada (tiene id string o no tiene id)
      const activityType = activityTypes.find(
        (at) => at.name.toLowerCase() === template.activityType?.toLowerCase()
      );
      
      setFormData({
        name: template.name,
        description: template.description,
        activityTypeId: activityType?.id?.toString() || '',
        totalPoints: template.totalPoints.toString(),
      });
      
      loadedCriteria = template.criteria.map((crit: any, index: number) => ({
        name: crit.name,
        description: crit.description || '',
        points: crit.points,
        orderIndex: index,
        subCriteria: (crit.subCriteria || []).map((sub: any, subIndex: number) => ({
          name: sub.name,
          description: sub.description || '',
          points: sub.points,
          orderIndex: subIndex,
        })),
      }));
    }
    
    setCriteria(loadedCriteria);
    
    // Guardar estado original para detectar cambios (usar valores de template, no formData)
    const templateName = template.id && typeof template.id === 'number' 
      ? template.name 
      : template.name;
    const templateTotalPoints = template.id && typeof template.id === 'number'
      ? template.totalPoints
      : template.totalPoints;
    
    setOriginalTemplateState({
      name: templateName,
      totalPoints: templateTotalPoints,
      criteria: loadedCriteria.map(c => ({ ...c })), // Copia profunda
    });
    
    // Si es una plantilla guardada, activar automáticamente "guardar como plantilla"
    if (template.id && typeof template.id === 'number') {
      setSaveAsTemplate(true);
    } else {
      setSaveAsTemplate(false);
    }
  };

  const handleTemplateClick = (template: RubricTemplate | any) => {
    handleSelectTemplate(template);
  };

  const isTemplateSelected = (template: RubricTemplate | any) => {
    if (!selectedTemplate) return false;
    // Si tiene id numérico, es una plantilla guardada
    if (template.id && typeof template.id === 'number') {
      return selectedTemplate.id === template.id;
    }
    // Si tiene id string, es una plantilla precargada
    if (template.id && typeof template.id === 'string') {
      return selectedTemplate.id === template.id;
    }
    return false;
  };

  const handleStartNew = () => {
    setCreationMode('new');
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      activityTypeId: '',
      totalPoints: '',
    });
    setCriteria([]);
  };

  const handleAddCriterion = () => {
    if (!newCriterion.name || !newCriterion.points) {
      alert('Nombre y puntos son requeridos');
      return;
    }

    const points = parseInt(newCriterion.points);
    if (isNaN(points) || points <= 0) {
      alert('Los puntos deben ser un número positivo');
      return;
    }

    setCriteria([
      ...criteria,
      {
        name: newCriterion.name,
        description: newCriterion.description,
        points: points,
        orderIndex: criteria.length,
        subCriteria: [],
      },
    ]);
    setNewCriterion({ name: '', description: '', points: '' });
  };

  const handleAddSubCriterion = (criterionIndex: number) => {
    const subCrit = newSubCriterion[criterionIndex];
    if (!subCrit || !subCrit.name || !subCrit.points) {
      alert('Nombre y puntos son requeridos');
      return;
    }

    const points = parseInt(subCrit.points);
    if (isNaN(points) || points <= 0) {
      alert('Los puntos deben ser un número positivo');
      return;
    }

    const updatedCriteria = [...criteria];
    const criterion = updatedCriteria[criterionIndex];
    const currentSubCriteria = criterion.subCriteria || [];
    const totalSubPoints = currentSubCriteria.reduce((sum, sub) => sum + sub.points, 0) + points;

    if (totalSubPoints > criterion.points) {
      alert(`La suma de subcriterios (${totalSubPoints}) no puede exceder los puntos del criterio (${criterion.points})`);
      return;
    }

    updatedCriteria[criterionIndex] = {
      ...criterion,
      subCriteria: [
        ...currentSubCriteria,
        {
          name: subCrit.name,
          description: subCrit.description,
          points: points,
          orderIndex: currentSubCriteria.length,
        },
      ],
    };

    setCriteria(updatedCriteria);
    setNewSubCriterion({ ...newSubCriterion, [criterionIndex]: { name: '', description: '', points: '' } });
  };

  const handleRemoveSubCriterion = (criterionIndex: number, subCriterionIndex: number) => {
    const updatedCriteria = [...criteria];
    const criterion = updatedCriteria[criterionIndex];
    if (criterion.subCriteria) {
      criterion.subCriteria = criterion.subCriteria.filter((_, i) => i !== subCriterionIndex)
        .map((sub, i) => ({ ...sub, orderIndex: i }));
      updatedCriteria[criterionIndex] = criterion;
      setCriteria(updatedCriteria);
    }
  };

  const handleUpdateSubCriterionPoints = (criterionIndex: number, subCriterionIndex: number, newPoints: number) => {
    if (isNaN(newPoints) || newPoints <= 0) {
      return;
    }

    const updatedCriteria = [...criteria];
    const criterion = updatedCriteria[criterionIndex];
    if (criterion.subCriteria) {
      const totalSubPoints = criterion.subCriteria.reduce((sum, sub, idx) => 
        sum + (idx === subCriterionIndex ? newPoints : sub.points), 0);

      if (totalSubPoints > criterion.points) {
        alert(`La suma de subcriterios (${totalSubPoints}) no puede exceder los puntos del criterio (${criterion.points})`);
        return;
      }

      criterion.subCriteria[subCriterionIndex] = {
        ...criterion.subCriteria[subCriterionIndex],
        points: newPoints,
      };
      updatedCriteria[criterionIndex] = criterion;
      setCriteria(updatedCriteria);
    }
  };

  const toggleCriterionExpanded = (index: number) => {
    const newExpanded = new Set(expandedCriteria);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCriteria(newExpanded);
  };

  const getSubCriteriaTotal = (criterion: Criterion) => {
    return (criterion.subCriteria || []).reduce((sum, sub) => sum + sub.points, 0);
  };

  const handleUpdateCriterionPoints = (index: number, newPoints: number) => {
    if (isNaN(newPoints) || newPoints <= 0) {
      return;
    }
    const updatedCriteria = [...criteria];
    updatedCriteria[index] = {
      ...updatedCriteria[index],
      points: newPoints,
    };
    setCriteria(updatedCriteria);
  };

  const handleUpdateTotalPoints = (value: string | number) => {
    const newTotal = typeof value === 'string' ? (value === '' ? 0 : parseInt(value)) : value;
    if (isNaN(newTotal) || newTotal <= 0) {
      if (value === '' || value === 0) {
        setFormData({ ...formData, totalPoints: '' });
      }
      return;
    }
    setFormData({ ...formData, totalPoints: newTotal.toString() });
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index).map((crit, i) => ({ ...crit, orderIndex: i })));
  };

  const getTotalPoints = () => {
    return criteria.reduce((sum, crit) => sum + crit.points, 0);
  };

  const hasTemplateChanged = (): boolean => {
    if (!originalTemplateState || !selectedTemplate) return false;
    
    // Comparar nombre
    if (formData.name !== originalTemplateState.name) return true;
    
    // Comparar total de puntos
    const currentTotal = parseInt(formData.totalPoints || '0');
    if (currentTotal !== originalTemplateState.totalPoints) return true;
    
    // Comparar criterios
    if (criteria.length !== originalTemplateState.criteria.length) return true;
    
    for (let i = 0; i < criteria.length; i++) {
      const current = criteria[i];
      const original = originalTemplateState.criteria[i];
      if (!original) return true;
      
      if (current.name !== original.name ||
          current.points !== original.points ||
          current.description !== original.description) {
        return true;
      }
    }
    
    return false;
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.totalPoints) {
        alert('Nombre y total de puntos son requeridos');
        return;
      }

      if (criteria.length === 0) {
        alert('Debe agregar al menos un criterio');
        return;
      }

      const totalPoints = parseInt(formData.totalPoints);
      const criteriaTotal = getTotalPoints();

      if (criteriaTotal !== totalPoints) {
        alert(`La suma de puntos de los criterios (${criteriaTotal}) debe coincidir con el total de puntos (${totalPoints})`);
        return;
      }

      // Validar que la suma de subcriterios coincida con los puntos del criterio padre
      for (const criterion of criteria) {
        if (criterion.subCriteria && criterion.subCriteria.length > 0) {
          const subCriteriaTotal = getSubCriteriaTotal(criterion);
          if (subCriteriaTotal !== criterion.points) {
            alert(`En el criterio "${criterion.name}": La suma de puntos de los subcriterios (${subCriteriaTotal}) debe coincidir con los puntos del criterio (${criterion.points})`);
            return;
          }
        }
      }

      // Si estamos editando una rúbrica normal (no plantilla), actualizar normalmente
      if (editingRubric && !selectedTemplate) {
        const data = {
          name: formData.name,
          description: formData.description || undefined,
          activityTypeId: formData.activityTypeId && formData.activityTypeId !== 'none' ? parseInt(formData.activityTypeId) : undefined,
          totalPoints: totalPoints,
          isTemplate: saveAsTemplate,
        criteria: criteria.map((crit, index) => ({
          name: crit.name,
          description: crit.description || undefined,
          points: crit.points,
          orderIndex: index,
          subCriteria: crit.subCriteria?.map((sub, subIndex) => ({
            name: sub.name,
            description: sub.description || undefined,
            points: sub.points,
            orderIndex: subIndex,
          })),
        })),
        };
        await ipc.rubrics.update(editingRubric.id, data);
        setDialogOpen(false);
        loadData();
        return;
      }

      // Si se cargó una plantilla (precargada o guardada) y se modificó
      if (selectedTemplate && hasTemplateChanged()) {
        // Si es una plantilla guardada y se modificó, pedir cambio de nombre
        if (selectedTemplate.id && typeof selectedTemplate.id === 'number') {
          const originalName = originalTemplateState?.name || selectedTemplate.name;
          if (formData.name === originalName) {
            const newName = prompt(
              `Has modificado la plantilla "${originalName}". Por favor, cambia el nombre para crear una nueva plantilla:`,
              `${originalName} (Copia)`
            );
            if (!newName || newName.trim() === '') {
              alert('Debes cambiar el nombre para crear una nueva plantilla');
              return;
            }
            if (newName === originalName) {
              alert('El nombre debe ser diferente al original');
              return;
            }
            setFormData({ ...formData, name: newName.trim() });
          }
        }
        
        // Crear nueva plantilla (no editar la original)
        const data = {
          name: formData.name,
          description: formData.description || undefined,
          activityTypeId: formData.activityTypeId && formData.activityTypeId !== 'none' ? parseInt(formData.activityTypeId) : undefined,
          totalPoints: totalPoints,
          isTemplate: saveAsTemplate || true, // Si viene de plantilla, guardar como plantilla
        criteria: criteria.map((crit, index) => ({
          name: crit.name,
          description: crit.description || undefined,
          points: crit.points,
          orderIndex: index,
          subCriteria: crit.subCriteria?.map((sub, subIndex) => ({
            name: sub.name,
            description: sub.description || undefined,
            points: sub.points,
            orderIndex: subIndex,
          })),
        })),
        };
        await ipc.rubrics.create(data);
      } else if (selectedTemplate && !hasTemplateChanged()) {
        // No se modificó, solo guardar si se marcó como plantilla
        if (saveAsTemplate) {
          const data = {
            name: formData.name,
            description: formData.description || undefined,
            activityTypeId: formData.activityTypeId && formData.activityTypeId !== 'none' ? parseInt(formData.activityTypeId) : undefined,
            totalPoints: totalPoints,
            isTemplate: true,
        criteria: criteria.map((crit, index) => ({
          name: crit.name,
          description: crit.description || undefined,
          points: crit.points,
          orderIndex: index,
          subCriteria: crit.subCriteria?.map((sub, subIndex) => ({
            name: sub.name,
            description: sub.description || undefined,
            points: sub.points,
            orderIndex: subIndex,
          })),
        })),
          };
          await ipc.rubrics.create(data);
        } else {
          // Solo crear rúbrica normal sin plantilla
          const data = {
            name: formData.name,
            description: formData.description || undefined,
            activityTypeId: formData.activityTypeId && formData.activityTypeId !== 'none' ? parseInt(formData.activityTypeId) : undefined,
            totalPoints: totalPoints,
            isTemplate: false,
        criteria: criteria.map((crit, index) => ({
          name: crit.name,
          description: crit.description || undefined,
          points: crit.points,
          orderIndex: index,
          subCriteria: crit.subCriteria?.map((sub, subIndex) => ({
            name: sub.name,
            description: sub.description || undefined,
            points: sub.points,
            orderIndex: subIndex,
          })),
        })),
          };
          await ipc.rubrics.create(data);
        }
      } else {
        // Creación normal (sin plantilla)
        const data = {
          name: formData.name,
          description: formData.description || undefined,
          activityTypeId: formData.activityTypeId && formData.activityTypeId !== 'none' ? parseInt(formData.activityTypeId) : undefined,
          totalPoints: totalPoints,
          isTemplate: saveAsTemplate,
        criteria: criteria.map((crit, index) => ({
          name: crit.name,
          description: crit.description || undefined,
          points: crit.points,
          orderIndex: index,
          subCriteria: crit.subCriteria?.map((sub, subIndex) => ({
            name: sub.name,
            description: sub.description || undefined,
            points: sub.points,
            orderIndex: subIndex,
          })),
        })),
        };
        await ipc.rubrics.create(data);
      }

      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error guardando rúbrica:', error);
      alert(error.message || 'Error al guardar la rúbrica');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta rúbrica? Se eliminará de todas las evaluaciones que la usen.')) return;
    try {
      await ipc.rubrics.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando rúbrica:', error);
      alert('Error al eliminar la rúbrica');
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rúbricas</h1>
          <p className="text-muted-foreground mt-2">
            Crea rúbricas reutilizables para evaluar trabajos, exámenes y proyectos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Rúbrica
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRubric ? 'Editar Rúbrica' : 'Nueva Rúbrica'}</DialogTitle>
              <DialogDescription>
                {editingRubric
                  ? 'Modifica la rúbrica y sus criterios de evaluación'
                  : creationMode === null
                  ? 'Elige una plantilla precargada o crea una rúbrica desde cero'
                  : creationMode === 'template'
                  ? 'Personaliza la plantilla seleccionada y ajusta los puntajes según tus necesidades'
                  : 'Crea una nueva rúbrica reutilizable para evaluaciones'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Mostrar opciones de creación solo si no está editando y no ha elegido modo */}
              {!editingRubric && creationMode === null && (
                <div className="space-y-4">
                  <div className="flex gap-2 border-b">
                    <div className="flex-1 text-center py-2 px-4 border-b-2 border-primary font-medium">
                      <FileText className="h-4 w-4 inline mr-2" />
                      Usar Plantilla
                    </div>
                    <Button
                      variant="ghost"
                      className="rounded-b-none"
                      onClick={handleStartNew}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Crear Nueva
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Selecciona una plantilla precargada o una que hayas guardado anteriormente. Puedes modificar los puntajes después.
                    </p>
                    
                    {/* Plantillas guardadas */}
                    {savedTemplates.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">Mis Plantillas Guardadas</h4>
                        <div className="grid gap-3 md:grid-cols-2 max-h-[200px] overflow-y-auto">
                          {savedTemplates.map((template) => (
                            <Card
                              key={template.id}
                              className={`cursor-pointer transition-all hover:border-primary ${
                                selectedTemplate?.id === template.id ? 'border-primary border-2' : ''
                              }`}
                              onClick={() => handleTemplateClick(template)}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">{template.name}</CardTitle>
                                  {template.activityType && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      {template.activityType.name}
                                    </span>
                                  )}
                                </div>
                                {template.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {template.description}
                                  </p>
                                )}
                              </CardHeader>
                              <CardContent className="pt-0">
                                <p className="text-sm font-semibold mb-2">
                                  Total: {template.totalPoints} puntos
                                </p>
                                <div className="space-y-1">
                                  {template.criteria?.map((crit: any, idx: number) => (
                                    <div key={idx} className="text-xs text-muted-foreground">
                                      • {crit.name}: {crit.points} pts
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Plantillas precargadas */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Plantillas Precargadas</h4>
                      <div className="grid gap-3 md:grid-cols-2 max-h-[400px] overflow-y-auto">
                        {rubricTemplates.map((template) => (
                          <Card
                            key={template.id}
                            className={`cursor-pointer transition-all hover:border-primary ${
                              isTemplateSelected(template) ? 'border-primary border-2' : ''
                            }`}
                            onClick={() => handleTemplateClick(template)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{template.name}</CardTitle>
                                {template.activityType && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {template.activityType}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.description}
                              </p>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm font-semibold mb-2">
                                Total: {template.totalPoints} puntos
                              </p>
                              <div className="space-y-1">
                                {template.criteria.map((crit, idx) => (
                                  <div key={idx} className="text-xs text-muted-foreground">
                                    • {crit.name}: {crit.points} pts
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                    {selectedTemplate && creationMode === 'template' && (
                      <div className={`p-3 border rounded-lg ${
                        hasTemplateChanged() 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <p className={`text-sm mb-2 ${
                          hasTemplateChanged() ? 'text-yellow-800' : 'text-green-800'
                        }`}>
                          {hasTemplateChanged() ? (
                            <>
                              ⚠️ Has modificado la plantilla "{originalTemplateState?.name || selectedTemplate.name}". 
                              Se creará una nueva plantilla al guardar.
                              {selectedTemplate.id && typeof selectedTemplate.id === 'number' && 
                                formData.name === originalTemplateState?.name && (
                                <span className="block mt-1 font-semibold">
                                  Por favor, cambia el nombre antes de guardar.
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              ✓ Plantilla "{selectedTemplate.name}" cargada. 
                              {(!selectedTemplate.id || typeof selectedTemplate.id === 'string')
                                ? ' Plantilla precargada del sistema. Cualquier cambio creará una nueva plantilla.'
                                : ' Puedes modificar los campos y puntajes. Si cambias algo, se creará una nueva plantilla.'}
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Formulario de rúbrica (solo mostrar si está editando o ha elegido modo) */}
              {(editingRubric || creationMode !== null) && (
                <>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Rúbrica *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Rúbrica de Examen, Rúbrica de Proyecto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción de la rúbrica"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activityTypeId">Tipo de Actividad (Opcional)</Label>
                <Select
                  value={formData.activityTypeId}
                  onValueChange={(value) => setFormData({ ...formData, activityTypeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de actividad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin tipo específico (reutilizable)</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Asocia esta rúbrica a un tipo de actividad para filtrarla automáticamente al crear evaluaciones
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalPoints">Total de Puntos *</Label>
                <Input
                  id="totalPoints"
                  type="number"
                  min="1"
                  value={formData.totalPoints}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) > 0)) {
                      handleUpdateTotalPoints(value === '' ? 0 : parseInt(value));
                    }
                  }}
                  placeholder="Ej: 30, 100"
                />
                <p className="text-xs text-muted-foreground">
                  La suma de puntos de los criterios debe coincidir con este total. Puedes ajustar este valor y los puntos se redistribuirán proporcionalmente.
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-2">Criterios de Evaluación</h3>
                <DialogDescription className="mb-4">
                  Define los criterios y cuántos puntos vale cada uno. La suma debe ser igual al total de puntos.
                </DialogDescription>

                <div className="space-y-2 mb-4">
                  {criteria.map((criterion, index) => {
                    const subCriteriaTotal = getSubCriteriaTotal(criterion);
                    const hasSubCriteria = criterion.subCriteria && criterion.subCriteria.length > 0;
                    const isExpanded = expandedCriteria.has(index);
                    
                    return (
                      <div key={index} className="border-2 border-blue-200 rounded-lg bg-blue-50/50 shadow-sm">
                        {/* Criterio Principal */}
                        <div className="flex items-center gap-2 p-4 bg-white rounded-t-lg border-b-2 border-blue-200">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                                {index + 1}
                              </span>
                              <p className="font-semibold text-base">{criterion.name}</p>
                              {hasSubCriteria && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleCriterionExpanded(index)}
                                  className="h-7 px-2 text-xs border border-blue-300 hover:bg-blue-100"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Ocultar
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Ver
                                    </>
                                  )}
                                  {' '}subcriterios ({criterion.subCriteria?.length || 0})
                                </Button>
                              )}
                            </div>
                            {criterion.description && (
                              <p className="text-sm text-muted-foreground ml-8">{criterion.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-3 ml-8">
                              <Label htmlFor={`points-${index}`} className="text-sm font-medium">Puntos del Criterio:</Label>
                              <Input
                                id={`points-${index}`}
                                type="number"
                                min="1"
                                value={criterion.points}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value) && value > 0) {
                                    handleUpdateCriterionPoints(index, value);
                                  }
                                }}
                                className="w-24 font-semibold"
                              />
                              {hasSubCriteria && (
                                <span className={`text-sm font-medium px-2 py-1 rounded ${
                                  subCriteriaTotal === criterion.points 
                                    ? 'bg-green-100 text-green-700 border border-green-300' 
                                    : 'bg-red-100 text-red-700 border border-red-300'
                                }`}>
                                  Subcriterios: {subCriteriaTotal} / {criterion.points}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!hasSubCriteria && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const newExpanded = new Set(expandedCriteria);
                                  newExpanded.add(index);
                                  setExpandedCriteria(newExpanded);
                                  setNewSubCriterion({ ...newSubCriterion, [index]: { name: '', description: '', points: '' } });
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Agregar Subcriterios
                              </Button>
                            )}
                            {hasSubCriteria && !isExpanded && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const newExpanded = new Set(expandedCriteria);
                                  newExpanded.add(index);
                                  setExpandedCriteria(newExpanded);
                                  setNewSubCriterion({ ...newSubCriterion, [index]: { name: '', description: '', points: '' } });
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Agregar Más
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCriterion(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Subcriterios */}
                        {isExpanded && (
                          <div className="p-4 space-y-3 bg-gradient-to-b from-blue-50/30 to-transparent">
                            {/* Subcriterios Existentes */}
                            {criterion.subCriteria && criterion.subCriteria.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-px flex-1 bg-blue-300"></div>
                                  <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                    Subcriterios Definidos ({criterion.subCriteria.length})
                                  </span>
                                  <div className="h-px flex-1 bg-blue-300"></div>
                                </div>
                                {criterion.subCriteria.map((subCrit, subIndex) => (
                                  <div key={subIndex} className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold">
                                          {subIndex + 1}
                                        </span>
                                        <p className="text-sm font-semibold text-gray-800">{subCrit.name}</p>
                                      </div>
                                      {subCrit.description && (
                                        <p className="text-xs text-muted-foreground ml-7">{subCrit.description}</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-2 ml-7">
                                        <Label htmlFor={`sub-points-${index}-${subIndex}`} className="text-xs font-medium">Puntos:</Label>
                                        <Input
                                          id={`sub-points-${index}-${subIndex}`}
                                          type="number"
                                          min="1"
                                          value={subCrit.points}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value);
                                            if (!isNaN(value) && value > 0) {
                                              handleUpdateSubCriterionPoints(index, subIndex, value);
                                            }
                                          }}
                                          className="w-20 h-8 text-sm font-semibold"
                                        />
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveSubCriterion(index, subIndex)}
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Formulario para agregar subcriterio - Estilo Diferente */}
                            <div className="mt-4 pt-4 border-t-2 border-dashed border-blue-300">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="h-px flex-1 bg-blue-300"></div>
                                <span className="text-xs font-bold text-blue-800 bg-yellow-100 border-2 border-yellow-400 px-3 py-1 rounded-full">
                                  ➕ NUEVO SUBCRITERIO
                                </span>
                                <div className="h-px flex-1 bg-blue-300"></div>
                              </div>
                              <div className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-md space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label htmlFor={`sub-name-${index}`} className="text-xs font-semibold text-gray-700">
                                      Nombre del Subcriterio *
                                    </Label>
                                    <Input
                                      id={`sub-name-${index}`}
                                      value={newSubCriterion[index]?.name || ''}
                                      onChange={(e) => setNewSubCriterion({
                                        ...newSubCriterion,
                                        [index]: { ...(newSubCriterion[index] || { name: '', description: '', points: '' }), name: e.target.value }
                                      })}
                                      placeholder="Ej: Desarrollo, Funcionamiento"
                                      className="h-9 text-sm bg-white border-2 border-yellow-300 focus:border-yellow-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`sub-points-new-${index}`} className="text-xs font-semibold text-gray-700">
                                      Puntos *
                                    </Label>
                                    <Input
                                      id={`sub-points-new-${index}`}
                                      type="number"
                                      min="1"
                                      value={newSubCriterion[index]?.points || ''}
                                      onChange={(e) => setNewSubCriterion({
                                        ...newSubCriterion,
                                        [index]: { ...(newSubCriterion[index] || { name: '', description: '', points: '' }), points: e.target.value }
                                      })}
                                      placeholder="Ej: 5, 10"
                                      className="h-9 text-sm bg-white border-2 border-yellow-300 focus:border-yellow-500 font-semibold"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`sub-desc-${index}`} className="text-xs font-semibold text-gray-700">
                                    Descripción (Opcional)
                                  </Label>
                                  <Input
                                    id={`sub-desc-${index}`}
                                    value={newSubCriterion[index]?.description || ''}
                                    onChange={(e) => setNewSubCriterion({
                                      ...newSubCriterion,
                                      [index]: { ...(newSubCriterion[index] || { name: '', description: '', points: '' }), description: e.target.value }
                                    })}
                                    placeholder="Descripción del subcriterio"
                                    className="h-9 text-sm bg-white border-2 border-yellow-300 focus:border-yellow-500"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleAddSubCriterion(index)}
                                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold border-2 border-yellow-600 shadow-md"
                                  size="sm"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Agregar Subcriterio
                                </Button>
                                {subCriteriaTotal === criterion.points && criterion.subCriteria && criterion.subCriteria.length > 0 && (
                                  <p className="text-xs text-center text-green-700 font-semibold bg-green-100 px-2 py-1 rounded border border-green-300">
                                    ✓ Los subcriterios están completos ({subCriteriaTotal}/{criterion.points} puntos)
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="criterionName">Nombre del Criterio *</Label>
                      <Input
                        id="criterionName"
                        value={newCriterion.name}
                        onChange={(e) => setNewCriterion({ ...newCriterion, name: e.target.value })}
                        placeholder="Ej: Pareo, Desarrollo, Opción Múltiple"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="criterionPoints">Puntos *</Label>
                      <Input
                        id="criterionPoints"
                        type="number"
                        min="1"
                        value={newCriterion.points}
                        onChange={(e) => setNewCriterion({ ...newCriterion, points: e.target.value })}
                        placeholder="Ej: 10, 20"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="criterionDescription">Descripción (Opcional)</Label>
                    <Input
                      id="criterionDescription"
                      value={newCriterion.description}
                      onChange={(e) => setNewCriterion({ ...newCriterion, description: e.target.value })}
                      placeholder="Descripción del criterio"
                    />
                  </div>
                  <Button onClick={handleAddCriterion} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Criterio
                  </Button>
                </div>

                <p className={`text-sm mt-2 ${getTotalPoints() === parseInt(formData.totalPoints || '0') ? 'text-green-600' : 'text-destructive'}`}>
                  Total de criterios: {getTotalPoints()} / {formData.totalPoints || 0} puntos
                  {getTotalPoints() !== parseInt(formData.totalPoints || '0') && ' (Deben coincidir)'}
                </p>
              </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {!editingRubric && creationMode === null ? (
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-2 mr-auto">
                    <input
                      type="checkbox"
                      id="saveAsTemplate"
                      checked={saveAsTemplate || (selectedTemplate && hasTemplateChanged())}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      disabled={selectedTemplate && hasTemplateChanged()}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="saveAsTemplate" className={`text-sm ${selectedTemplate && hasTemplateChanged() ? 'cursor-default' : 'cursor-pointer'}`}>
                      {selectedTemplate && hasTemplateChanged() 
                        ? 'Se guardará como nueva plantilla (modificada)'
                        : 'Guardar como plantilla para reutilizar'}
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      if (editingRubric) {
                        setDialogOpen(false);
                      } else {
                        setCreationMode(null);
                        setSelectedTemplate(null);
                      }
                    }}>
                      {editingRubric ? 'Cancelar' : 'Volver'}
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={
                        !formData.name ||
                        !formData.totalPoints ||
                        criteria.length === 0 ||
                        getTotalPoints() !== parseInt(formData.totalPoints || '0')
                      }
                    >
                      Guardar
                    </Button>
                  </div>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rubrics.map((rubric) => (
          <Card key={rubric.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  <CardTitle>{rubric.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(rubric)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rubric.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rubric.description && (
                <p className="text-sm text-muted-foreground mb-2">{rubric.description}</p>
              )}
              {rubric.activityType && (
                <p className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block mb-2">
                  {rubric.activityType.name}
                </p>
              )}
              <p className="text-sm font-semibold mb-1">Total: {rubric.totalPoints} puntos</p>
              <h4 className="text-sm font-semibold mb-1">Criterios:</h4>
              {rubric.criteria && rubric.criteria.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {rubric.criteria.map((crit: any) => (
                    <li key={crit.id}>
                      {crit.name}: {crit.points} pts
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No hay criterios definidos.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {rubrics.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay rúbricas registradas. Crea una para comenzar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
