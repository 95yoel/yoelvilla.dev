# Portfolio Web - Yoel Villa

<div align="center">

### 🌍 Choose your language / Elige tu idioma

<a href="#english-version"><img src="public/icons/en.svg" alt="English" width="32" height="32"></a> &nbsp;&nbsp;&nbsp;&nbsp; <a href="#versión-en-español"><img src="public/icons/es.svg" alt="Español" width="32" height="32"></a>

</div>

---

<a name="english-version"></a>
## 🇬🇧 English Version

Minimalist personal portfolio with modern design and advanced features. Built with Angular 19 and deployed with serverless architecture on AWS.

🔗 **Live demo**: [https://yoelvilla.dev](https://yoelvilla.dev)

**[🇪🇸 Ver versión en español](#versión-en-español)**

## 🚀 Features

### Responsive Design
- **Desktop Version**: Horizontal navigation with smooth scroll and GSAP animations
- **Mobile Version**: Vertical layout optimized for touch devices
- **Automatic Detection**: 768px breakpoint with BreakpointObserver

### Internationalization (i18n)
- Complete Spanish/English translation system
- Automatic browser language detection
- Preference persistence in localStorage
- Reactive pipe that instantly updates the UI
- Selection panel with flags (es.svg, en.svg)

### Custom Cursor (Desktop Only)
- Animated cursor with lag/delay effect
- Configuration panel with real-time options:
  - Customizable color
  - Circle and dot size
  - Adjustable brightness
  - Follow speed (delay)
- Click pulse effect
- Configuration persistence in localStorage

### Contact Form
- Real-time validation:
  - Name: minimum 2 characters
  - Email: valid format
  - Message: minimum 3 characters
- Anti-bot honeypot (`hp_field`)
- Automatic space cleanup
- Button disabled until complete validation
- Integration with AWS Lambda via API Gateway
- Visual submission feedback (success/error)

### Sections
1. **Home**: Introduction with name and specialization
2. **About**: Personal description with keywords in bold
3. **Portfolio**: Active project showcase with navigation
4. **Contact**: Form + contact cards with copy buttons

## � Design Philosophy

The navigation is the core of the experience.  
Instead of a traditional top navbar, I designed a persistent lateral navigation that acts as the main interaction anchor.

Horizontal scrolling reinforces the idea of moving through sections as spaces, not as a vertical document.

The color palette follows a "soft contrast" philosophy: muted tones, low-opacity surfaces and subtle highlights. This creates a calm, focused atmosphere where content and motion stand out without visual noise.

The goal was to create a portfolio that feels more like a navigable interface than a traditional webpage.

## �🏗️ Technical Architecture

### Main Stack
```
Angular 19.2.0
├── TypeScript 5.7.2
├── GSAP (animations)
├── @angular/material 19 (tooltips)
├── @angular/cdk 19 (BreakpointObserver)
└── HttpClient (API communication)
```

### Component Structure
```
src/app/
├── components/
│   ├── layout/                    # Main container with buttons
│   ├── desktop-layout/            # Horizontal layout
│   ├── mobile-layout/             # Vertical layout
│   └── shared/
│       ├── custom-cursor/         # Custom cursor
│       ├── config-panel/          # Cursor config panel
│       ├── language-panel/        # Language selection panel
│       └── scroll-btn/            # Navigation buttons
├── translations/
│   ├── services/
│   │   └── translation.service.ts # Language state management
│   ├── pipes/
│   │   └── translate.pipe.ts      # Reactive pipe
│   └── [es.json, en.json]         # Dictionaries
├── services/
│   ├── cursor-config.service.ts   # Cursor config management
│   └── layout.service.ts          # Viewport detection
└── environments/
    └── environment.ts              # API Gateway URL
```

### Translation System
- **TranslationService**: BehaviorSubject for reactivity, dynamic JSON loading, browser detection
- **TranslatePipe**: Pure: false for automatic updates, subscription to language changes
- **JSON Files**: Nested structure (home.title, nav.home, contact.form.name, etc.)
- **Usage**: `{{ 'key' | translate }}` or `[innerHTML]="'key' | translate"`

### Backend Integration
- **API**: AWS API Gateway + Lambda
- **Endpoint**: POST `/contact`
- **Payload**:
```typescript
{
  name: string
  email: string
  message: string
  lang: 'es' | 'en'
}
```

### Validation and Security
- Reactive client-side validation
- Honeypot with `autocomplete="new-password"` to prevent bots
- CORS configured in API Gateway
- Input sanitization with `.trim()`

### Animations
- **GSAP Context**: Panel entry/exit animations
- **Smooth Scroll**: Horizontal navigation with `scroll-behavior: smooth`
- **Intersection Observer**: Visible section detection for active navigation

### Styles
- **"Soft" Philosophy**: 
  - Transparent backgrounds: `rgba(255,255,255,.03-.08)`
  - Subtle borders with low opacity
  - Slow transitions (.3s)
  - No aggressive effects
- CSS variables for main colors
- Font: Inter (Google Fonts)

##  Configuration

### Environment Variables
```typescript
// src/environments/environment.ts
export const environment = {
  CONTACT_API: "https://oa2o9zdgzc.execute-api.eu-west-3.amazonaws.com/prod",
  CONTACT_ENDPOINT: "/contact"
}
```

### TypeScript Config
- `resolveJsonModule: true` - To import JSON
- `allowSyntheticDefaultImports: true` - For default imports

### Material Tooltips
```typescript
// Custom styling
.mdc-tooltip__surface {
  background: transparent !important
  text-shadow: 0 0 6px rgba(0,0,0,.7)
}
```

## 📝 Implementation Notes

### Desktop Layout
- Margin-left: 32rem in work/contact sections for centering between sidebar and right edge
- Fixed navigation at left: 8rem
- Horizontal scroll with snap points

### Form
- FormsModule with ngModel for two-way binding
- Custom validation with `isFormValid()`, `isValidEmail()` methods
- Fixed feedback panel with slideIn/slideDown animation

### Cursor
- Portal to body to escape stacking contexts
- RequestAnimationFrame for smooth animation
- Lag effect with mathematical interpolation

## 🚀 Deployment Architecture

### Frontend (AWS S3 + CloudFront)
The frontend is deployed on a fully scalable serverless architecture:

- **S3 Bucket**: Static storage for build files (`dist/`)
  - Configured as website hosting
  - Bucket policies for public read access
  
- **CloudFront Distribution**: Global CDN for worldwide distribution
  - Cache in AWS edge locations across multiple continents
  - HTTPS enabled with SSL/TLS certificate
  - Automatic compression (Gzip/Brotli)
  - Cache invalidation for new deployments
  - Significant improvement in load times for global users

### Backend (AWS Lambda + API Gateway)
Fully managed serverless API:

- **Lambda Function**: Serverless function for contact form processing
  - Runtime: Node.js
  - On-demand execution (pay-per-use)
  - Automatic auto-scaling
  - Configured timeout for email operations

- **API Gateway**: RESTful Lambda exposure
  - Endpoint: `https://oa2o9zdgzc.execute-api.eu-west-3.amazonaws.com/prod/contact`
  - Method: POST
  - CORS configured to allow requests from domain
  - Rate limiting for abuse protection
  - Integrated CloudWatch logs

- **AWS Secrets Manager**: Secure credential management
  - Lambda environment variables (API keys, SMTP credentials)
  - Automatic secret rotation
  - Access via IAM roles
  - Encryption at rest

### Email (Zoho Mail)
- Custom corporate email for `yoelvilla.dev` domain
- DNS configuration:
  - MX records for email routing
  - SPF, DKIM, DMARC for authentication and security
- SMTP integration from Lambda for notification sending

### Domain and DNS
- Custom domain acquired
- DNS configured for:
  - CloudFront distribution (frontend)
  - Zoho Mail (MX records)
  - Ownership verifications

### Deployment Flow
```
1. Local build: ng build --configuration production
2. Upload to S3: aws s3 sync dist/ s3://bucket-name/
3. CloudFront invalidation: aws cloudfront create-invalidation
4. Lambda updated via AWS Console or CLI
```

### Architecture Advantages
- ✅ **Scalability**: Auto-scaling in all components
- ✅ **Performance**: Global CDN + Lambda in edge locations
- ✅ **Cost**: Pay-per-use, almost free with low/medium traffic
- ✅ **Security**: HTTPS, Secrets Manager, CORS, rate limiting
- ✅ **Availability**: 99.99% AWS SLA
- ✅ **Maintenance**: Zero-server management

## 🤔 Technical Decisions

### Why Angular instead of Astro/Svelte?

While frameworks like Astro or Svelte would be lighter and more suitable for a static site, I chose Angular for professional consistency:

- **Consistency with my stack**: I work with Angular in enterprise environments, and my portfolio should reflect the tools I professionally master
- **Demonstration of real skills**: I preferred to show how I structure a clean and maintainable Angular project, rather than learning a new framework just for the portfolio
- **Not significant difference**: In a project of this scale, the performance difference between frameworks is minimal (< 50KB after tree-shaking and compression)
- **Ready to grow**: If I add more complex features in the future (admin panel, dashboards, etc.), Angular is already prepared

### Why AWS instead of Vercel/GitHub Pages?

Although platforms like Vercel or GitHub Pages simplify deployment, I deliberately chose AWS:

- **Professional relevance**: AWS dominates the enterprise market (32% of global cloud computing). Vercel and GitHub Pages are excellent for personal projects, but less common in corporate environments
- **Complete ecosystem**: Lambda, API Gateway, Secrets Manager, CloudWatch → experience with real services that appear in job offers
- **Total control**: CDN configuration, security policies, rate limiting, secret management... it's not "magic deployment", it's real infrastructure
- **Transferable learning**: S3, CloudFront, and Lambda concepts apply to projects of any scale

### Why no CI/CD?

I could have implemented GitHub Actions to automate build and deploy to S3, but:

- **Prioritization**: I preferred to invest time in portfolio features and new projects, rather than over-engineering this one
- **Manual deployment sufficient**: Being a personal project with sporadic updates, manual deployment with AWS CLI is more than adequate
- **Future roadmap**: CI/CD is planned for more complex projects where multiple daily deployments justify automation

These decisions reflect a pragmatic approach: choosing tools that maximize professional value without falling into unnecessary complexity.

## 📄 License
Personal project - All rights reserved

## 👤 Author
**Yoel Villa**
- Email: hello@yoelvilla.dev
- LinkedIn: [/in/yoel-villa](https://www.linkedin.com/in/yoel-villa)
- GitHub: [@95yoel](https://github.com/95yoel)

---

<a name="versión-en-español"></a>
## 🇪🇸 Versión en Español

Portfolio personal minimalista con diseño moderno y funcionalidades avanzadas. Desarrollado con Angular 19 y desplegado con arquitectura serverless en AWS.

🔗 **Demo en vivo**: [https://yoelvilla.dev](https://yoelvilla.dev)

**[🇬🇧 View English version](#english-version)**

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

## � Filosofía de Diseño

La navegación es el núcleo de la experiencia.  
En lugar de una barra superior tradicional, diseñé una navegación lateral persistente que actúa como el ancla principal de interacción.

El scroll horizontal refuerza la idea de moverse a través de las secciones como espacios, no como un documento vertical.

La paleta de colores sigue una filosofía de "contraste suave": tonos apagados, superficies de baja opacidad y acentos sutiles. Esto crea una atmósfera calmada y enfocada donde el contenido y el movimiento destacan sin ruido visual.

El objetivo fue crear un portfolio que se sienta más como una interfaz navegable que como una página web tradicional.

## �🏗️ Arquitectura Técnica

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

##  Configuración

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

