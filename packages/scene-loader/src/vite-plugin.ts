import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { SceneError } from './errors.ts'
import {
  assetContentType,
  discoverScenes,
  loadScene,
  resolveScenePath,
  summarizeScene,
} from './load.ts'
import { ensureInside, isInside, projectLayout } from './paths.ts'

export interface LinkzagContentPluginOptions {
  projectRoot?: string
  contentDir?: string
}

type Next = () => void

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function sendError(res: ServerResponse, status: number, message: string, details?: string[]): void {
  sendJson(res, status, { error: message, ...(details ? { details } : {}) })
}

/**
 * Serves scene files, discovery, assets, and health checks to both the renderer and
 * studio. It also triggers a full browser reload when anything under content changes.
 */
export function linkzagContentPlugin(options: LinkzagContentPluginOptions = {}): Plugin {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const contentDir = path.resolve(projectRoot, options.contentDir ?? 'content')
  let activeServer: ViteDevServer | PreviewServer | undefined

  const handle = async (req: IncomingMessage, res: ServerResponse, next: Next): Promise<void> => {
    if (!req.url) return next()
    const url = new URL(req.url, 'http://linkzag.local')
    const route = url.pathname
    if (!route.startsWith('/__linkzag/')) return next()

    if (route === '/__linkzag/health') {
      sendJson(res, 200, {
        ok: true,
        name: 'linkzag-show',
        version: '0.1.0',
        projectRoot,
        contentDir,
      })
      return
    }

    if (route === '/__linkzag/scenes') {
      try {
        const result = discoverScenes({ projectRoot, contentDir })
        sendJson(res, 200, { ...result, projectRoot })
      } catch (error) {
        sendError(res, 500, error instanceof Error ? error.message : String(error))
      }
      return
    }

    if (route === '/__linkzag/scene') {
      const requested = url.searchParams.get('path')
      if (!requested) {
        sendError(res, 400, 'Missing ?path= scene file')
        return
      }
      try {
        const resolved = resolveScenePath(requested, { projectRoot, contentDir })
        ensureInside(projectRoot, resolved)
        const loaded = loadScene(resolved, { projectRoot, contentDir })
        sendJson(res, 200, {
          scene: loaded.scene,
          path: loaded.relativePath,
          absolutePath: loaded.file,
          checksum: loaded.checksum,
          sources: loaded.sources.map((source) => path.relative(projectRoot, source).split(path.sep).join('/')),
          summary: summarizeScene(loaded),
        })
      } catch (error) {
        if (error instanceof SceneError) {
          sendError(res, 400, error.message, error.details)
        } else {
          sendError(res, 400, error instanceof Error ? error.message : String(error))
        }
      }
      return
    }

    if (route === '/__linkzag/asset') {
      const requested = url.searchParams.get('path')
      if (!requested) {
        sendError(res, 400, 'Missing ?path= asset file')
        return
      }
      try {
        const absolute = ensureInside(projectRoot, requested)
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
          sendError(res, 404, `Asset not found: ${requested}`)
          return
        }
        const stat = fs.statSync(absolute)
        res.statusCode = 200
        res.setHeader('Content-Type', assetContentType(absolute))
        res.setHeader('Content-Length', String(stat.size))
        res.setHeader('Cache-Control', 'no-store')
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        const stream = fs.createReadStream(absolute)
        stream.on('error', () => {
          if (!res.headersSent) res.statusCode = 500
          res.end()
        })
        stream.pipe(res)
      } catch (error) {
        sendError(res, 403, error instanceof Error ? error.message : String(error))
      }
      return
    }

    sendError(res, 404, `Unknown LinkZag endpoint: ${route}`)
  }

  const middleware = (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    void handle(req, res, next).catch((error: unknown) => {
      if (!res.headersSent) {
        sendError(res, 500, error instanceof Error ? error.message : String(error))
      } else {
        res.end()
      }
    })
  }

  const attachWatcher = (server: ViteDevServer): void => {
    server.watcher.add(contentDir)
    const onFile = (event: string, file: string) => {
      if (event !== 'change' && event !== 'add' && event !== 'unlink') return
      if (!isInside(contentDir, file)) return
      server.ws.send({ type: 'full-reload' })
    }
    server.watcher.on('all', onFile)
    server.httpServer?.once('close', () => server.watcher.off('all', onFile))
  }

  return {
    name: 'linkzag-content',
    configureServer(server) {
      activeServer = server
      server.middlewares.use(middleware)
      attachWatcher(server)
      server.config.logger.info(`[linkzag] content root: ${contentDir}`)
    },
    configurePreviewServer(server) {
      activeServer = server
      server.middlewares.use(middleware)
    },
    closeBundle() {
      const server = activeServer
      if (server && 'ws' in server) {
        // Dev server cleanup happens on httpServer close.
      }
    },
  }
}

export function defaultContentPaths(projectRoot: string = process.cwd()) {
  return projectLayout(projectRoot)
}
