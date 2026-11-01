/** The `index`th item, failing the test when there is none. */
export function nth<T>(items: T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`no item at ${index}`)
  return item
}
