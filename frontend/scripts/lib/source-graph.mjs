import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(filename) : [filename]
  })
}

export function resolveDependency(filename, specifier) {
  const base = path.resolve(path.dirname(filename), specifier.split('?')[0])
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
}

// Include type imports, compatibility exports, dynamic imports and worker URLs.
export function sourceGraph(directory) {
  const files = listFiles(directory).filter(filename => /\.tsx?$/.test(filename))
  const dependencies = new Map()
  const unresolved = []
  for (const filename of files) {
    const edges = new Set()
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
    function walk(node) {
      const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0]
          : ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' ? node.arguments?.[0] : null
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
        const resolved = resolveDependency(filename, specifier.text)
        if (resolved) edges.add(resolved)
        else unresolved.push({ filename, specifier: specifier.text })
      }
      ts.forEachChild(node, walk)
    }
    walk(source)
    dependencies.set(filename, [...edges])
  }
  return { files, dependencies, unresolved }
}

export function reachableFiles(graph, entries) {
  const visited = new Set()
  function visit(filename) {
    if (visited.has(filename)) return
    visited.add(filename)
    for (const dependency of graph.dependencies.get(filename) ?? []) visit(dependency)
  }
  entries.forEach(visit)
  return visited
}
