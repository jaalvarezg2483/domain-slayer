import type { Alert } from "@domain-slayer/domain";
import type { AlertRepository, AlertListFilter } from "../ports/alert-repository.js";

export class AlertService {
  constructor(private readonly alerts: AlertRepository) {}

  list(filter: AlertListFilter) {
    return this.alerts.list(filter);
  }

  async markRead(id: string) {
    await this.alerts.markRead(id);
  }

  async resolve(id: string) {
    await this.alerts.resolve(id);
  }

  async resolveAllOpen() {
    return this.alerts.resolveAllOpen();
  }

  async create(input: Omit<Alert, "id" | "createdAt">) {
    return this.alerts.create(input);
  }
}
