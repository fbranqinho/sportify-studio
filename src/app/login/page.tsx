
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/icons";
import { app } from "@/lib/firebase";
import { mockData } from "@/lib/mock-data";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

// List of mock users for login validation
const mockUsers = mockData.users.map(user => user.email);

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // TEMPORARY: Bypass Firebase Auth for mock users for testing purposes.
    if (mockUsers.includes(values.email)) {
      try {
        // Attempt to sign in silently, if it fails, it's ok for mock users.
        await signInWithEmailAndPassword(auth, values.email, values.password).catch(() => {});
        
        toast({
          title: "Login Successful (Mock User)",
          description: "Redirecting you to the dashboard.",
        });
        
        // Store mock user role to simulate session
        const user = mockData.users.find(u => u.email === values.email);
        if (user) {
            localStorage.setItem('mockUserRole', user.role);
            localStorage.setItem('mockUserName', user.name);
        }

        router.push("/dashboard");

      } catch (error: any) {
         // Even if auth fails, if it's a mock user, let them in for testing.
         if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            const user = mockData.users.find(u => u.email === values.email);
            if (user) {
              localStorage.setItem('mockUserRole', user.role);
              localStorage.setItem('mockUserName', user.name);
              toast({
                title: `Logged in as ${user.name}`,
                description: "Redirecting you to the dashboard.",
              });
              router.push("/dashboard");
              return;
            }
        }
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message,
        });
      }
    } else {
        // For real users, use Firebase Auth
        try {
            await signInWithEmailAndPassword(auth, values.email, values.password);
            localStorage.removeItem('mockUserRole');
            localStorage.removeItem('mockUserName');
            toast({
                title: "Login Successful",
                description: "Redirecting you to the dashboard.",
            });
            router.push("/dashboard");
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Login Failed",
                description: "Invalid credentials. Please sign up if you don't have an account.",
            });
        }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
       <div className="absolute top-4 left-4">
          <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold text-primary">
            <Icons.logo className="h-8 w-8" />
            <span>Sportify</span>
          </Link>
        </div>
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Login</CardTitle>
          <CardDescription>
            Use a mock user email (e.g., bruno@test.com) and any password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="bruno@test.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-semibold" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline font-semibold text-primary">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
