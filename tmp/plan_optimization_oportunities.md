# Plan de seguimiento: optimization opportunities

## Objetivo de esta rama

Esta rama (`optimization`) se usara para ejecutar las optimizaciones del documento base y, en paralelo, dejar trazabilidad suficiente para convertir el trabajo en articulos tecnicos sobre rendimiento, enfoque, decisiones y resultados.

Documento origen:

- `tmp/optimization_oportunities.md`

## Estado inicial

- [x] Crear rama `optimization`
- [x] Leer `tmp/optimization_oportunities.md`
- [x] Crear este documento de seguimiento
- [x] Ejecutar la tarea 1

## Forma de trabajo

Cuando me indiques una tarea del documento origen, hare dos cosas:

1. Implementar la optimizacion en codigo.
2. Actualizar este archivo con una seccion nueva para dejar seguimiento tecnico y base editorial.

Cada tarea añadida seguira esta plantilla:

## Tarea X. Titulo

### Estado

- [ ] Revisar implementacion actual
- [ ] Aplicar cambios
- [ ] Validar comportamiento
- [ ] Documentar hallazgos para articulo

### Objetivo

Breve descripcion de que se optimiza y por que merece la pena.

### Archivos previstos

- `ruta/archivo-1`
- `ruta/archivo-2`

### Plan de ejecucion

- Paso concreto 1
- Paso concreto 2
- Paso concreto 3

### Cambios realizados

- Pendiente

### Validacion

- Pendiente

### Notas para articulo

- Problema original
- Enfoque aplicado
- Tradeoff o decision importante
- Impacto observado o esperado

## Registro de tareas

## Tarea 1. Evitar polling con `setInterval` para detectar scroll

### Estado

- [x] Revisar implementacion actual
- [x] Aplicar cambios
- [x] Validar comportamiento
- [x] Documentar hallazgos para articulo

### Objetivo

Eliminar el trabajo continuo de `setInterval(150ms)` en las pantallas de blog y sustituirlo por una reaccion a scroll real, reduciendo actividad innecesaria en main thread cuando no hay interaccion.

### Archivos previstos

- `src/app/features/blog/pages/blog-index/blog-index.page.ts`
- `src/app/features/blog/pages/blog-article/blog-article.page.ts`

### Plan de ejecucion

- Revisar como se controla ahora `showScrollTopButton`.
- Sustituir el polling por `fromEvent` con listener `passive`.
- Mantener el mismo umbral visual del boton y validar que la build siga pasando.

### Cambios realizados

- Sustituido `window.setInterval(..., 150)` por una suscripcion RxJS a `scroll`.
- Añadido `auditTime(75)` en `blog-index` para limitar recalculos durante scroll continuo sin volver al polling fijo.
- Usado `this.doc.defaultView` como origen principal del evento para no depender de acceso directo a `window` al inicializar la suscripcion.
- En `blog-index` se escucha tanto `window` como `document`, porque `scroll` no siempre llega de forma uniforme segun la pantalla y el contenedor real que desplaza.
- En `blog-article` se simplifico la regla final: el boton solo depende de si el scroll efectivo esta arriba del todo o no.
- En `blog-article` el boton se oculta solo cuando `scrollTop === 0` y se muestra cuando `scrollTop > 0`, sin depender del click sobre el propio boton.
- En `blog-article` se escucha el scroll sobre todos los candidatos reales (`window`, `document`, `scrollingElement`, `documentElement`, `body`) para seguir el contenedor efectivo de scroll.

### Validacion

- `npm run build` ejecutado correctamente.
- La build sigue mostrando warnings ya existentes de budgets y dependencias CommonJS, pero no introduce errores nuevos por esta tarea.
- Se reprodujo y corrigio un bug funcional en `blog-article`: tras pulsar scroll top, el boton no reaparecia en desplazamientos posteriores.

### Notas para articulo

- Problema original: un `setInterval` pequeño parece barato, pero mantiene trabajo recurrente incluso en reposo.
- Enfoque aplicado: pasar de sondeo temporal a reaccion por evento con throttling ligero donde el origen del scroll es estable.
- Tradeoff o decision importante: no toda pantalla responde igual a una estrategia unica de scroll; a veces conviene optimizar respetando la realidad del contenedor que desplaza.
- Hallazgo de implementacion: al sustituir polling por eventos hay que verificar bien cual es la fuente real del scroll, porque `window` por si solo puede no cubrir todos los casos.
- Hallazgo adicional: el estado del boton debe depender solo de la posicion efectiva (`arriba del todo` vs `no arriba del todo`), no de eventos derivados como el click sobre el boton.
- Impacto observado o esperado: menos trabajo en idle, mejor eficiencia energetica y menos ruido en el main thread en blog index y article.

