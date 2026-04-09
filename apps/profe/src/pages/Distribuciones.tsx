import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, Percent, X } from 'lucide-react';

interface Category {
  name: string;
  percentage: number;
}

export default function Distribuciones() {
  const [distributions, setDistributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categories: [] as Category[],
  });
  const [newCategory, setNewCategory] = useState({ name: '', percentage: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await ipc.gradeDistributions.getAll();
      setDistributions(data || []);
    } catch (error) {
      console.error('Error cargando distribuciones:', error);
      setDistributions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = async (distribution?: any) => {
    if (distribution) {
      setEditingDistribution(distribution);
      const withCategories = await ipc.gradeDistributions.getWithCategories(distribution.id);
      setFormData({
        name: withCategories?.name || '',
        description: withCategories?.description || '',
        categories: withCategories?.categories || [],
      });
    } else {
      setEditingDistribution(null);
      setFormData({
        name: '',
        description: '',
        categories: [],
      });
    }
    setDialogOpen(true);
  };

  const handleAddCategory = () => {
    if (!newCategory.name || !newCategory.percentage) {
      alert('Por favor completa el nombre y porcentaje de la categoría');
      return;
    }

    const percentage = parseInt(newCategory.percentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      alert('El porcentaje debe ser un número entre 1 y 100');
      return;
    }

    const currentTotal = getTotalPercentage();
    const newTotal = currentTotal + percentage;

    if (newTotal > 100) {
      alert(`No se puede agregar esta categoría. El total sería ${newTotal}%, pero debe ser exactamente 100%. Actual: ${currentTotal}%`);
      return;
    }

    setFormData({
      ...formData,
      categories: [...formData.categories, { name: newCategory.name, percentage }],
    });
    setNewCategory({ name: '', percentage: '' });
  };

  const handleRemoveCategory = (index: number) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    try {
      if (!formData.name) {
        alert('El nombre es requerido');
        return;
      }

      if (formData.categories.length === 0) {
        alert('Debe agregar al menos una categoría');
        return;
      }

      const totalPercentage = formData.categories.reduce((sum, cat) => sum + cat.percentage, 0);
      if (totalPercentage !== 100) {
        alert(`Los porcentajes deben sumar exactamente 100%. Actual: ${totalPercentage}%`);
        return;
      }

      const data = {
        name: formData.name,
        description: formData.description || undefined,
        categories: formData.categories,
      };

      if (editingDistribution) {
        await ipc.gradeDistributions.update(editingDistribution.id, data);
      } else {
        await ipc.gradeDistributions.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error guardando distribución:', error);
      alert(error.message || 'Error al guardar la distribución');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta distribución? Esto afectará los cursos que la usen.')) return;
    try {
      await ipc.gradeDistributions.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando distribución:', error);
      alert('Error al eliminar la distribución');
    }
  };

  const getTotalPercentage = () => {
    return formData.categories.reduce((sum, cat) => sum + cat.percentage, 0);
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Distribuciones de Calificación</h1>
          <p className="text-muted-foreground mt-2">Gestiona las distribuciones de porcentajes para evaluaciones</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Distribución
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDistribution ? 'Editar Distribución' : 'Nueva Distribución'}</DialogTitle>
              <DialogDescription>
                {editingDistribution ? 'Modifica la distribución de calificación' : 'Crea una nueva distribución de porcentajes para evaluaciones'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Regular, Intensivo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción de la distribución"
                />
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>Categorías *</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className={`font-bold ${getTotalPercentage() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {getTotalPercentage()}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {formData.categories.map((category, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">{category.percentage}%</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCategory(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre de categoría"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="flex-1"
                    disabled={getTotalPercentage() === 100}
                  />
                  <Input
                    type="number"
                    placeholder="%"
                    value={newCategory.percentage}
                    onChange={(e) => setNewCategory({ ...newCategory, percentage: e.target.value })}
                    className="w-24"
                    min="1"
                    max="100"
                    disabled={getTotalPercentage() === 100}
                  />
                  <Button 
                    onClick={handleAddCategory} 
                    variant="outline"
                    disabled={getTotalPercentage() === 100 || !newCategory.name || !newCategory.percentage}
                  >
                    Agregar
                  </Button>
                </div>
                {getTotalPercentage() === 100 && (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Total alcanzado (100%). No se pueden agregar más categorías.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name || formData.categories.length === 0 || getTotalPercentage() !== 100}
              >
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {distributions.map((distribution) => (
          <Card key={distribution.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  <CardTitle>{distribution.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(distribution)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(distribution.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {distribution.description && (
                <p className="text-sm text-muted-foreground mb-2">{distribution.description}</p>
              )}
              <p className="text-sm text-muted-foreground">Categorías: {distribution.categories?.length || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {distributions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Percent className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay distribuciones registradas. Crea una para comenzar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
