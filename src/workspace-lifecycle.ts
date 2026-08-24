import type { AppRoute } from './routes'

export function retainWorkspace(alreadyOpened: boolean, route: AppRoute) {
  return alreadyOpened || route === 'workspace'
}
