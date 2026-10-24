# Inventario y Facturación · Web

Cliente web de la [API de Inventario y Facturación](https://github.com/IrvinSegura/Sistema-de-Inventario-y-Facturacion):
punto de venta y caja para una tienda de abarrotes.

![Panel](docs/screenshots/dashboard.png)

Contenido: [Características](#características) · [Capturas de pantalla](#capturas-de-pantalla) · [Stack](#stack) ·
[Instalación](#instalación) · [Scripts](#scripts) · [Variables de entorno](#variables-de-entorno)

## Características

- Inicio de sesión con JWT; la sesión sobrevive a las recargas y el token de acceso se renueva sin que el usuario
  lo note. Las renovaciones se serializan entre pestañas (Web Locks), porque la API rota los refresh tokens y
  revoca todas las sesiones si se reutiliza uno viejo.
- Caja: abrir la caja del día con un fondo inicial y cerrarla con un conteo a ciegas (el efectivo esperado solo
  se muestra después de registrar el conteo).
- Punto de venta: escanear o escribir códigos de barras, ajustar cantidades, vista previa del IVA por línea (con
  el mismo redondeo que la API), cambio en efectivo y un `Idempotency-Key` por cobro, para que un doble clic o un
  reintento nunca cobre dos veces.
- Ventas (gerentes): todos los tickets con los totales del periodo (ventas, ticket promedio, IVA, cancelaciones y
  formas de pago), filtros por número de ticket, vendedor, cliente y estado, el detalle completo de cada venta,
  reimpresión, cancelación con motivo y un reporte en Excel (hojas de resumen y de tickets).
- Compras (gerentes): registrar entradas de un proveedor (buscar o escanear productos, cantidad y costo unitario
  por línea, margen contra el precio de venta, un `Idempotency-Key` por compra), el historial de compras con
  totales por periodo y proveedor, detalle imprimible, "repetir compra", un reporte en Excel (resumen, compras y
  cada producto comprado) y el catálogo de proveedores.
- Inventario (gerentes): existencias de cada producto con ajustes rápidos, el reporte de stock bajo (resurtir los
  productos seleccionados, o todos, en una compra nueva) y el kardex de cada producto con enlaces a la compra o
  venta detrás de cada movimiento; los tres exportan un reporte de Excel con formato.
- Reportes: ventas contra el periodo anterior de la misma duración (cifras, utilidad bruta para gerentes, ventas
  por día, semana o mes junto a los mismos días anteriores, formas de pago, vendedores y productos más vendidos);
  los vendedores ven las suyas. Los gerentes además tienen ventas por producto (costo, utilidad bruta y margen, o
  los productos en existencia que no se vendieron), ventas por cliente registrado, el corte de caja de cualquier
  día (por forma de pago y vendedor, con el conteo y la diferencia de cada caja) e ingresos y egresos (ventas
  contra compras, flujo neto y acumulado). Cada uno se imprime o se exporta a Excel.

- Reportes en Excel: cada uno abre con un panel (tarjetas de cifras, tablas de resumen junto a gráficas nativas de
  Excel) seguido de los datos como tablas reales de Excel (filtros, filas alternadas, totales que siguen a los
  filtros). Las cifras y columnas calculadas son fórmulas sobre los datos, y los formatos condicionales y barras
  de datos marcan lo que requiere atención, así que editar el libro lo mantiene consistente.

- Español e inglés (detectado del navegador, se puede cambiar), incluidos los mensajes de error comunes de la API;
  temas claro y oscuro (o el del sistema). Ambas preferencias se recuerdan por navegador.

## Capturas de pantalla

Tomadas con datos de demostración (una tienda con dos meses de ventas). Todas las pantallas están también en
inglés y en tema oscuro:

![Panel en tema oscuro](docs/screenshots/dashboard-dark.png)

### Inicio de sesión y punto de venta

| Inicio de sesión | Punto de venta (vendedores) |
|---|---|
| ![Inicio de sesión](docs/screenshots/login.png) | ![Punto de venta](docs/screenshots/checkout.png) |

### Caja

| Caja de un vendedor | Cajas del día (gerentes) |
|---|---|
| ![Caja de un vendedor](docs/screenshots/cash-drawer.png) | ![Cajas del día](docs/screenshots/cash-drawers-today.png) |

### Supervisión y ventas

| Supervisión | Ventas |
|---|---|
| ![Supervisión](docs/screenshots/supervision.png) | ![Ventas](docs/screenshots/sales.png) |

### Catálogo e inventario

| Productos | Clientes |
|---|---|
| ![Productos](docs/screenshots/products.png) | ![Clientes](docs/screenshots/customers.png) |

| Existencias | Stock bajo |
|---|---|
| ![Existencias](docs/screenshots/inventory.png) | ![Stock bajo](docs/screenshots/low-stock.png) |

| Kardex | |
|---|---|
| ![Kardex](docs/screenshots/movements.png) | |

### Compras

| Historial de compras | Nueva compra |
|---|---|
| ![Historial de compras](docs/screenshots/purchases.png) | ![Nueva compra](docs/screenshots/new-purchase.png) |

| Proveedores | |
|---|---|
| ![Proveedores](docs/screenshots/suppliers.png) | |

### Reportes

| Ventas contra el periodo anterior | Ventas por producto |
|---|---|
| ![Reporte de ventas](docs/screenshots/report-sales.png) | ![Ventas por producto](docs/screenshots/report-products.png) |

| Corte de caja | Ingresos y egresos |
|---|---|
| ![Corte de caja](docs/screenshots/report-cash-closing.png) | ![Ingresos y egresos](docs/screenshots/report-cash-flow.png) |

### Usuarios (administradores)

![Usuarios](docs/screenshots/users.png)

## Stack

React 19, TypeScript, Vite, Tailwind CSS + shadcn/ui, TanStack Query, React Router, React Hook Form + Zod,
openapi-fetch con tipos generados desde el documento OpenAPI de la API, ExcelJS y JSZip (se cargan solo al
descargar un reporte), Vitest, oxlint.

## Instalación

Requiere Node 22+ y Git. El cliente web necesita la API en ejecución: instálala primero con los pasos del
[README de la API](https://github.com/IrvinSegura/Sistema-de-Inventario-y-Facturacion#instalación).

1. Clona el repositorio e instala las dependencias:

   ```bash
   git clone https://github.com/IrvinSegura/Sistema-de-Inventario-y-Facturacion_Front.git inventory-billing-web
   cd inventory-billing-web
   npm install
   ```

2. Apunta el cliente a la API. `.env.development` ya usa `http://localhost:8080`, la dirección local de la API;
   para otra, crea `.env.development.local` (ignorado por git):

   ```dotenv
   VITE_API_URL=http://localhost:8080
   ```

   La API solo responde a los orígenes de su `CORS_ALLOWED_ORIGINS`, que por defecto es `http://localhost:5173`.

3. Inicia el servidor de desarrollo y abre http://localhost:5173:

   ```bash
   npm run dev
   ```

4. Inicia sesión con el admin inicial de la API (`ADMIN_EMAIL` / `ADMIN_PASSWORD` en el `.env` de la API). Desde
   **Usuarios** crea a los supervisores y vendedores; desde **Categorías** y **Productos**, el catálogo; y desde
   **Compras**, la primera entrada de mercancía. Un vendedor abre la caja del día en **Caja** antes de vender en
   **Venta**.

### Build de producción

```bash
npm run build
```

El sitio estático queda en `dist/`. Usa `VITE_API_URL` de `.env.production` (o del entorno del hosting), y la API
debe incluir el origen del sitio en su `CORS_ALLOWED_ORIGINS`. Todas las rutas las maneja el cliente, así que el
hosting debe responder `index.html` en las rutas que no conoce.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Revisión de tipos y build de producción (`dist/`) |
| `npm run lint` | oxlint |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run api:generate` | Regenera `src/api/schema.d.ts` desde el documento OpenAPI de la API desplegada |

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API, sin diagonal final (`.env.development` / `.env.production`) |
| `VITE_STORE_TIME_ZONE` | Zona horaria de la tienda (ID IANA), la misma que `app.store.time-zone` de la API; los filtros de fecha, "hoy" y todas las fechas y horas mostradas la siguen. Sin definir o vacía usa `America/Mexico_City`. Una zona inválida hace fallar `npm run build`, y una app compilada con ella se detiene al cargar (página en blanco, con un error que nombra esta variable en la consola del navegador) |
