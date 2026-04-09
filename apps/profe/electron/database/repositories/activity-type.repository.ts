import { eq, and, or, isNull } from 'drizzle-orm';
import { activityTypes } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class ActivityTypeRepository {
  constructor(private db: Database) {}

  private readPredicate(scope: DataScope) {
    return or(isNull(activityTypes.ownerUserId), eq(activityTypes.ownerUserId, scope.userId));
  }

  getAll(scope: DataScope) {
    const r = this.readPredicate(scope);
    return this.db.select().from(activityTypes).where(r).orderBy(activityTypes.name).all();
  }

  getActive(scope: DataScope) {
    const r = this.readPredicate(scope);
    const base = eq(activityTypes.active, true);
    const w = and(base, r);
    return this.db.select().from(activityTypes).where(w).orderBy(activityTypes.name).all();
  }

  getById(scope: DataScope, id: number) {
    const row = this.db.select().from(activityTypes).where(eq(activityTypes.id, id)).get();
    if (!row) return undefined;
    if (row.ownerUserId == null) return row;
    if (row.ownerUserId === scope.userId) return row;
    return undefined;
  }

  getByEvaluationModel(scope: DataScope, model: 'RUBRICA_CRITERIOS' | 'PUNTAJE_DIRECTO' | 'PORTAFOLIO_ACUMULATIVO') {
    const r = this.readPredicate(scope);
    const base = eq(activityTypes.evaluationModel, model);
    const w = and(base, r);
    return this.db.select().from(activityTypes).where(w).orderBy(activityTypes.name).all();
  }

  create(data: {
    name: string;
    description?: string;
    evaluationModel: 'RUBRICA_CRITERIOS' | 'PUNTAJE_DIRECTO' | 'PORTAFOLIO_ACUMULATIVO';
    maxScore?: number;
    allowsRubric?: boolean;
    allowsWeights?: boolean;
    allowsPenalties?: boolean;
    active?: boolean;
    ownerUserId: number;
  }) {
    const now = new Date();
    return this.db
      .insert(activityTypes)
      .values({
        name: data.name,
        description: data.description,
        evaluationModel: data.evaluationModel,
        maxScore: data.maxScore || 100,
        allowsRubric:
          data.allowsRubric !== undefined
            ? data.allowsRubric
            : data.evaluationModel === 'RUBRICA_CRITERIOS' || data.evaluationModel === 'PORTAFOLIO_ACUMULATIVO',
        allowsWeights: data.allowsWeights || false,
        allowsPenalties: data.allowsPenalties || false,
        isDefault: false,
        active: data.active !== undefined ? data.active : true,
        ownerUserId: data.ownerUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<{
    name: string;
    description: string;
    evaluationModel: 'RUBRICA_CRITERIOS' | 'PUNTAJE_DIRECTO' | 'PORTAFOLIO_ACUMULATIVO';
    maxScore: number;
    allowsRubric: boolean;
    allowsWeights: boolean;
    allowsPenalties: boolean;
    active: boolean;
  }>) {
    const existing = this.getById(scope, id);
    if (!existing) return undefined;
    if (existing.isDefault) {
      throw new Error('No se puede modificar un tipo de actividad por defecto del sistema');
    }
    const now = new Date();
    return this.db
      .update(activityTypes)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(activityTypes.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    const activityType = this.getById(scope, id);
    if (!activityType) return { changes: 0 };
    if (activityType.isDefault) {
      throw new Error('No se puede eliminar un tipo de actividad por defecto del sistema');
    }
    return this.db.delete(activityTypes).where(eq(activityTypes.id, id)).run();
  }
}
