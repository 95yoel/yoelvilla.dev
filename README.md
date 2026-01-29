# Portfolio Web - Yoel Villa

Portfolio personal minimalista con diseño moderno y funcionalidades avanzadas. Desarrollado con Angular 19 y desplegado con arquitectura serverless en AWS.

## 🚀 Características

### Diseño Adaptativo
- **Versión Desktop**: Navegación horizontal con scroll suave y animaciones GSAP
- **Versión Mobile**: Layout vertical optimizado para dispositivos táctiles
- **Detección Automática**: Breakpoint en 768px con BreakpointObserver

### Internacionalización (i18n)
- Sistema de traducción completo Español/Inglés
- Detección automática del idioma del navegador
- Persistencia de preferencias en localStorage
- Pipe reactivo que actualiza la UI instantáneamente
- Panel de selección con banderas (es.svg, en.svg)

### Cursor Personalizado (Solo Desktop)
- Cursor animado con efecto de lag/retraso
- Panel de configuración con opciones en tiempo real:
  - Color personalizable
  - Tamaño del círculo y punto
  - Brillo ajustable
  - Velocidad de seguimiento (delay)
- Efecto de pulsación al hacer clic
- Persistencia de configuración en localStorage

### Formulario de Contacto
- Validación en tiempo real:
  - Nombre: mínimo 2 caracteres
  - Email: formato válido
  - Mensaje: mínimo 3 caracteres
- Honeypot anti-bots (`hp_field`)
- Limpieza automática de espacios
- Botón deshabilitado hasta validación completa
- Integración con AWS Lambda via API Gateway
- Feedback visual de envío (success/error)

### Secciones
1. **Home**: Presentación con nombre y especialización
2. **Sobre mí**: Descripción personal con keywords en negrita
3. **Portfolio**: Placeholder "PRÓXIMAMENTE" (código comentado para futuro)
4. **Contacto**: Formulario + tarjetas de contacto con botones de copia

## 🏗️ Arquitectura Técnica

### Stack Principal
```
Angular 19.2.0
├── TypeScript 5.7.2
├── GSAP (animaciones)
├── @angular/material 19 (tooltips)
├── @angular/cdk 19 (BreakpointObserver)
└── HttpClient (comunicación API)
```

### Estructura de Componentes
```
src/app/
├── components/
│   ├── layout/                    # Container principal con botones
│   ├── desktop-layout/            # Layout horizontal
│   ├── mobile-layout/             # Layout vertical
│   └── shared/
│       ├── custom-cursor/         # Cursor personalizado
│       ├── config-panel/          # Panel configuración cursor
│       ├── language-panel/        # Panel selección idioma
│       └── scroll-btn/            # Botones navegación
├── translations/
│   ├── services/
│   │   └── translation.service.ts # Gestión estado idioma
│   ├── pipes/
│   │   └── translate.pipe.ts      # Pipe reactivo
│   └── [es.json, en.json]         # Diccionarios
├── services/
│   ├── cursor-config.service.ts   # Gestión config cursor
│   └── layout.service.ts          # Detección viewport
└── environments/
    └── environment.ts              # API Gateway URL
```

### Sistema de Traducción
- **TranslationService**: BehaviorSubject para reactividad, carga dinámica de JSON, detección browser
- **TranslatePipe**: Pure: false para actualizaciones automáticas, suscripción a cambios de idioma
- **Archivos JSON**: Estructura anidada (home.title, nav.home, contact.form.name, etc.)
- **Uso**: `{{ 'key' | translate }}` o `[innerHTML]="'key' | translate"`

### Integración Backend
- **API**: AWS API Gateway + Lambda
- **Endpoint**: POST `/contact`
- **Payload**:
```typescript
{
  name: string;
  email: string;
  message: string;
  lang: 'es' | 'en';
}
```

### Validación y Seguridad
- Validación client-side reactiva
- Honeypot con `autocomplete="new-password"` para evitar bots
- CORS configurado en API Gateway
- Sanitización de inputs con `.trim()`

