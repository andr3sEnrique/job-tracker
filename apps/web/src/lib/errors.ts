import { ApiError } from '@/lib/api';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.status >= 500)
      return 'El servidor no responde. Inténtalo de nuevo.';
    return error.message;
  }
  if (error instanceof TypeError) return 'No se pudo conectar con la API.';
  return 'Ha ocurrido un error inesperado.';
}
