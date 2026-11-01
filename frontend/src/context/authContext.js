import { createContext } from 'react'

/**
 * @typedef {{ id: string, email: string, full_name: string | null, role: 'viewer' | 'controller',
 *             is_active: boolean, created_at: string }} User
 * @typedef {{ user: User | null, status: 'loading' | 'authenticated' | 'guest',
 *             login: (email: string, password: string) => Promise<User>, logout: () => void }} AuthValue
 */

/** @type {import('react').Context<AuthValue | null>} */
export const AuthContext = createContext(null)
