type ComponentFunction = (...args: unknown[]) => unknown

const components = new Map<string, ComponentFunction>()
const wrappers = new Map<string, ComponentFunction>()

// Registers the latest implementation and returns the wrapper to use as the component's public
// identity. The first wrapper registered is kept so identity checks such as
// `context.get(Component)` keep matching after a module update.
export function registerComponentForHmr(
  moduleUrl: string,
  componentName: string,
  implementation: ComponentFunction,
  wrapper?: ComponentFunction,
): ComponentFunction {
  let key = getComponentKey(moduleUrl, componentName)
  components.set(key, implementation)
  let stable = wrappers.get(key)
  if (!stable) {
    stable = wrapper ?? implementation
    wrappers.set(key, stable)
  }
  return stable
}

export function getCurrentComponentForHmr(
  moduleUrl: string,
  componentName: string,
): ComponentFunction {
  let component = components.get(getComponentKey(moduleUrl, componentName))
  if (!component) {
    throw new Error(`[remix] Missing HMR component registration for ${moduleUrl}:${componentName}`)
  }
  return component
}

function getComponentKey(moduleUrl: string, componentName: string): string {
  return `${moduleUrl}:${componentName}`
}
