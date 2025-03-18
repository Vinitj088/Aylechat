import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "./auth";
import { ROUTES } from "./constants";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect(ROUTES.HOME);
  }
  
  return user;
} 