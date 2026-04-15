import { describe, expect, it } from 'vitest'
import {
  extractCity,
  truncate,
  formatEventDateLong,
  formatEventDateShort,
  absoluteUrl,
} from '@/lib/seo/derive'

describe('extractCity', () => {
  it('returns first comma-separated segment, trimmed', () => {
    expect(extractCity('Luzern, Switzerland')).toBe('Luzern')
    expect(extractCity('  Zurich ,  CH ')).toBe('Zurich')
  })

  it('returns the full string when no comma', () => {
    expect(extractCity('Luzern')).toBe('Luzern')
  })

  it('returns empty string for empty input', () => {
    expect(extractCity('')).toBe('')
  })
})

describe('truncate', () => {
  it('returns input unchanged when short enough', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates with single ellipsis character at exact limit', () => {
    expect(truncate('abcdefghijk', 5)).toBe('abcd…')
    expect(truncate('abcdefghijk', 5).length).toBe(5)
  })

  it('prefers word boundary before the cap', () => {
    expect(truncate('hello world foo bar baz', 15)).toBe('hello world…')
  })

  it('guarantees result.length <= max even when no word boundary is close', () => {
    expect(truncate('abcdefghijklmnop', 10).length).toBeLessThanOrEqual(10)
    expect(truncate('averylongwordwithnowordbreaks', 60).length).toBeLessThanOrEqual(60)
  })
})

describe('formatEventDateLong', () => {
  it('formats ISO to long English form', () => {
    // 2026-04-20T22:00:00Z
    const out = formatEventDateLong('2026-04-20T22:00:00Z')
    expect(out).toMatch(/April/)
    expect(out).toMatch(/2026/)
  })
})

describe('formatEventDateShort', () => {
  it('formats ISO to compact English form', () => {
    const out = formatEventDateShort('2026-04-20T22:00:00Z')
    expect(out).toMatch(/Apr/)
    expect(out).toMatch(/20/)
  })
})

describe('absoluteUrl', () => {
  it('joins with site origin', () => {
    expect(absoluteUrl('/event/abc')).toBe('https://eclipseboundaries.ch/event/abc')
    expect(absoluteUrl('/')).toBe('https://eclipseboundaries.ch/')
  })

  it('leaves absolute URLs untouched', () => {
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x')
  })
})
