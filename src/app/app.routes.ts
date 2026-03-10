import { Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';

export const routes: Routes = [
  {
    path: 'blog/es',
    loadComponent: () => import('./features/blog/pages/blog-index/blog-index.page').then((m) => m.BlogIndexPage)
  },
  {
    path: 'blog/en',
    loadComponent: () => import('./features/blog/pages/blog-index/blog-index.page').then((m) => m.BlogIndexPage)
  },
  {
    path: 'blog/es/:slug',
    loadComponent: () => import('./features/blog/pages/blog-article/blog-article.page').then((m) => m.BlogArticlePage)
  },
  {
    path: 'blog/en/:slug',
    loadComponent: () => import('./features/blog/pages/blog-article/blog-article.page').then((m) => m.BlogArticlePage)
  },
  {
    path: 'blog',
    loadComponent: () => import('./features/blog/pages/blog-index/blog-index.page').then((m) => m.BlogIndexPage)
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./features/blog/pages/blog-article/blog-article.page').then((m) => m.BlogArticlePage)
  },
  { path: '', component: LayoutComponent, pathMatch: 'full' },
  { path: '**', redirectTo: '' }
]
