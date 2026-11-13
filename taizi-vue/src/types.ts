export interface Post {
  id: string
  content: string
  createdAt: number
  likes: number
  liked: boolean
  hue: number
}

export type Filter = 'all' | 'hot'

export interface TopicEntry {
  tag: string
  count: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