### Animaciones
- **GSAP Context**: Animaciones de entrada/salida de paneles
- **Smooth Scroll**: Navegación horizontal con `scroll-behavior: smooth`
- **Intersection Observer**: Detección de sección visible para navegación activa

### Estilos
- **Filosofía "suave"**: 
  - Backgrounds transparentes: `rgba(255,255,255,.03-.08)`
  - Bordes sutiles con baja opacidad
  - Transiciones lentas (.3s)
  - Sin efectos agresivos
- Variables CSS para colores principales
- Font: Inter (Google Fonts)

## 💻 Desarrollo

### Instalación
```bash
npm install
```

### Servidor de desarrollo
```bash
ng serve
```
Navega a `http://localhost:4200/`

### Build de producción
```bash
ng build
```
Los artefactos se generan en `dist/`

## 🔧 Configuración

### Environment Variables
```typescript
// src/environments/environment.ts
export const environment = {
  CONTACT_API: "https://oa2o9zdgzc.execute-api.eu-west-3.amazonaws.com/prod",
  CONTACT_ENDPOINT: "/contact"
};
```

### TypeScript Config
- `resolveJsonModule: true` - Para importar JSON
- `allowSyntheticDefaultImports: true` - Para imports por defecto

### Material Tooltips
```typescript
// Estilo personalizado
.mdc-tooltip__surface {
  background: transparent !important;
  text-shadow: 0 0 6px rgba(0,0,0,.7);
}
```

## 📝 Notas de Implementación

### Layout Desktop
- Margin-left: 32rem en secciones work/contact para centrado entre sidebar y borde derecho
- Navegación fixed en left: 8rem
- Scroll horizontal con snap points

### Formulario
- FormsModule con ngModel para binding bidireccional
- Validación custom con métodos `isFormValid()`, `isValidEmail()`
- Feedback panel fixed con animación slideIn/slideDown

### Cursor
- Portal a body para escapar stacking contexts
- RequestAnimationFrame para smooth animation
- Lag effect con interpolación matemática

## 🚀 Arquitectura de Despliegue

### Frontend (AWS S3 + CloudFront)
El frontend está desplegado en una arquitectura serverless completamente escalable:

- **S3 Bucket**: Almacenamiento estático de los archivos build (`dist/`)
  - Configurado como website hosting
  - Políticas de bucket para acceso público de lectura
  
- **CloudFront Distribution**: CDN global para distribución mundial
  - Caché en edge locations de AWS en múltiples continentes
  - HTTPS habilitado con certificado SSL/TLS
  - Compresión automática (Gzip/Brotli)
  - Invalidación de caché para nuevos deploys
  - Mejora significativa en tiempos de carga para usuarios globales

### Backend (AWS Lambda + API Gateway)
API serverless completamente gestionada:

- **Lambda Function**: Función sin servidor para procesamiento de formulario de contacto
  - Runtime: Node.js
  - Ejecución on-demand (pay-per-use)
  - Auto-scaling automático
  - Timeout configurado para operaciones de email

- **API Gateway**: Exposición RESTful de la Lambda
  - Endpoint: `https://oa2o9zdgzc.execute-api.eu-west-3.amazonaws.com/prod/contact`
  - Método: POST
  - CORS configurado para permitir peticiones desde el dominio
  - Rate limiting para protección contra abuso
  - Logs de CloudWatch integrados

- **AWS Secrets Manager**: Gestión segura de credenciales
  - Variables de entorno de la Lambda (API keys, SMTP credentials)
  - Rotación automática de secretos
  - Acceso vía IAM roles
  - Cifrado en reposo

### Email (Zoho Mail)
- Correo corporativo personalizado para el dominio `yoelvilla.dev`
- Configuración DNS:
  - Registros MX para enrutamiento de correo
  - SPF, DKIM, DMARC para autenticación y seguridad
- Integración SMTP desde Lambda para envío de notificaciones

