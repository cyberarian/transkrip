export type AppRoute = 'landing' | 'workspace' | 'about' | 'settings' | 'tasks' | 'analysis' | 'users'

export function routeFromHash(hash: string): AppRoute {
  hash = hash.split('?')[0]
  if (hash === '#workspace') return 'workspace'
  if (hash === '#about') return 'about'
  if (hash === '#settings') return 'settings'
  if (hash === '#tasks') return 'tasks'
  if (hash === '#analysis') return 'analysis'
  if (hash === '#users') return 'users'
  return 'landing'
}
