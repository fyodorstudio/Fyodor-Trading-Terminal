import fs from 'node:fs'
import ts from 'typescript'
import { resolveDependency } from './source-graph.mjs'

const exported = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
function declarationName(node) {
  const parent = node.parent
  return parent?.name === node && (ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent)
    || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isParameter(parent)
    || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent)
    || ts.isTypeAliasDeclaration(parent) || ts.isInterfaceDeclaration(parent) || ts.isEnumDeclaration(parent))
}

// Tests do not make a production export live. Internal references, named imports,
// re-exports and namespace/dynamic imports do. This intentionally leaves type-only
// exports and compatibility barrels to the existing module reachability check.
export function sourceUsage(files) {
  const modules = new Map(), imports = new Map(), words = new Set(), stems = new Set()
  for (const filename of files) {
    const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
    const values = new Set(), references = new Set()
    for (const node of ast.statements) if (exported(node)) {
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) values.add(node.name.text)
      if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) values.add(declaration.name.text)
    }
    function walk(node) {
      if (ts.isIdentifier(node) && !declarationName(node)) references.add(node.text)
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const match of node.text.matchAll(/[A-Za-z_][\w-]*/g)) words.add(match[0])
        if (/[-_]$/.test(node.text)) stems.add(node.text.match(/[\w-]+$/)?.[0])
      }
      const module = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null
      if (module && ts.isStringLiteral(module) && module.text.startsWith('.')) {
        const destination = resolveDependency(filename, module.text)
        if (destination) {
          const names = imports.get(destination) ?? new Set()
          imports.set(destination, names)
          const clause = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : ts.isExportDeclaration(node) ? node.exportClause : null
          if (clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause)))
            for (const element of clause.elements) names.add((element.propertyName ?? element.name).text)
          else names.add('*')
        }
      }
      ts.forEachChild(node, walk)
    }
    walk(ast)
    modules.set(filename, { values, references })
  }
  const unused = []
  for (const [filename, { values, references }] of modules) for (const name of values)
    if (!references.has(name) && !imports.get(filename)?.has('*') && !imports.get(filename)?.has(name)) unused.push({ filename, name })
  return { unused, words, stems }
}

// Conservative literal inventory: interpolation prefixes are accepted, and a
// literal may occur in any source string. This is not a full CSS/DOM liveness proof.
export function unreferencedClasses(css, usage) {
  const unknown = new Set()
  for (const [, header] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    if (header.trim().startsWith('@')) continue
    for (const [, name] of header.matchAll(/\.([A-Za-z_][\w-]*)/g))
      if (!usage.words.has(name) && ![...usage.stems].some(stem => name.startsWith(stem))) unknown.add(name)
  }
  return [...unknown]
}
