# Club Stats

Sistema web para gestionar el plantel: asistencia a entrenamientos, multas, estadísticas de
partidos, autoevaluación de jugadores y scouting del rival.

## Stack

- **Next.js 16** (App Router) + Tailwind CSS + shadcn/ui (Base UI)
- **Supabase**: base de datos Postgres, autenticación y seguridad por fila (RLS)

Es una web responsive: funciona igual desde PC, celular o tablet con el mismo navegador, sin
instalar nada aparte.

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (gratis).
2. En **Project Settings → API** copiá la **Project URL** y la **anon public key**.
3. En **SQL Editor**, ejecutá en orden los archivos de `supabase/migrations/` (`0001`, `0002`,
   `0003`...). Esto crea todas las tablas, las vistas de estadísticas acumuladas, las
   categorías y las reglas de seguridad (cada jugador ve/edita lo suyo, el cuerpo técnico
   ve/edita todo, y solo un administrador puede cambiar roles o el catálogo de categorías).
   Si tenés el MCP de Supabase conectado, pedile a Claude que las aplique directamente.

## 2. Configurar las variables de entorno

Copiá `.env.local.example` a `.env.local` y completá con los datos del paso anterior:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

## 3. Correr la app

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

- El primer usuario que se registra queda como **jugador** por defecto.
- Para el primer administrador, entrá a Supabase → Table Editor → `profiles` y cambiá su
  `role` a `admin`. Desde ahí, ese usuario puede promover a otros (coach/admin), asignar
  categorías y usar el resto de las herramientas del cuerpo técnico directamente desde la app,
  en **Plantel**.

## Roles

- **Jugador**: marca su propia asistencia, ve sus multas, carga su autoevaluación por partido.
- **Cuerpo técnico (coach)**: todo lo del jugador, más CRUD completo de entrenamientos,
  partidos, estadísticas y multas de todo el plantel; asigna categorías a los jugadores.
- **Administrador**: todo lo del cuerpo técnico, más gestión del catálogo de categorías y la
  posibilidad de cambiar el rol de cualquier usuario (protegido a nivel de base de datos: un
  coach no puede auto-promoverse).

## Módulos

- **Asistencia**: cada jugador marca si llegó a horario o tarde; el cuerpo técnico gestiona el
  día completo del plantel desde la pestaña "Tomar asistencia", y programa/edita/elimina
  entrenamientos desde "Entrenamientos". Las multas por llegada tardía o ausencia injustificada
  se generan automáticamente según el estado marcado.
- **Calendario**: vista mensual con todos los entrenamientos y partidos programados; tocar un
  día muestra el detalle y lleva directo a asistencia o al partido correspondiente.
- **Multas**: catálogo de $1000 por falta de uniforme, ausencia injustificada, llegada tardía y
  no llevar espinilleras, con edición, eliminación y seguimiento de pagado/pendiente.
- **Partidos**: CRUD completo (crear, editar, eliminar) con convocado/titular/suplente, minutos,
  goles, asistencias y tarjetas por jugador, acumulados automáticamente en **Plantel**.
- **Plantel**: estadísticas acumuladas, categoría y rol de cada jugador; el administrador
  gestiona el catálogo de categorías desde acá.
- **Autoevaluación**: cada jugador se pone una nota de 1 a 5 por partido con comentario.
- **Scouting rival**: sistema de juego, fortalezas y debilidades cargadas por el cuerpo técnico.

## Deploy en Vercel

1. Andá a [vercel.com/new](https://vercel.com/new) e importá el repo `Stats-futbol`. El
   `package.json` está en la raíz del repo, así que Vercel detecta Next.js automáticamente sin
   tocar el "Root Directory".
2. En **Environment Variables**, cargá las dos mismas que tenés en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Dale a **Deploy**. Con eso ya queda funcionando.
4. **Después del primer deploy**, copiá la URL que te dio Vercel (ej.
   `https://stats-futbol.vercel.app`) y configurala en Supabase → **Authentication → URL
   Configuration**:
   - **Site URL**: la URL de Vercel.
   - **Redirect URLs**: agregá esa misma URL (y `http://localhost:3000` si querés seguir
     probando en local).
   Esto es necesario para que los links de confirmación de email y de recuperar contraseña
   apunten al sitio correcto en vez de a `localhost`.
5. Cada `git push` a `main` dispara un deploy nuevo automáticamente.
