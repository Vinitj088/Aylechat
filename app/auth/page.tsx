import { AuthForm } from "../component/AuthForm";
import { UserProfile } from "../component/UserProfile";
import { getSession } from "@/lib/auth-utils";

export default async function AuthPage() {
  const session = await getSession();
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Account Management</h1>
      
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        {session ? (
          <UserProfile />
        ) : (
          <AuthForm />
        )}
      </div>
    </div>
  );
} 