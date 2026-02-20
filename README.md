# Megakiosco Ohana (Render + Supabase)

POS + inventario con autenticacion Supabase Auth y RBAC (admin/seller).

## Stack

- Next.js 15 + TypeScript
- Supabase Auth + Postgres + RLS
- Render (Web Service)

## Roles

- `admin`
- `seller`

Permisos implementados:
- `/dashboard`: solo `admin`
- `/sales`: solo `admin` (listado + detalle)
- `/users`: solo `admin` (crear usuarios + rol)
- `/products`, `/sale`, `/labels`, `/alerts`: `admin` y `seller`

## Variables de entorno

Usa `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo backend)
- `SEED_TOKEN`
- `APP_BASE_URL`

## SQL de seguridad (obligatorio)

1. Abre Supabase SQL Editor.
2. Ejecuta `supabase/rbac.sql`.

Ese SQL crea:
- `profiles`
- funciones `auth_role()`, `is_admin()`, `is_seller()`
- trigger para auto-crear profile al registrar usuario
- RLS + policies para `profiles`, `products`, `sales`, `sale_items`
- RPC `create_sale(...)` y `get_dashboard_data()`

## Correr local

```bash
npm install
npm run dev
```

## Bootstrap del primer admin

### Opcion A (manual)

1. Registra un usuario en `/login` (o via dashboard de Supabase Auth).
2. En SQL Editor ejecuta:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DEL_USUARIO';
```

### Opcion B (SQL directo por email)

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and u.email = 'tu-admin@correo.com';
```

## Crear usuarios desde app (solo admin)

UI: `/users`

Backend: `POST /api/admin/create-user`
- protegido por rol admin
- usa `SUPABASE_SERVICE_ROLE_KEY`
- crea usuario en Supabase Auth y profile con rol

## Seed demo (opcional)

```bash
curl -X POST http://localhost:3000/api/seed -H "x-seed-token: TU_SEED_TOKEN"
```

## Deploy en Render

1. Push del repo a GitHub.
2. Crear Web Service en Render.
3. Build: `npm install && npm run build`
4. Start: `npm run start`
5. Configurar env vars de `.env.example`.
6. Deploy.

## Checklist manual de permisos

1. Usuario `seller`:
- entra a `/products`, `/sale`, `/labels`, `/alerts` OK
- `/dashboard`, `/sales`, `/users` bloqueado
- puede crear/editar productos
- puede registrar ventas
- no puede borrar productos (RLS)

2. Usuario `admin`:
- acceso total a `/dashboard`, `/sales`, `/users`
- puede crear usuario seller/admin
- puede eliminar productos

3. Seguridad backend:
- sin sesion: APIs responden 401
- seller en endpoints admin: 403
- policies RLS activas en Supabase