## Tarea 2. Reducir recomputacion completa del view model en `explore`

### Estado

- [x] Revisar implementacion actual
- [x] Aplicar cambios
- [x] Validar comportamiento
- [x] Documentar hallazgos para articulo

### Objetivo

Evitar que cada cambio de tags en `explore` vuelva a recorrer todos los articulos para recalcular contadores, top tags, series mensuales y listas filtradas completas.

### Archivos previstos

- `src/app/features/explore/pages/explore/explore.page.ts`
- `tmp/plan_optimization_oportunities.md`

### Plan de ejecucion

- Revisar que partes del `buildViewModel()` se recalculan en cada interaccion.
- Extraer un dataset derivado cacheado por idioma.
- Dejar que el filtro de tags solo componga resultados ya preparados y validar con build.

### Cambios realizados

- Añadido un `ExploreDataset` cacheado por idioma dentro de `explore.page.ts`.
- Precalculados una sola vez por idioma los `topTags`, el `Set` de tags visibles, el lookup `articlesByTag` y las series mensuales `timelineByTag`.
- Cambiado `buildViewModel()` para trabajar sobre ese dataset derivado en vez de reconstruir todo desde `articles` en cada seleccion.
- El filtrado de articulos ahora compone resultados desde `articlesByTag` y preserva el orden original recorriendo la lista base una sola vez.
- En `retry()` se limpia tambien la cache derivada local para forzar reconstruccion si se invalidan datos del blog.

### Validacion

- `npm run build` ejecutado correctamente.
- La build sigue mostrando warnings ya existentes de budgets y dependencias CommonJS, pero no introduce errores nuevos por esta tarea.

### Notas para articulo

- Problema original: `explore` mezclaba carga de datos y capa analitica en el mismo `buildViewModel()`, rehaciendo agregaciones enteras por cada click de filtro.
- Enfoque aplicado: separar datos fuente de dataset derivado y cachearlo por idioma, dejando el estado interactivo como una composicion barata.
- Tradeoff o decision importante: mantener la cache dentro del componente es suficiente por ahora y evita abrir todavia una abstraccion nueva de servicio.
- Hallazgo de implementacion: no hace falta precalcular absolutamente todo; basta con identificar los derivados mas caros y reutilizados en cada interaccion.
- Impacto observado o esperado: cambios de tags mas fluidos, menos arrays temporales, menos GC y mejor escalabilidad si crece el numero de articulos.

## Tarea 4. Revisar el cursor custom en desktop

### Estado

- [x] Revisar implementacion actual
- [x] Aplicar cambios
- [x] Validar comportamiento
- [x] Documentar hallazgos para articulo

### Objetivo

Reducir el coste continuo del cursor custom en desktop, especialmente su `requestAnimationFrame` permanente y parte del trabajo repetido ligado a eventos globales.

### Archivos previstos

- `src/app/components/shared/custom-cursor/custom-cursor.component.ts`
- `tmp/plan_optimization_oportunities.md`

### Plan de ejecucion

- Revisar el loop de animacion y los listeners globales del cursor.
- Parar el loop cuando la pestaña no esta visible o cuando el puntero ha salido de la ventana.
- Evitar recalculos innecesarios de modo visual si el target bajo el puntero no ha cambiado.

### Cambios realizados

- Añadido control explicito de visibilidad del documento para parar el loop cuando la pestaña no esta visible.
- Añadido control de entrada/salida del puntero en ventana para detener el `requestAnimationFrame` cuando el cursor no puede aportar valor visual.
- El loop de animacion ahora solo se reactiva cuando vuelve a haber condiciones reales para mostrar el cursor.
- Se memoriza el ultimo `Element` usado para `syncModeFromTarget()` y se evita recalcular el modo grafico si el target no cambia.
- Se bloquea tambien el `click pulse` cuando la pestaña no esta visible o cuando el puntero no esta dentro de la ventana.

### Validacion

- `npm run build` ejecutado correctamente.
- La build sigue mostrando warnings ya existentes de budgets y dependencias CommonJS, pero no introduce errores nuevos por esta tarea.

### Notas para articulo

- Problema original: el cursor custom mantenia un loop permanente y escuchas globales activas aunque la pestaña estuviera en segundo plano o el puntero ya no estuviera en ventana.
- Enfoque aplicado: convertir el cursor en un sistema mas oportunista, que anima solo cuando tiene sentido visual hacerlo.
- Tradeoff o decision importante: se mantiene la experiencia visual, pero se prioriza cortar trabajo continuo en estados donde el usuario no percibe beneficio.
- Hallazgo de implementacion: cachear el ultimo target del puntero evita microtrabajo repetido en cada `mousemove` sin cambiar el diseño.
- Impacto observado o esperado: menos CPU continua en desktop, menos coste en background tabs y menor ruido en main thread.

