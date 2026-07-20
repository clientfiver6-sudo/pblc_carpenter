import { z } from 'zod'
import { NextResponse } from 'next/server'

export interface SafeError {
  message: string
  code: string
}

export function sanitizeError(error: unknown): SafeError {
  // Always log full error server-side
  console.error('[RetornAI]', error)

  if (error instanceof z.ZodError) {
    const first = error.errors[0]
    return {
      message: `Dados inválidos: ${first.path.join('.')} — ${first.message}`,
      code: 'VALIDATION_ERROR'
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      return { message: 'Este registro já existe.', code: 'DUPLICATE' }
    }
    if (msg.includes('not found') || msg.includes('no rows')) {
      return { message: 'Não encontrado.', code: 'NOT_FOUND' }
    }
    if (msg.includes('unauthorized') || msg.includes('unauthenticated')) {
      return { message: 'Não autorizado.', code: 'UNAUTHORIZED' }
    }
    if (msg.includes('insufficient permissions') || msg.includes('forbidden')) {
      return { message: 'Sem permissão para esta operação.', code: 'FORBIDDEN' }
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return { message: 'Muitas requisições. Tente mais tarde.', code: 'RATE_LIMITED' }
    }
  }

  return { message: 'Algo deu errado. Tente novamente.', code: 'INTERNAL_ERROR' }
}

// Convenience: wrap an API route handler with error boundary
export function apiError(error: unknown, status = 500): NextResponse {
  const safe = sanitizeError(error)
  const httpStatus =
    safe.code === 'UNAUTHORIZED' ? 401 :
    safe.code === 'FORBIDDEN' ? 403 :
    safe.code === 'NOT_FOUND' ? 404 :
    safe.code === 'DUPLICATE' ? 409 :
    safe.code === 'VALIDATION_ERROR' ? 422 :
    safe.code === 'RATE_LIMITED' ? 429 :
    status
  return NextResponse.json({ error: safe.message, code: safe.code }, { status: httpStatus })
}
