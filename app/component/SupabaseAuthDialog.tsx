'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { toast } from 'sonner';

type AuthDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function SupabaseAuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('signin');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  const { signIn, signUp } = useSupabaseAuth();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await signIn(email, password);
      
      // Clear form and close dialog
      resetForm();
      onClose();
      
      if (onSuccess) {
        onSuccess();
      }
      
      toast.success('Successfully signed in!');
    } catch (error: any) {
      setError(error.message || 'Failed to sign in');
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await signUp(email, password, name);
      
      // Clear form and close dialog
      resetForm();
      onClose();
      
      if (onSuccess) {
        onSuccess();
      }
      
      toast.success('Successfully signed up!');
    } catch (error: any) {
      setError(error.message || 'Failed to sign up');
      toast.error(error.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-[#fffdf5] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-center text-xl font-bold">
            {activeTab === 'signin' ? 'Sign In' : 'Create an Account'}
          </DialogTitle>
          <DialogDescription className="text-center text-black/70">
            {activeTab === 'signin' 
              ? 'Enter your credentials to sign in to your account' 
              : 'Fill out the form below to create a new account'}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 p-0 h-12 bg-[#f5f3e4] rounded-none border-y-2 border-black">
            <TabsTrigger value="signin" className="rounded-none data-[state=active]:bg-[#fffdf5] data-[state=active]:shadow-none h-full">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-none data-[state=active]:bg-[#fffdf5] data-[state=active]:shadow-none h-full">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4 p-6">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="grid w-full gap-2">
                <Label htmlFor="email" className="font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  className="border-2 border-black rounded-none p-2 bg-white"
                />
              </div>
              <div className="grid w-full gap-2">
                <Label htmlFor="password" className="font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="border-2 border-black rounded-none p-2 bg-white"
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-black text-white rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all" 
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4 p-6">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid w-full gap-2">
                <Label htmlFor="name" className="font-medium">Name (Optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="border-2 border-black rounded-none p-2 bg-white"
                />
              </div>
              <div className="grid w-full gap-2">
                <Label htmlFor="email-signup" className="font-medium">Email</Label>
                <Input
                  id="email-signup"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  className="border-2 border-black rounded-none p-2 bg-white"
                />
              </div>
              <div className="grid w-full gap-2">
                <Label htmlFor="password-signup" className="font-medium">Password</Label>
                <Input
                  id="password-signup"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="border-2 border-black rounded-none p-2 bg-white"
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-black text-white rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all" 
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 