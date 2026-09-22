// A do-nothing off-thread loader, standing in for tsx, ts-node, etc.
export async function resolve (specifier, context, nextResolve) {
  return nextResolve(specifier, context)
}

export async function load (url, context, nextLoad) {
  return nextLoad(url, context)
}
