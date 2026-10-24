import fs from 'node:fs/promises'
import path from 'node:path'
import { createCaptureSession, startCaptureServer } from '@linkzag/capture-engine'

const projectRoot = process.cwd()
const server = await startCaptureServer({ projectRoot })
const session = await createCaptureSession({ baseUrl: server.baseUrl })
const target = {
  scene: 'content/scenes/agentic-coding.yaml',
  width: 1920,
  height: 1080,
  duration: 10,
}

try {
  await fs.mkdir(path.join(projectRoot, 'tests', 'goldens'), { recursive: true })
  for (const theme of ['dark', 'light'] as const) {
    const buffer = await session.captureStill(target, { time: 6, theme })
    const file = path.join(projectRoot, 'tests', 'goldens', `agentic-${theme}.png`)
    await fs.writeFile(file, buffer)
    process.stdout.write(`${path.relative(projectRoot, file)}  ${buffer.byteLength} bytes\n`)
  }
} finally {
  await session.close()
  await server.close()
}
