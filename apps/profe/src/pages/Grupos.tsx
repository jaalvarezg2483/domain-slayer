import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, Users } from 'lucide-react';

export default function Grupos() {
  const [groups, setGroups] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    level: '',
    section: '',
    career: '',
    schoolId: 'none',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsData, schoolsData] = await Promise.all([
        ipc.groups.getAll(),
        ipc.schools.getAll(),
      ]);
      setGroups(groupsData);
      setSchools(schoolsData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (group?: any) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name || '',
        type: group.type || '',
        level: group.level || '',
        section: group.section || '',
        career: group.career || '',
        schoolId: group.schoolId?.toString() || 'none',
      });
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
        type: '',
        level: '',
        section: '',
        career: '',
        schoolId: 'none',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        name: formData.name,
        type: formData.type || undefined,
        level: formData.level || undefined,
        section: formData.section || undefined,
        career: formData.career || undefined,
        schoolId: formData.schoolId && formData.schoolId !== 'none' ? parseInt(formData.schoolId) : undefined,
      };
      if (editingGroup) {
        await ipc.groups.update(editingGroup.id, data);
      } else {
        await ipc.groups.create(data);
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error guardando grupo:', error);
      alert('Error al guardar el grupo');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este grupo? Se eliminarán todos sus cursos asociados.')) return;
    try {
      await ipc.groups.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando grupo:', error);
      alert('Error al eliminar el grupo');
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Grupos</h1>
          <p className="text-muted-foreground mt-2">Gestiona los grupos académicos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {editingGroup ? 'Modifica los datos del grupo' : 'Crea un nuevo grupo académico'}
              </p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Grupo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Desarrollo Web"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Nivel (Opcional)</Label>
                <Input
                  id="level"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  placeholder="Ej: 10, 11, 12, Técnico"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolId">Institución (Opcional)</Label>
                <Select
                  value={formData.schoolId}
                  onValueChange={(value) => setFormData({ ...formData, schoolId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar institución" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin institución</SelectItem>
                    {schools.length > 0 ? (
                      schools.map((school) => (
                        <SelectItem key={school.id} value={school.id.toString()}>
                          {school.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay instituciones disponibles</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!formData.name}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle>{group.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(group)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(group.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {group.type && (
                  <p className="text-sm text-muted-foreground">
                    Tipo: <span className="capitalize">{group.type}</span>
                  </p>
                )}
                {group.career && (
                  <p className="text-sm text-muted-foreground">Carrera: {group.career}</p>
                )}
                {group.level && (
                  <p className="text-sm text-muted-foreground">Nivel: {group.level}</p>
                )}
                {group.section && (
                  <p className="text-sm text-muted-foreground">Sección: {group.section}</p>
                )}
                {group.schoolId && schools.find(s => s.id === group.schoolId) && (
                  <p className="text-sm text-muted-foreground">
                    Institución: {schools.find(s => s.id === group.schoolId)?.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay grupos registrados. Crea uno para comenzar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
