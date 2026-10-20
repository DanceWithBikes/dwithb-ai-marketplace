#!/usr/bin/env bash
# Seeds a tiny TypeScript backend on branch 'main', then commits the change under review on branch 'feature'.
# --- base project (shared by all architecture-review eval cases) ---
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "eval@example.invalid"
mkdir -p src/app src/modules/orders src/modules/billing

cat > package.json <<'EOF'
{
  "name": "shop-api",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
EOF

cat > AGENTS.md <<'EOF'
# shop-api

Backend service. One folder per feature module under `src/modules/<name>/`:

| File | Role |
|---|---|
| `domain.ts` | types and pure business rules |
| `ports.ts` | interfaces the service needs |
| `service.ts` | use cases; receives its ports through a `deps` object |
| `repository.ts` | the only file that talks to the database |
| `routes.ts` | HTTP handlers; call the service only |
| `compose.ts` | wires the service with concrete repositories |

`src/app/container.ts` is the composition root. Modules never import each other.
There is no automated architecture check yet.
EOF

cat > src/app/container.ts <<'EOF'
import { buildOrdersService } from "../modules/orders/compose.js";
import { buildBillingService } from "../modules/billing/compose.js";

export function buildContainer() {
  return {
    orders: buildOrdersService(),
    billing: buildBillingService(),
  };
}
EOF

cat > src/modules/orders/domain.ts <<'EOF'
export interface Order {
  id: string;
  total: number;
}

export function priceOrder(order: Order): number {
  return order.total;
}

export function sumOrders(orders: Order[]): number {
  return orders.reduce((acc, o) => acc + o.total, 0);
}
EOF

cat > src/modules/orders/ports.ts <<'EOF'
import type { Order } from "./domain.js";

export interface OrdersRepositoryPort {
  findById(id: string): Promise<Order | undefined>;
  save(id: string, price: number): Promise<void>;
}
EOF

cat > src/modules/orders/service.ts <<'EOF'
import { priceOrder, type Order } from "./domain.js";
import type { OrdersRepositoryPort } from "./ports.js";

export interface OrdersServiceDeps {
  orders: OrdersRepositoryPort;
}

export class OrdersService {
  constructor(private readonly deps: OrdersServiceDeps) {}

  async checkout(order: Order) {
    const price = priceOrder(order);
    await this.deps.orders.save(order.id, price);
    return { price };
  }
}
EOF

cat > src/modules/orders/repository.ts <<'EOF'
import type { Order } from "./domain.js";
import type { OrdersRepositoryPort } from "./ports.js";

const rows = new Map<string, Order>();

export class PgOrderRepository implements OrdersRepositoryPort {
  async findById(id: string) {
    return rows.get(id);
  }

  async save(id: string, price: number) {
    rows.set(id, { id, total: price });
  }
}
EOF

cat > src/modules/orders/routes.ts <<'EOF'
import type { FastifyInstance } from "fastify";
import type { OrdersService } from "./service.js";

export function registerOrderRoutes(app: FastifyInstance, service: OrdersService) {
  app.post<{ Body: { id: string; total: number } }>("/orders/checkout", async (req) => {
    return service.checkout(req.body);
  });
}
EOF

cat > src/modules/orders/compose.ts <<'EOF'
import { OrdersService } from "./service.js";
import { PgOrderRepository } from "./repository.js";

export function buildOrdersService() {
  return new OrdersService({ orders: new PgOrderRepository() });
}
EOF

cat > src/modules/billing/domain.ts <<'EOF'
export interface Invoice {
  orderId: string;
  amount: number;
}
EOF

cat > src/modules/billing/ports.ts <<'EOF'
import type { Invoice } from "./domain.js";

export interface InvoicesRepositoryPort {
  insert(invoice: Invoice): Promise<void>;
}

export interface OrderTotalsPort {
  totalFor(orderId: string): Promise<number | undefined>;
}
EOF

cat > src/modules/billing/service.ts <<'EOF'
import type { Invoice } from "./domain.js";
import type { InvoicesRepositoryPort, OrderTotalsPort } from "./ports.js";

export interface BillingServiceDeps {
  invoices: InvoicesRepositoryPort;
  orderTotals: OrderTotalsPort;
}

export class BillingService {
  constructor(private readonly deps: BillingServiceDeps) {}

  async invoiceFor(orderId: string): Promise<Invoice> {
    const amount = (await this.deps.orderTotals.totalFor(orderId)) ?? 0;
    const invoice = { orderId, amount };
    await this.deps.invoices.insert(invoice);
    return invoice;
  }
}
EOF

cat > src/modules/billing/compose.ts <<'EOF'
import { BillingService } from "./service.js";

export function buildBillingService() {
  return new BillingService({
    invoices: { insert: async () => {} },
    orderTotals: { totalFor: async () => undefined },
  });
}
EOF

git add -A
git commit -q -m "Initial orders and billing modules"
git checkout -q -b feature
# --- end base project ---

# --- the change under review ---
cat > src/modules/orders/domain.ts <<'EOF'
import type { FastifyReply } from "fastify";

export interface Order {
  id: string;
  total: number;
}

export function priceOrder(order: Order, reply?: FastifyReply): number {
  return order.total;
}

export function sumOrders(orders: Order[]): number {
  return orders.reduce((acc, o) => acc + o.total, 0);
}
EOF

cat > src/modules/orders/service.ts <<'EOF'
import { priceOrder, type Order } from "./domain.js";
import type { OrdersRepositoryPort } from "./ports.js";
import { PgOrderRepository } from "./repository.js";

export interface OrdersServiceDeps {
  orders: OrdersRepositoryPort;
}

export class OrdersService {
  private repo = new PgOrderRepository();

  constructor(private readonly deps: OrdersServiceDeps) {}

  async checkout(order: Order) {
    const price = priceOrder(order);
    await this.repo.save(order.id, price);
    return { price };
  }
}
EOF

git add -A
git commit -q -m "Persist checkout price directly from the service"
