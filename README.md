# Kiosko POS Cloud (Render + Supabase)

Sistema POS + inventario minimo para kiosko, pensado para usar desde navegador (sin depender de una PC local fija).

## Stack

- Next.js 15 + TypeScript
- Supabase Postgres (persistencia cloud)
- Deploy en Render (Web Service)

## MVP Fase 1 incluido

- CRUD de productos (id UUID, nombre, precio, stock, barcode unico)
- Barcode autogenerado al crear producto
- Etiquetas imprimibles (A4 configurable) con nombre, precio, codigo y barcode CODE-128
- Venta rapida por escaner (input con foco), carrito, edicion de cantidades y cobro
- Descuento de stock al cobrar
- Alertas de stock bajo (<= 3)
- Dashboard: ventas hoy/semana/mes, total de ventas, ticket promedio, top productos, ultimas ventas
- Datos demo (seed)

## Preparado para Fase 2

- Seleccion de metodo de pago en checkout: `Efectivo / Mercado Pago`
- Campo `payment_method` guardado en ventas

## Requisitos

- Node 20 LTS recomendado
- Cuenta en Supabase
- Cuenta en Render

## Configuracion local

1. Copia variables:

```bash
cp .env.example .env.local
```

2. Define variables:

- `DATABASE_URL`: connection string de Supabase (pooler recomendado)
- `SEED_TOKEN`: token secreto para endpoint de seed

3. Instala y ejecuta:

```bash
npm install
npm run dev
```

App en: `http://localhost:3000`

## Base de datos (Supabase)

### Opcion A (recomendada)

- Abre Supabase SQL Editor
- Ejecuta `supabase/schema.sql`

### Opcion B

- Usa endpoint de seed (crea tablas + demo):

```bash
curl -X POST http://localhost:3000/api/seed -H "x-seed-token: TU_SEED_TOKEN"
```

## Deploy en Render

1. Sube este repo a GitHub.
2. En Render: **New + > Web Service**.
3. Conecta el repo.
4. Render detecta `render.yaml` (o configura manual):
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
5. Agrega variables en Render:
- `DATABASE_URL`
- `SEED_TOKEN`
6. Deploy.

## Uso de lector de codigos

- Conecta lector USB modo teclado (HID).
- Ve a `Venta rapida`.
- Escanea en el input y Enter.

## Endpoints principales

- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/products/barcode/:barcode`
- `POST /api/sales/checkout`
- `GET /api/dashboard`
- `POST /api/seed` (protegido por `x-seed-token`)