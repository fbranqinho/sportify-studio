
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { LogIn } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold text-primary">
          <Icons.logo className="h-12 w-12" />
          <span>Sportify</span>
        </Link>
        <nav>
           <Button asChild variant="ghost" className="font-semibold">
              <Link href="/login">
                Login <LogIn className="ml-2" />
              </Link>
            </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="font-headline text-base font-semibold text-primary tracking-wider uppercase">Play, simple</p>
              <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground">
                Find Your Next Game, Effortlessly.
              </h1>
              <p className="text-lg text-muted-foreground">
                Sportify connects players, managers, and field owners to simplify the world of amateur sports. Discover nearby fields, join teams, and manage your games all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="font-semibold">
                  <Link href="/signup">
                    Sign Up for Free
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="font-semibold">
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="https://placehold.co/800x800.png"
                alt="Soccer players on a field"
                data-ai-hint="soccer field action"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent"></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sportify. All rights reserved.</p>
      </footer>
    </div>
  );
}
