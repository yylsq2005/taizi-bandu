export interface Post {
  id: string
  content: string
  createdAt: number
  likes: number
  liked: boolean
  /** 收藏总数（所有用户累计） */
  favorites: number
  /** 当前用户是否已收藏 */
  favorited: boolean
  hue: number
}

export type Filter = 'all' | 'hot' | 'favorites'

export interface TopicEntry {
  tag: string
  count: number
}
