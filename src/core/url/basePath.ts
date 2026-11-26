// Helper awalan path statis agar aset bekerja baik di localhost ('') maupun GitHub Pages ('/NETRI-Exam-Web')
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function withBasePath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