## Tarea 6. Eliminar `startWith({ status: 'loading' })` innecesarios en flujos que ya tienen cache

### Estado

- [x] Revisar implementacion actual
- [x] Aplicar cambios
- [x] Validar comportamiento
- [x] Documentar hallazgos para articulo

### Objetivo

Evitar que cambios locales de filtros o busqueda en blog vuelvan a emitir `loading`, desmonten partes de la UI y provoquen flicker innecesario cuando los datos base ya estan cargados o cacheados.

### Archivos previstos

- `src/app/features/blog/pages/blog-index/blog-index.page.ts`
- `src/app/features/blog/pages/blog-article/blog-article.page.ts`
- `tmp/plan_optimization_oportunities.md`

### Plan de ejecucion

- Separar la carga remota de datos del estado derivado de interfaz.
- Hacer que filtros y busqueda transformen un dataset ya cargado en vez de reiniciar el flujo con `loading`.
- Validar que el patron queda consistente tambien en `blog-article`.

### Cambios realizados

- En `blog-index` se ha separado `indexData$` de `vm$`.
- `indexData$` gestiona solo la carga real de `getIndex()` y `getGraphData()`, incluyendo `loading` y `error`.
- `vm$` en `blog-index` ahora compone filtros y busqueda sobre `indexData$` ya resuelto, sin volver a emitir `loading` por cambios locales.
- En `blog-article` se ha dejado el mismo patron con `articleData$` separado del `vm$`, para que la estructura de carga remota y view model sea consistente.

### Validacion

- `npm run build` ejecutado correctamente.
- La build sigue mostrando warnings ya existentes de budgets y dependencias CommonJS, pero no introduce errores nuevos por esta tarea.

### Notas para articulo

- Problema original: `loading` no debe pertenecer a cualquier recomputacion; si se mezcla con estado local, la UI hace trabajo visual innecesario.
- Enfoque aplicado: separar claramente datos remotos y estado derivado de interfaz.
- Tradeoff o decision importante: introducir streams intermedios hace el flujo un poco mas explicito, pero evita flicker y remounts innecesarios.
- Hallazgo de implementacion: cuando los datos base ya viven en cache, los filtros deben ser una transformacion pura del estado cargado, no una pseudo-recarga.
- Impacto observado o esperado: menos parpadeo, menos relanzamiento de animaciones y menor coste de montaje en blog index.

## Tarea 7. Mejorar la estrategia de cache de blog

### Estado

- [x] Revisar implementacion actual
- [x] Aplicar cambios
- [x] Validar comportamiento
- [x] Documentar hallazgos para articulo

### Objetivo

Extender la cache actual en memoria para que `index.json` y los articulos ya abiertos sobrevivan a un refresh dentro de la misma sesion y no dependan solo de `shareReplay(1)`.

### Archivos previstos

- `src/app/features/blog/services/blog.service.ts`
- `tmp/plan_optimization_oportunities.md`

### Plan de ejecucion

- Revisar la cache actual de `BlogService` y sus puntos de invalidacion.
- Añadir una capa de `sessionStorage` para `index` y articulos por `lang:slug`.
- Mantener compatibilidad con la cache en memoria y validar build.

### Cambios realizados

- Añadida una segunda capa de cache en `sessionStorage` para el recurso de indice por idioma.
- Añadida cache de sesion para articulos por clave `lang:slug`.
- Si existen datos en sesion, `BlogService` los sirve sin nueva peticion de red y vuelve a montar la cache en memoria desde ahi.
- `clearCaches()` ahora admite invalidacion mas fina por idioma y por articulo, manteniendo compatibilidad con la llamada sin argumentos.
- Los accesos a `localStorage` y `sessionStorage` se encapsulan con guardas seguras para evitar fallos fuera de browser.

### Validacion

- `npm run build` ejecutado correctamente.
- La build sigue mostrando warnings ya existentes de budgets y dependencias CommonJS, pero no introduce errores nuevos por esta tarea.

### Notas para articulo

- Problema original: `shareReplay(1)` acelera la sesion viva, pero no ayuda tras un refresh ni permite invalidacion granular.
- Enfoque aplicado: combinar cache en memoria para la sesion activa con `sessionStorage` para rehidratar datos calientes tras recarga.
- Tradeoff o decision importante: `sessionStorage` es una mejora pragmatica y simple antes de dar el salto a algo mas complejo como IndexedDB.
- Hallazgo de implementacion: una cache persistida necesita invalidacion mas precisa que un simple `clear all`, aunque se mantenga esa opcion.
- Impacto observado o esperado: aperturas repetidas mas rapidas, menos parsing repetido y menos peticiones al volver a index o articulos dentro de la misma sesion.

