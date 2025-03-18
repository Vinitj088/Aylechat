import { requireAuth } from "@/lib/auth-utils";

export default async function ProfilePage() {
  const user = await requireAuth();
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="mb-4">
          <h2 className="text-lg font-medium">User Details</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            <span className="font-semibold">Name:</span> {user.name || "Not provided"}
          </p>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            <span className="font-semibold">Email:</span> {user.email}
          </p>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            <span className="font-semibold">User ID:</span> {user.id}
          </p>
        </div>
      </div>
    </div>
  );
} 