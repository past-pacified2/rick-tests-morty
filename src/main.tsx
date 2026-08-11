import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { createQueryClient } from '@/queryClient';
import { router } from '@/router';

import './index.css';

const queryClient = createQueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root is missing from index.html — the entry point and the template have diverged.');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
