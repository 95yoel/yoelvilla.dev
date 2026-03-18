# Yoel Villa - Portfolio and Blog

Personal site built with Angular 19. It combines a bilingual portfolio, a responsive contact experience, and a blog with article search, filters, graph-based relation browsing, sharing, and dynamic SEO metadata.

Live site: [https://yoelvilla.dev](https://yoelvilla.dev)

## Overview

The project has two main surfaces:

- Portfolio:
  desktop and mobile layouts with different interaction models
- Blog:
  localized index and article pages backed by markdown content from a separate repository

Current notable features:

- Spanish and English UI with local persistence
- Desktop custom cursor with configurable behavior
- Contact form connected to AWS API Gateway + Lambda
- Blog article search, filters, and sidebar navigation
- Graph modal for exploring related articles
- Share button on article pages
- Dynamic canonical, Open Graph, and Twitter meta tags per article

## Tech Stack

- Angular 19
- TypeScript
- Angular Material / CDK
- GSAP
- Marked
- Sigma + Graphology
- Angular SSR packages available in the project

## Project Structure

```text
src/app/
  components/
    layout/
    desktop-layout/
    mobile-layout/
    shared/
      config-panel/
      custom-cursor/
      language-panel/
      scroll-btn/
  features/
    blog/
      components/
        blog-graph-modal/
        blog-sidebar/
      models/
      pages/
        blog-index/
        blog-article/
      services/
        blog-routing.service.ts
        blog.service.ts
      utils/
        blog-graph.utils.ts
  services/
    contact.service.ts
    cursor-config.service.ts
    layout.service.ts
    portfolio.service.ts
    section-navigation.service.ts
  translations/
    en.json
    es.json
```

## Portfolio

The portfolio is not a generic landing page. Desktop and mobile intentionally behave differently:

- Desktop:
  horizontal navigation, GSAP-driven transitions, custom cursor, section-focused interaction
- Mobile:
  vertical flow, simplified controls, direct access to the blog and language switcher

Shared state has been extracted into services where it matters:

- `ContactService` handles form state, submission, and feedback
- `PortfolioService` centralizes portfolio state used across layouts
- `SectionNavigationService` coordinates desktop section state
- `LayoutService` switches between desktop and mobile renderers

## Blog

The blog is loaded from markdown plus an index file hosted in a separate content repository.

Main capabilities:

- localized routes:
  `/blog/es`, `/blog/en`, `/blog/es/:slug`, `/blog/en/:slug`
- article search by title and summary
- tag and date filters
- article reading-time calculation
- graph modal that visualizes related articles
- share button with `navigator.share` and clipboard fallback
- dynamic SEO metadata on article pages:
  `title`, `description`, `keywords`, `canonical`, `og:*`, `twitter:*`, `article:published_time`

## Configuration

Current environment values in `src/environments/environment.ts` and `src/environments/environment.development.ts`:

```ts
export const environment = {
  CONTACT_API: "https://oa2o9zdgzc.execute-api.eu-west-3.amazonaws.com/prod",
  CONTACT_ENDPOINT: "/contact",
  BLOG_BASE_URL: "https://raw.githubusercontent.com/95yoel/yoelvilla.dev-articles/graph-navigation",
  SITE_URL: "https://yoelvilla.dev",
  DEFAULT_OG_IMAGE: "https://yoelvilla.dev/preview.png"
}
```

Important note:

- `BLOG_BASE_URL` currently points to the `graph-navigation` branch of `yoelvilla.dev-articles`
- if production content should come from another branch, update that value before deploying

## Scripts

```bash
npm install
npm run start
npm run build
npm run watch
npm run test
```

SSR-related script already present in `package.json`:

```bash
npm run serve:ssr:basic_web
```

## Deployment Notes

The frontend is deployed on AWS and the contact backend is served through API Gateway + Lambda.

High-level setup:

- frontend:
  Angular build served from S3 + CloudFront
- contact backend:
  AWS Lambda behind API Gateway
- domain:
  `yoelvilla.dev`

## README Status

This README reflects the current codebase on `main` after:

- blog graph navigation work
- article sharing
- dynamic SEO metadata updates

If the content source branch changes again, the configuration section should be updated as well.
