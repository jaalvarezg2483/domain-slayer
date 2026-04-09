import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ipc } from '@/lib/ipc';
import { Plus, Edit, Trash2, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function AñosLectivos() {
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<any>(null);
  const [selectedYearForPeriod, setSelectedYearForPeriod] = useState<any>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [yearFormData, setYearFormData] = useState({
    label: '',
    startDate: '',
    endDate: '',
  });
  const [periodFormData, setPeriodFormData] = useState({
    type: '',
    number: '',
    label: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const yearsData = await ipc.academicYears.getAll();
      
      // Cargar períodos para cada año académico
      const yearsWithPeriods = await Promise.all(
        yearsData.map(async (year) => {
          const periods = await ipc.periods.getByAcademicYearId(year.id);
          return { ...year, periods };
        })
      );
      
      setAcademicYears(yearsWithPeriods);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleYearExpansion = (yearId: number) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(yearId)) {
      newExpanded.delete(yearId);
    } else {
      newExpanded.add(yearId);
    }
    setExpandedYears(newExpanded);
  };

  const handleOpenYearDialog = (year?: any) => {
    if (year) {
      setEditingYear(year);
      setYearFormData({
        label: year.label || '',
        startDate: year.startDate ? format(new Date(year.startDate), 'yyyy-MM-dd') : '',
        endDate: year.endDate ? format(new Date(year.endDate), 'yyyy-MM-dd') : '',
      });
    } else {
      setEditingYear(null);
      setYearFormData({
        label: '',
        startDate: '',
        endDate: '',
      });
    }
    setYearDialogOpen(true);
  };

  const handleOpenPeriodDialog = (year: any) => {
    setSelectedYearForPeriod(year);
    setPeriodFormData({
      type: '',
      number: '',
      label: '',
      startDate: year.startDate ? format(new Date(year.startDate), 'yyyy-MM-dd') : '',
      endDate: year.endDate ? format(new Date(year.endDate), 'yyyy-MM-dd') : '',
    });
    setPeriodDialogOpen(true);
  };

  const handleSaveYear = async () => {
    try {
      const data = {
        label: yearFormData.label,
        startDate: new Date(yearFormData.startDate),
        endDate: new Date(yearFormData.endDate),
      };
      if (editingYear) {
        await ipc.academicYears.update(editingYear.id, data);
      } else {
        await ipc.academicYears.create(data);
      }
      setYearDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error guardando año lectivo:', error);
      alert('Error al guardar el año lectivo');
    }
  };

  const handleSavePeriod = async () => {
    try {
      const data = {
        academicYearId: selectedYearForPeriod.id,
        type: periodFormData.type as 'semestre' | 'trimestre' | 'bimestre',
        number: parseInt(periodFormData.number),
        label: periodFormData.label || undefined,
        startDate: new Date(periodFormData.startDate),
        endDate: new Date(periodFormData.endDate),
      };
      await ipc.periods.create(data);
      setPeriodDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error guardando período:', error);
      alert('Error al guardar el período');
    }
  };

  const handleDeleteYear = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este año lectivo? Se eliminarán todos sus períodos.')) return;
    try {
      await ipc.academicYears.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando año lectivo:', error);
      alert('Error al eliminar el año lectivo');
    }
  };

  const handleDeletePeriod = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este período?')) return;
    try {
      await ipc.periods.delete(id);
      loadData();
    } catch (error) {
      console.error('Error eliminando período:', error);
      alert('Error al eliminar el período');
    }
  };

  const getPeriodTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      semestre: 'Semestre',
      trimestre: 'Trimestre',
      bimestre: 'Bimestre',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Años Lectivos</h1>
          <p className="text-muted-foreground mt-2">Gestiona los años académicos y sus períodos</p>
        </div>
        <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenYearDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Año Lectivo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingYear ? 'Editar Año Lectivo' : 'Nuevo Año Lectivo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Etiqueta *</Label>
                <Input
                  id="label"
                  value={yearFormData.label}
                  onChange={(e) => setYearFormData({ ...yearFormData, label: e.target.value })}
                  placeholder="Ej: 2026, 2025-2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha Inicio *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={yearFormData.startDate}
                    onChange={(e) => setYearFormData({ ...yearFormData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha Fin *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={yearFormData.endDate}
                    onChange={(e) => setYearFormData({ ...yearFormData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setYearDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveYear} disabled={!yearFormData.label || !yearFormData.startDate || !yearFormData.endDate}>
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {academicYears.map((year) => {
          const isExpanded = expandedYears.has(year.id);
          const periods = year.periods || [];
          const periodsByType = periods.reduce((acc: any, period: any) => {
            if (!acc[period.type]) acc[period.type] = [];
            acc[period.type].push(period);
            return acc;
          }, {});

          return (
            <Card key={year.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleYearExpansion(year.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <Calendar className="h-5 w-5" />
                    <div className="flex-1">
                      <CardTitle>{year.label}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(year.startDate), 'dd/MM/yyyy')} - {format(new Date(year.endDate), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenPeriodDialog(year)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Período
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenYearDialog(year)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteYear(year.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent>
                  {Object.keys(periodsByType).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay períodos configurados. Agrega uno para comenzar.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(periodsByType).map(([type, typePeriods]: [string, any]) => (
                        <div key={type} className="border-l-2 border-primary pl-4">
                          <h4 className="font-semibold mb-2">{getPeriodTypeLabel(type)}</h4>
                          <div className="space-y-2">
                            {typePeriods
                              .sort((a: any, b: any) => a.number - b.number)
                              .map((period: any) => (
                                <div key={period.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <div>
                                    <span className="font-medium">
                                      {getPeriodTypeLabel(period.type)} {period.number}
                                      {period.label && ` - ${period.label}`}
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(period.startDate), 'dd/MM/yyyy')} - {format(new Date(period.endDate), 'dd/MM/yyyy')}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeletePeriod(period.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {academicYears.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay años lectivos registrados. Crea uno para comenzar.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Período - {selectedYearForPeriod?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="periodType">Tipo de Período *</Label>
              <Select
                value={periodFormData.type}
                onValueChange={(value) => setPeriodFormData({ ...periodFormData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semestre">Semestre</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="bimestre">Bimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodNumber">Número *</Label>
              <Input
                id="periodNumber"
                type="number"
                min="1"
                value={periodFormData.number}
                onChange={(e) => setPeriodFormData({ ...periodFormData, number: e.target.value })}
                placeholder="Ej: 1, 2, 3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodLabel">Etiqueta (Opcional)</Label>
              <Input
                id="periodLabel"
                value={periodFormData.label}
                onChange={(e) => setPeriodFormData({ ...periodFormData, label: e.target.value })}
                placeholder="Ej: Primer Semestre"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStartDate">Fecha Inicio *</Label>
                <Input
                  id="periodStartDate"
                  type="date"
                  value={periodFormData.startDate}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEndDate">Fecha Fin *</Label>
                <Input
                  id="periodEndDate"
                  type="date"
                  value={periodFormData.endDate}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSavePeriod}
              disabled={!periodFormData.type || !periodFormData.number || !periodFormData.startDate || !periodFormData.endDate}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
