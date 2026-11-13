import type { Post } from '../types'

/** 按 Unicode 码点计数：中文与 emoji 都算 1 个字 */
export function countChars(text: string): number {
  return Array.from(text).length
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / （YYYY 年）M 月 D 日 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp
  if (diff < 0) return '刚刚'

  const MINUTE = 60_000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return Math.floor(diff / MINUTE) + ' 分钟前'
  if (diff < DAY) return Math.floor(diff / HOUR) + ' 小时前'
  if (diff < 30 * DAY) return Math.floor(diff / DAY) + ' 天前'

  const date = new Date(timestamp)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return (
    (sameYear ? '' : date.getFullYear() + ' 年 ') +
    (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日'
  )
}

/** 详情页日期：YYYY.MM.DD，补零 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate())
}

/** 话题匹配：# 开头，不含空白与中英文标点，最长 24 字符 */
const TAG_PATTERN = /#[^\s#，。！？,.!?]{1,24}/g

/** 提取正文里的 #话题，去重且保持出现顺序 */
export function extractTags(text: string): string[] {
  const matches = text.match(TAG_PATTERN)
  return matches ? Array.from(new Set(matches)) : []
}

/** 按 #话题 把正文切分成普通片段与话题片段，供模板安全渲染（无 v-html） */
export function splitContent(text: string): Array<{ tag: boolean; text: string }> {
  return text
    .split(/(#[^\s#，。！？,.!?]{1,24})/g)
    .filter((part) => part !== '')
    .map((part) => ({
      tag: part.charAt(0) === '#' && part.length > 1,
      text: part,
    }))
}

/** FNV-1a 哈希派生稳定色相，落在 [0, 360) */
export function hueFor(seed: unknown): number {
  const text = String(seed)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % 360
}

/** 取片语自身色相，缺失或非法时按 id 推导 */
export function hueOf(post: Pick<Post, 'id'> & { hue?: number }): number {
  return typeof post.hue === 'number' && Number.isFinite(post.hue) ? post.hue : hueFor(post.id)
}
