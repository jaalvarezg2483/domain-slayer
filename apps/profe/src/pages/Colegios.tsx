import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { isRealElectron } from '@/lib/runtime';
import {
  profeSchoolCreate,
  profeSchoolDelete,
  profeSchoolsList,
  profeSchoolUpdate,
} from '@/lib/profe-schools-api';
import { Plus, Edit, Trash2, School } from 'lucide-react';

export default function Colegios() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [logoImages, setLogoImages] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    logoPath: '',
    reportHeader: '',
    reportFooter: '',
  });
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (!isRealElectron()) {
        const data = await profeSchoolsList();
        setSchools(data);
        const images: Record<string, string> = {};
        for (const school of data) {
          const lp = school.logoPath?.trim();
          if (lp?.startsWith('data:image/')) {
            images[school.id] = lp;
          }
        }
        setLogoImages(images);
        return;
      }

      const data = await ipc.schools.getAll();
      setSchools(data);

      const images: Record<string, string> = {};
      for (const school of data) {
        if (school.logoPath) {
          try {
            const img = await ipc.files.readImageAsBase64(school.logoPath);
            if (img) {
              images[String(school.id)] = img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
            }
          } catch (error) {
            console.error(`Error cargando logo para ${school.name}:`, error);
          }
        }
      }
      setLogoImages(images);
    } catch (error) {
      console.error('Error cargando instituciones:', error);
      alert(error instanceof Error ? error.message : 'No se pudieron cargar las instituciones.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (school?: any) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        name: school.name || '',
        logoPath: school.logoPath || '',
        reportHeader: school.reportHeader || '',
        reportFooter: school.reportFooter || '',
      });
    } else {
      setEditingSchool(null);
      setFormData({
        name: '',
        logoPath: '',
        reportHeader: '',
        reportFooter: '',
      });
    }
    setDialogOpen(true);
  };

  const handleBrowserLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        setFormData((prev) => ({ ...prev, logoPath: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectLogo = async () => {
    if (!isRealElectron()) {
      logoFileInputRef.current?.click();
      return;
    }
    try {
      const result = await ipc.files.selectFile({
        filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg'] }],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        setFormData({ ...formData, logoPath: result.filePaths[0] });
      }
    } catch (error) {
      console.error('Error seleccionando logo:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (!isRealElectron()) {
        if (editingSchool) {
          await profeSchoolUpdate(editingSchool.id, {
            name: formData.name,
            logoPath: formData.logoPath,
            reportHeader: formData.reportHeader,
            reportFooter: formData.reportFooter,
          });
        } else {
          await profeSchoolCreate({
            name: formData.name,
            logoPath: formData.logoPath,
            reportHeader: formData.reportHeader,
            reportFooter: formData.reportFooter,
          });
        }
      } else if (editingSchool) {
        await ipc.schools.update(editingSchool.id, formData);
      } else {
        await ipc.schools.create(formData);
      }
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error guardando institución:', error);
      alert(error instanceof Error ? error.message : 'Error al guardar la institución');
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('¿Está seguro de eliminar esta institución?')) return;
    try {
      if (!isRealElectron()) {
        await profeSchoolDelete(String(id));
      } else {
        await ipc.schools.delete(id as number);
      }
      await loadData();
    } catch (error) {
      console.error('Error eliminando institución:', error);
      alert(error instanceof Error ? error.message : 'Error al eliminar la institución');
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Instituciones</h1>
          <p className="text-muted-foreground mt-2">Gestiona las instituciones educativas (colegios, escuelas, universidades)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Institución
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSchool ? 'Editar Institución' : 'Nueva Institución'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Institución *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la institución"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoPath">Logo</Label>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="sr-only"
                  aria-hidden
                  tabIndex={-1}
                  onChange={handleBrowserLogoFile}
                />
                <div className="flex gap-2">
                  <Input
                    id="logoPath"
                    value={
                      formData.logoPath.startsWith('data:image/')
                        ? 'Imagen lista (vista previa abajo)'
                        : formData.logoPath
                    }
                    onChange={(e) => setFormData({ ...formData, logoPath: e.target.value })}
                    placeholder={isRealElectron() ? 'Ruta del logo' : 'PNG o JPG — use el botón'}
                    readOnly
                  />
                  <Button type="button" variant="outline" onClick={() => void handleSelectLogo()}>
                    Seleccionar Logo
                  </Button>
                </div>
                {formData.logoPath.startsWith('data:image/') ? (
                  <div className="flex justify-center rounded-md border border-border bg-muted/30 p-3">
                    <img
                      src={formData.logoPath}
                      alt="Vista previa del logo"
                      className="max-h-28 max-w-full object-contain"
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportHeader">Encabezado para Reportes</Label>
                <textarea
                  id="reportHeader"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.reportHeader}
                  onChange={(e) => setFormData({ ...formData, reportHeader: e.target.value })}
                  placeholder="Texto que aparecerá en el encabezado de los reportes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportFooter">Pie de Página para Reportes</Label>
                <textarea
                  id="reportFooter"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.reportFooter}
                  onChange={(e) => setFormData({ ...formData, reportFooter: e.target.value })}
                  placeholder="Texto que aparecerá en el pie de página de los reportes"
                />
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
        {schools.map((school) => (
          <Card key={school.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <School className="h-5 w-5" />
                  <CardTitle>{school.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(school)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(school.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logoImages[String(school.id)] && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={logoImages[String(school.id)]}
                    alt={`Logo de ${school.name}`}
                    className="max-h-32 max-w-full object-contain rounded"
                  />
                </div>
              )}
              {school.reportHeader && (
                <p className="text-xs text-muted-foreground mb-1">Encabezado configurado</p>
              )}
              {school.reportFooter && (
                <p className="text-xs text-muted-foreground">Pie de página configurado</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {schools.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <School className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay instituciones registradas. Crea una para comenzar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
