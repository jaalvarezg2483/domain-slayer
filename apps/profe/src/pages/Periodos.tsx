import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function Periodos() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<any>(null);
  const [formData, setFormData] = useState({
    year: '',
    type: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await ipc.periods.getAll();
      setPeriods(data);
    } catch (error) {
      console.error('Error cargando períodos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (period?: any) => {
    if (period) {
      setEditingPeriod(period);
      setFormData({
        year: period.year || '',
        type: period.type || '',
        startDate: period.startDate ? format(new Date(period.startDate), 'yyyy-MM-dd') : '',
        endDate: period.endDate ? format(new Date(period.endDate), 'yyyy-MM-dd') : '',
      });
    } else {
      setEditingPeriod(null);
      setFormData({
        year: new Date().getFullYear().toString(),
        type: '',
        startDate: '',
        endDate: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        year: formData.year,
        type: formData.type as 'trimestral' | 'semestral',
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
      };
      if (editingPeriod) {
        await ipc.periods.update(editingPeriod.id, data);
      } else {
        await ipc.periods.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error guardando período:', error);
      alert('Error al guardar el período');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este período?')) return;
    try {
      await ipc.periods.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando período:', error);
      alert('Error al eliminar el período');
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'trimestral' ? 'Trimestral' : 'Semestral';
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Períodos</h1>
          <p className="text-muted-foreground mt-2">Gestiona los períodos académicos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Período
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPeriod ? 'Editar Período' : 'Nuevo Período'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="year">Año *</Label>
                <Input
                  id="year"
                  type="number"
                  min="2020"
                  max="2100"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="Ej: 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha Inicio *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha Fin *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={!formData.year || !formData.type || !formData.startDate || !formData.endDate}
              >
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {periods.map((period) => (
          <Card key={period.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle>{period.year} - {getTypeLabel(period.type)}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(period)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(period.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {format(new Date(period.startDate), 'dd/MM/yyyy')} - {format(new Date(period.endDate), 'dd/MM/yyyy')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {periods.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay períodos registrados. Crea uno para comenzar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
