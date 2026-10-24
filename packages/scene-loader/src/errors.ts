export class SceneError extends Error {
  readonly file?: string
  readonly details?: string[]

  constructor(message: string, options: { file?: string; details?: string[]; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'SceneError'
    this.file = options.file
    this.details = options.details
  }
}

export function formatList(items: string[]): string {
  return items.map((item) => `  - ${item}`).join('\n')
}
