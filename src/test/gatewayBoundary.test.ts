import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = join(process.cwd(), 'src')

function sourceFiles(directory: string, extension: string): readonly string[] {
  return readdirSync(join(srcDir, directory), { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith(extension))
    .map((entry) => `${directory}/${entry}`)
}

function read(relative: string): string {
  return readFileSync(join(srcDir, relative), 'utf8')
}

const forbiddenImport = /from\s+['"][^'"]*mock[^'"]*['"]/i

describe('the TaskGateway is the boundary', () => {
  const componentFiles = sourceFiles('components', '.vue')

  it('finds the UI components it is meant to police', () => {
    expect(componentFiles.length).toBeGreaterThan(0)
  })

  it.each(componentFiles)('%s imports no mock fixture or mock adapter', (file) => {
    const offending = read(file)
      .split('\n')
      .filter((line) => forbiddenImport.test(line))

    expect(offending).toEqual([])
  })

  it.each(componentFiles)('%s reads workplace data only through domain or gateway types', (file) => {
    const imports = [...read(file).matchAll(/from\s+['"](@\/[^'"]+)['"]/g)].map((match) => match[1] ?? '')
    const workplaceImports = imports.filter((specifier) => !specifier.startsWith('@/components/'))

    for (const specifier of workplaceImports) {
      expect(specifier).toMatch(/^@\/(domain|gateway)\//)
    }
  })

  it('confines mock imports to the composition root and the mock module itself', () => {
    const allSources = [
      ...sourceFiles('components', '.vue'),
      ...sourceFiles('components', '.ts'),
      ...sourceFiles('domain', '.ts'),
      ...sourceFiles('gateway', '.ts'),
    ]
    const productionSources = allSources.filter((file) => !file.endsWith('.test.ts'))

    const offenders = productionSources.filter((file) => forbiddenImport.test(read(file)))

    expect(offenders).toEqual([])
  })
})
