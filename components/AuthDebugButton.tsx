'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export default function AuthDebugButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth-debug', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timestamp to prevent caching
        cache: 'no-store',
      });
      
      const data = await response.json();
      setDebugInfo(data);
    } catch (err: any) {
      console.error('Error checking auth status:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          setIsOpen(true);
          checkAuthStatus();
        }}
        className="bg-zinc-50 hover:bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
      >
        Debug Auth
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Authentication Debug</DialogTitle>
            <DialogDescription>
              Check the current authentication state
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                <span className="ml-2 text-zinc-500">Checking authentication status...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-800 dark:text-red-300">
                <p className="font-medium">Error checking authentication</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : debugInfo ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-md ${debugInfo.authenticated ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300'}`}>
                  <p className="font-medium">
                    {debugInfo.authenticated ? 'Authenticated ✓' : 'Not Authenticated ✗'}
                  </p>
                  {debugInfo.authenticated && debugInfo.user && (
                    <div className="mt-2 text-sm">
                      <p><strong>User ID:</strong> {debugInfo.user.id}</p>
                      <p><strong>Email:</strong> {debugInfo.user.email}</p>
                    </div>
                  )}
                </div>
                
                <div className="border p-4 rounded-md">
                  <p className="font-medium mb-2">Auth-Related Cookies</p>
                  {debugInfo.authCookies?.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {debugInfo.authCookies.map((cookie: any, i: number) => (
                        <li key={i} className="font-mono text-xs">
                          {cookie.name}: {cookie.value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No auth cookies found</p>
                  )}
                </div>
                
                <div className="border p-4 rounded-md">
                  <p className="font-medium mb-2">All Cookies</p>
                  <p className="text-sm text-zinc-500 mb-2">
                    Total: {debugInfo.allCookies?.length || 0} cookies
                  </p>
                  <div className="max-h-[150px] overflow-y-auto">
                    <ul className="text-sm space-y-1">
                      {debugInfo.allCookies?.map((name: string, i: number) => (
                        <li key={i} className="font-mono text-xs">{name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="text-xs text-zinc-500">
                  <p>Debug timestamp: {new Date(debugInfo.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ) : null}
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={checkAuthStatus}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Refresh Status'
              )}
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 