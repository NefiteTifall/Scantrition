import type {} from '#auth-utils'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
  }
}
