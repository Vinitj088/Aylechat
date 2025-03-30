'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = createClient()

  // Extract credentials from form data
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath('/', 'layout')
  return { success: true, error: null }
}

export async function signUp(formData: FormData) {
  const supabase = createClient()

  // Extract credentials from form data
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        name: formData.get('name') as string,
      }
    }
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath('/', 'layout')
  return { success: true, error: null }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    return { error: error.message, success: false }
  }
  
  revalidatePath('/', 'layout')
  return { success: true, error: null }
}

export async function getSession() {
  const supabase = createClient()
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return { session, error: null }
  } catch (error: any) {
    return { session: null, error: error.message }
  }
}

export async function getUser() {
  const supabase = createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return { user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export async function resetPassword(formData: FormData) {
  const supabase = createClient()
  
  const email = formData.get('email') as string
  const redirectTo = formData.get('redirectTo') as string || `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password/update`
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  })
  
  if (error) {
    return { error: error.message, success: false }
  }
  
  return { success: true, error: null }
}

export async function updatePassword(formData: FormData) {
  const supabase = createClient()
  
  const password = formData.get('password') as string
  
  const { error } = await supabase.auth.updateUser({
    password
  })
  
  if (error) {
    return { error: error.message, success: false }
  }
  
  revalidatePath('/', 'layout')
  return { success: true, error: null }
} 