### Dominio y DNS
- Dominio personalizado adquirido
- DNS configurado para:
  - CloudFront distribution (frontend)
  - Zoho Mail (MX records)
  - Verificaciones de propiedad

### Flujo de Despliegue
```
1. Build local: ng build --configuration production
2. Upload a S3: aws s3 sync dist/ s3://bucket-name/
3. Invalidación CloudFront: aws cloudfront create-invalidation
4. Lambda actualizada via AWS Console o CLI
```

### Ventajas de esta Arquitectura
- ✅ **Escalabilidad**: Auto-scaling en todos los componentes
- ✅ **Performance**: CDN global + Lambda en edge locations
- ✅ **Coste**: Pay-per-use, casi gratis con tráfico bajo/medio
- ✅ **Seguridad**: HTTPS, Secrets Manager, CORS, rate limiting
- ✅ **Disponibilidad**: 99.99% SLA de AWS
- ✅ **Mantenimiento**: Zero-server management

## 🤔 Decisiones Técnicas

### ¿Por qué Angular en lugar de Astro/Svelte?

Si bien frameworks como Astro o Svelte serían más ligeros y apropiados para un sitio estático, elegí Angular por coherencia profesional:

- **Consistencia con mi stack**: Trabajo con Angular en entornos enterprise, y mi portfolio debe reflejar las herramientas que domino profesionalmente
- **Demostración de habilidades reales**: Preferí mostrar cómo estructuro un proyecto Angular limpio y mantenible, en lugar de aprender un framework nuevo solo para el portfolio
- **Diferencia no significativa**: En un proyecto de esta escala, la diferencia de rendimiento entre frameworks es mínima (< 50KB después de tree-shaking y compresión)
- **Preparado para crecer**: Si en el futuro añado funcionalidades más complejas (panel admin, dashboards, etc.), Angular ya está preparado

### ¿Por qué AWS en lugar de Vercel/GitHub Pages?

Aunque plataformas como Vercel o GitHub Pages simplifican el deployment, opté por AWS deliberadamente:

- **Relevancia profesional**: AWS domina el mercado enterprise (32% del cloud computing mundial). Vercel y GitHub Pages son excelentes para proyectos personales, pero menos comunes en entornos corporativos
- **Ecosistema completo**: Lambda, API Gateway, Secrets Manager, CloudWatch → experiencia con servicios reales que aparecen en ofertas de trabajo
- **Control total**: Configuración de CDN, políticas de seguridad, rate limiting, gestión de secretos... no es "magic deployment", es infraestructura real
- **Aprendizaje transferible**: Los conceptos de S3, CloudFront y Lambda se aplican a proyectos de cualquier escala

### ¿Por qué no CI/CD?

Podría haber implementado GitHub Actions para automatizar el build y deploy a S3, pero:

- **Priorización**: Preferí invertir tiempo en funcionalidades del portfolio y nuevos proyectos, en lugar de over-engineering en este
- **Deployment manual suficiente**: Al ser un proyecto personal con actualizaciones esporádicas, el deploy manual con AWS CLI es más que adecuado
- **Roadmap futuro**: CI/CD está planificado para proyectos más complejos donde múltiples deployments diarios justifiquen la automatización

Estas decisiones reflejan un enfoque pragmático: elegir herramientas que maximicen el valor profesional sin caer en complejidad innecesaria.

## 💻 Desarrollo

### Instalación
```bash
npm install
```

### Servidor de desarrollo
```bash
ng serve
```
Navega a `http://localhost:4200/`

### Build de producción
```bash
ng build --configuration production
```
Los artefactos se generan en `dist/browser/`

## 📄 Licencia
Proyecto personal - Todos los derechos reservados

## 👤 Autor
**Yoel Villa**
- Email: hello@yoelvilla.dev
- LinkedIn: [/in/yoel-villa](https://www.linkedin.com/in/yoel-villa)
- GitHub: [@95yoel](https://github.com/95yoel)

