import { findProjectRoot } from '@linkzag/scene-loader'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'

export interface CaptureServerOptions {
  projectRoot?: string
  /** 0 asks the OS for a free port. */
  port?: number
}

export interface CaptureServer {
  baseUrl: string
  projectRoot: string
  rendererRoot: string
  close: () => Promise<void>
}

/**
 * Boot the renderer exactly the way `npm run dev:renderer` does, but on an
 * ephemeral port. Reusing the real Vite config keeps capture and preview in
 * sync: the same plugins, asset handling, and scene middleware.
 */
export async function startCaptureServer(options: CaptureServerOptions = {}): Promise<CaptureServer> {
  const projectRoot = path.resolve(options.projectRoot ?? findProjectRoot())
  const rendererRoot = path.join(projectRoot, 'apps', 'renderer')

  let server: ViteDevServer | undefined
  try {
    server = await createServer({
      root: rendererRoot,
      configFile: path.join(rendererRoot, 'vite.config.ts'),
      logLevel: 'error',
      server: {
        host: '127.0.0.1',
        port: options.port ?? 0,
        strictPort: false,
      },
    })
    await server.listen()
  } catch (error) {
    await server?.close()
    throw new Error(
      `Could not start the LinkZag renderer: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }

  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : options.port
  if (!port) {
    await server.close()
    throw new Error('The renderer server started without a TCP port.')
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    projectRoot,
    rendererRoot,
    close: async () => {
      await server?.close()
    },
  }
}
