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