## Tarea 13. Externalizar analytics y construccion de grafo a Web Workers

### Estado

- [x] Analizar arquitectura actual
- [x] Diseñar contrato de mensajes
- [x] Implementar workers
- [x] Integrar workers en componentes
- [ ] Medir impacto real
- [x] Documentar resultados para articulo

### Objetivo

Mover a segundo plano el trabajo de calculo mas pesado de `explore` y de la construccion del subgrafo del blog, dejando en main thread solo el render y la interaccion inmediata.

### Alcance recomendado

- `explore`: mover agregaciones, top tags, series mensuales, filtrado y preparacion de modelos de datos.
- `blog graph`: mover `buildArticleGraph()` y toda la preparacion estructural de nodos, edges, metadata y bounding box.
- Mantener en main thread: `Sigma`, `echarts`, `lightweight-charts`, hover, drag, tooltip y reducers visuales.

### Archivos actuales implicados

- `src/app/features/explore/pages/explore/explore.page.ts`
- `src/app/features/explore/services/explore-analytics.worker.ts`
- `src/app/features/explore/services/explore-analytics-worker.service.ts`
- `src/app/features/explore/utils/explore-analytics.utils.ts`
- `src/app/features/blog/utils/blog-graph.utils.ts`
- `src/app/features/blog/components/blog-graph-modal/blog-graph-modal.component.ts`
- `src/app/features/blog/services/blog-graph.worker.ts`
- `src/app/features/blog/services/blog-graph-worker.service.ts`
- `tmp/plan_optimization_oportunities.md`

### Analisis tecnico

- En `explore`, el coste relevante esta en la preparacion de datasets y no en la instancia del chart.
- En el grafo del blog, el coste candidato a worker es la construccion estructural del subgrafo, no la capa Sigma de render e interaccion.
- Mandar hover continuo, drag o posicionamiento de tooltip a worker no compensa: añade latencia y ruido de mensajes.

### Arquitectura propuesta

- `explore-analytics.worker.ts`
- `blog-graph.worker.ts`
- `ExploreAnalyticsWorkerService`
- `BlogGraphWorkerService`

Cada worker deberia recibir datos puros y devolver estructuras serializables, evitando dependencias de DOM o instancias de librerias de render.

### Contratos sugeridos

- Worker de `explore`
  Entrada: `articles`, `selectedTags`, `lang`, `mode`
  Salida: `topTags`, `filteredArticleSlugs`, `timelineSeries`, `barChartModel`

- Worker de `blog graph`
  Entrada: `graphData`, `currentSlug`, `limit`, `mode`
  Salida: `nodes`, `edges`, `nodeMetaBySlug`, `adjacency`, `edgeKeysByNode`, `edgeMetaByKey`, `bbox`

### Cambios realizados

- Implementado `explore-analytics.worker.ts` para preparar dataset por idioma y aplicar seleccion de tags fuera del main thread.
- Implementado `ExploreAnalyticsWorkerService` con fallback sincronico para entornos sin soporte de workers.
- Refactorizado `explore.page.ts` para consumir analytics desde worker y dejar en main thread solo la composicion final de series y el render de charts.
- Refactorizada la construccion del grafo del blog para generar primero un snapshot serializable.
- Implementado `blog-graph.worker.ts` para construir ese snapshot en segundo plano.
- Implementado `BlogGraphWorkerService` con fallback sincronico.
- `blog-graph-modal.component.ts` ahora materializa el `graphology` graph en main thread a partir del snapshot devuelto por worker, manteniendo Sigma e interaccion fuera del worker.

### Validacion

- `npm run build` ejecutado correctamente.
- La build ya genera bundles dedicados para `explore-analytics-worker` y `blog-graph-worker`.
- Siguen presentes warnings ya existentes de budgets y dependencias CommonJS, sin errores nuevos por esta tarea.

### Orden recomendado

1. Workerizar `explore` primero.
2. Workerizar despues la construccion del subgrafo del blog.
3. Medir antes y despues con Performance panel y marcas concretas.
4. Solo plantear `OffscreenCanvas` si los cuellos reales siguen estando en render y no en calculo.

### Notas para articulo

- Idea central: no todo lo costoso debe salir del main thread; hay que separar calculo de render.
- Enfoque defendible: mover preparacion de datos, no eventos de puntero por frame.
- Mensaje tecnico: `Web Workers` dan valor cuando desacoplas computacion pura, no cuando intentas sacar a la fuerza una UI interactiva entera.
- Resultado practico: `explore` y la construccion del subgrafo ya pueden trabajar en segundo plano, mientras que Sigma y los charts siguen en main thread para conservar respuesta inmediata al usuario.
