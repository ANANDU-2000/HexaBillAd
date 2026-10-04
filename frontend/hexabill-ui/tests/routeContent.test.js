import assert from 'node:assert/strict'
import { before, afterEach, test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'

let RouteContent, renderer, navigate
before(async () => {
  const require = createRequire(import.meta.url)
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/RouteContent.jsx', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    plugins: [{ name: 'route-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (['react', 'react/jsx-runtime', 'react-router-dom'].includes(args.path))
          return { path: pathToFileURL(require.resolve(args.path)).href, external: true }
        if (args.path === 'lucide-react') return { path: args.path, namespace: 'fixture' }
      })
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export const Loader2=()=>null, RefreshCw=()=>null' }))
    } }]
  })
  RouteContent = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default
})
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; delete globalThis.window })

function Shell() {
  navigate = useNavigate()
  const [count, setCount] = React.useState(0)
  return React.createElement(React.Fragment, null,
    React.createElement('nav', { 'aria-label': 'Fixture navigation' },
      React.createElement('button', { onClick: () => setCount(count + 1) }, `Shell ${count}`)),
    React.createElement(RouteContent))
}
function Healthy() { return React.createElement('p', null, 'Healthy page') }
function Counter() {
  const [count, setCount] = React.useState(0)
  return React.createElement('button', { onClick: () => setCount(count + 1) }, `Page ${count}`)
}
function tree(start, page) {
  return React.createElement(MemoryRouter, { initialEntries: [start], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
    React.createElement(Routes, null,
      React.createElement(Route, { element: React.createElement(Shell) },
        React.createElement(Route, { path: '/test', element: React.createElement(page) }),
        React.createElement(Route, { path: '/healthy', element: React.createElement(Healthy) }))))
}
function content() { return JSON.stringify(renderer.toJSON()) }

test('a pending route retains navigation and shell state until it loads', async () => {
  let resolve
  const pending = new Promise(done => { resolve = done })
  const Page = React.lazy(() => pending)
  await act(async () => { renderer = create(tree('/test', Page)) })
  act(() => renderer.root.findByType('button').props.onClick())
  assert.match(content(), /Shell 1/)
  assert.match(content(), /Loading this page/)
  assert.doesNotMatch(renderer.root.findByProps({ role: 'status' }).props.className, /min-h-screen/)
  await act(async () => { resolve({ default: Healthy }); await pending })
  assert.match(content(), /Healthy page/)
  assert.match(content(), /Shell 1/)
})

test('route errors keep navigation, hide technical details and clear on navigation', async () => {
  function Broken() { throw new Error('PRIVATE_MARKER: internal failure') }
  const originalError = console.error
  console.error = () => {}
  try { await act(async () => { renderer = create(tree('/test', Broken)) }) }
  finally { console.error = originalError }
  assert.match(content(), /Fixture navigation/)
  assert.match(content(), /This page encountered a problem/)
  assert.doesNotMatch(content(), /PRIVATE_MARKER/)
  await act(async () => { navigate('/healthy') })
  assert.match(content(), /Healthy page/)
  assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 0)
})

test('changing query filters does not remount a healthy page', async () => {
  await act(async () => { renderer = create(tree('/test?filter=one', Counter)) })
  const pageButton = renderer.root.findAllByType('button').find(node => node.props.children === 'Page 0')
  act(() => pageButton.props.onClick())
  await act(async () => { navigate('/test?filter=two') })
  assert.match(content(), /Page 1/)
})

test('chunk failures offer an explicit reload without automatically reloading', async () => {
  let reloads = 0
  globalThis.window = { location: { reload() { reloads += 1 } } }
  const originalError = console.error
  console.error = () => {}
  try {
    const Page = React.lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module: PRIVATE_URL')))
    await act(async () => { renderer = create(tree('/test', Page)) })
  } finally { console.error = originalError }
  assert.match(content(), /This page could not load/)
  assert.doesNotMatch(content(), /PRIVATE_URL/)
  assert.equal(reloads, 0)
  act(() => renderer.root.findAllByType('button').find(node => React.Children.toArray(node.props.children).includes('Reload page')).props.onClick())
  assert.equal(reloads, 1)
})
