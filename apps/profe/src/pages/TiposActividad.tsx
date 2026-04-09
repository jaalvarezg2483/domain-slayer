import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, ClipboardList, Lock } from 'lucide-react';

export default function TiposActividad() {
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    evaluationModel: 'RUBRICA_CRITERIOS',
    maxScore: '100',
    allowsRubric: true,
    allowsWeights: false,
    allowsPenalties: false,
    active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await ipc.activityTypes.getAll();
      setActivityTypes(data || []);
    } catch (error) {
      console.error('Error cargando tipos de actividad:', error);
      setActivityTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (type?: any) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name || '',
        description: type.description || '',
        evaluationModel: type.evaluationModel || 'RUBRICA_CRITERIOS',
        maxScore: type.maxScore?.toString() || '100',
        allowsRubric: type.allowsRubric !== undefined ? type.allowsRubric : true,
        allowsWeights: type.allowsWeights || false,
        allowsPenalties: type.allowsPenalties || false,
        active: type.active !== undefined ? type.active : true,
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        description: '',
        evaluationModel: 'RUBRICA_CRITERIOS',
        maxScore: '100',
        allowsRubric: true,
        allowsWeights: false,
        allowsPenalties: false,
        active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        alert('El nombre es requerido');
        return;
      }

      const data = {
        name: formData.name,
        description: formData.description || undefined,
        evaluationModel: formData.evaluationModel,
        maxScore: parseInt(formData.maxScore) || 100,
        allowsRubric: formData.evaluationModel !== 'PUNTAJE_DIRECTO',
        allowsWeights: false,
        allowsPenalties: false,
        active: true,
      };

      if (editingType) {
        await ipc.activityTypes.update(editingType.id, data);
      } else {
        await ipc.activityTypes.create(data);
      }

      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error guardando tipo de actividad:', error);
      alert(error.message || 'Error al guardar el tipo de actividad');
    }
  };

  const handleDelete = async (id: number, isDefault: boolean) => {
    if (isDefault) {
      alert('No se puede eliminar un tipo de actividad por defecto del sistema');
      return;
    }
    if (!confirm('¿Está seguro de eliminar este tipo de actividad?')) return;
    try {
      await ipc.activityTypes.delete(id);
      loadData();
    } catch (error: any) {
      console.error('Error eliminando tipo de actividad:', error);
      alert(error.message || 'Error al eliminar el tipo de actividad');
    }
  };

  const getEvaluationModelLabel = (model: string) => {
    const labels: Record<string, string> = {
      RUBRICA_CRITERIOS: 'Rúbrica de Criterios',
      PUNTAJE_DIRECTO: 'Puntaje Directo',
      PORTAFOLIO_ACUMULATIVO: 'Portafolio Acumulativo',
    };
    return labels[model] || model;
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tipos de Actividad</h1>
          <p className="text-muted-foreground mt-2">
            Define los tipos de actividad y cómo se evalúan (rúbrica, puntaje directo, portafolio)
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingType ? 'Editar Tipo de Actividad' : 'Nuevo Tipo de Actividad'}</DialogTitle>
              <DialogDescription>
                {editingType
                  ? 'Modifica el tipo de actividad y su modelo de evaluación'
                  : 'Crea un nuevo tipo de actividad con su modelo de evaluación'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Tipo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Examen, TC, Portafolio, Proyecto, Tarea"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre simple del tipo de actividad (Examen, TC, Portafolio, etc.)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evaluationModel">Tipo de Evaluación *</Label>
                <Select
                  value={formData.evaluationModel}
                  onValueChange={(value) => {
                    const newModel = value as 'RUBRICA_CRITERIOS' | 'PUNTAJE_DIRECTO' | 'PORTAFOLIO_ACUMULATIVO';
                    setFormData({
                      ...formData,
                      evaluationModel: newModel,
                      allowsRubric: newModel !== 'PUNTAJE_DIRECTO',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="¿Cómo se evalúa?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUNTAJE_DIRECTO">Puntaje Directo (Examen - solo puntos)</SelectItem>
                    <SelectItem value="RUBRICA_CRITERIOS">Rúbrica (TC, Proyecto, Tarea - con criterios)</SelectItem>
                    <SelectItem value="PORTAFOLIO_ACUMULATIVO">Portafolio (Acumulativo con evidencias)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.evaluationModel === 'PUNTAJE_DIRECTO' && '📝 Solo ingresa puntos obtenidos (ej: 85/100)'}
                  {formData.evaluationModel === 'RUBRICA_CRITERIOS' && '📋 Evalúa con rúbrica de criterios (selecciona rúbrica al crear evaluación)'}
                  {formData.evaluationModel === 'PORTAFOLIO_ACUMULATIVO' && '📚 Portafolio con evidencias acumulativas en el tiempo'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxScore">Puntaje Máximo</Label>
                <Input
                  id="maxScore"
                  type="number"
                  min="1"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">
                  Puntaje máximo por defecto (puedes cambiarlo en cada evaluación)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!formData.name}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activityTypes.map((type) => (
          <Card key={type.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  <CardTitle>{type.name}</CardTitle>
                  {type.isDefault && (
                    <div title="Tipo por defecto">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(type)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!type.isDefault && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id, type.isDefault)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {type.description && (
                <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
              )}
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Modelo:</span> {getEvaluationModelLabel(type.evaluationModel)}
                </p>
                <p>
                  <span className="font-medium">Puntaje máximo:</span> {type.maxScore} pts
                </p>
                <div className="flex gap-2 mt-2">
                  {type.allowsRubric && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Rúbrica</span>
                  )}
                  {type.allowsWeights && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Pesos</span>
                  )}
                  {type.allowsPenalties && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Penalizaciones</span>
                  )}
                </div>
                {!type.active && (
                  <p className="text-xs text-red-600 mt-2">Inactivo</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activityTypes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay tipos de actividad registrados. Crea uno para comenzar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
