import { describe, it, expect } from 'vitest'
import {
  countChars,
  formatRelativeTime,
  formatDate,
  extractTags,
  hueFor,
  hueOf,
} from '../src/utils/format'

describe('countChars：按 Unicode 码点计数', () => {
  it('空字符串为 0', () => {
    expect(countChars('')).toBe(0)
  })

  it('ASCII 字符逐个计数', () => {
    expect(countChars('abc')).toBe(3)
  })

  it('中文按 1 个字计', () => {
    expect(countChars('太子伴读')).toBe(4)
  })

  it('emoji 只算 1 个字（不按 UTF-16 代理对拆开）', () => {
    expect(countChars('😀')).toBe(1)
    expect(countChars('a😀b')).toBe(3)
  })
})

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-11-13T12:00:00Z')

  it('未来时间显示「刚刚」', () => {
    expect(formatRelativeTime(now + 5000, now)).toBe('刚刚')
  })

  it('一分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(now - 59_000, now)).toBe('刚刚')
  })

  it('一小时内按分钟显示', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 分钟前')
    expect(formatRelativeTime(now - 59 * 60_000, now)).toBe('59 分钟前')
  })

  it('一天内按小时显示', () => {
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3 小时前')
  })

  it('三十天内按天显示', () => {
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2 天前')
  })

  it('超过三十天按日期显示（同年不带年份）', () => {
    const ts = Date.parse('2026-01-05T12:00:00Z')
    expect(formatRelativeTime(ts, now)).toBe('1 月 5 日')
  })

  it('跨年显示带年份', () => {
    const ts = Date.parse('2025-01-05T12:00:00Z')
    expect(formatRelativeTime(ts, now)).toBe('2025 年 1 月 5 日')
  })
})

describe('formatDate', () => {
  it('按 YYYY.MM.DD 输出并补零', () => {
    expect(formatDate(Date.parse('2026-01-05T12:00:00Z'))).toBe('2026.01.05')
    expect(formatDate(Date.parse('2026-12-25T12:00:00Z'))).toBe('2026.12.25')
  })
})

describe('extractTags：提取 #话题', () => {
  it('提取单个话题', () => {
    expect(extractTags('今天也要好好读书呀。#今日片语')).toEqual(['#今日片语'])
  })

  it('去重且保持出现顺序', () => {
    expect(extractTags('#b 一次 #a 两次 #a 三次 #b')).toEqual(['#b', '#a'])
  })

  it('中英文标点截断话题', () => {
    expect(extractTags('#读书笔记，还有 #工作!')).toEqual(['#读书笔记', '#工作'])
  })

  it('没有话题返回空数组', () => {
    expect(extractTags('普通的一句话')).toEqual([])
  })

  it('话题最长 24 个字符', () => {
    const long = 'x'.repeat(25)
    expect(extractTags('#' + long)).toEqual(['#' + 'x'.repeat(24)])
  })
})

describe('hueFor：FNV-1a 稳定色相', () => {
  it('确定性：同一种子结果一致', () => {
    expect(hueFor('seed-1')).toBe(hueFor('seed-1'))
  })

  it('结果落在 [0, 360) 内', () => {
    for (let i = 0; i < 100; i++) {
      const hue = hueFor('seed-' + i)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
      expect(Number.isInteger(hue)).toBe(true)
    }
  })

  it('不同种子分布不同', () => {
    expect(hueFor('seed-1')).not.toBe(hueFor('seed-2'))
  })
})

describe('hueOf：取片语色相，缺失时按 id 推导', () => {
  it('有有效 hue 直接返回', () => {
    expect(hueOf({ id: 'a', hue: 158 })).toBe(158)
  })

  it('hue 非有限数时按 id 推导', () => {
    expect(hueOf({ id: 'seed-1', hue: NaN })).toBe(hueFor('seed-1'))
    expect(hueOf({ id: 'seed-1' })).toBe(hueFor('seed-1'))
  })
})
