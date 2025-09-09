
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { LogIn, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="relative flex flex-col min-h-screen">
      <div className="absolute inset-0 z-[-1]">
        <Image
          src="https://placehold.co/1920x1080.png"
          alt="Dramatic soccer action in a stadium"
          data-ai-hint="soccer action dramatic"
          fill
          className="object-cover opacity-10"
        />
        <div className="absolute inset-0 bg-background/90" />
      </div>

      <header className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold text-primary">
          <Icons.logo className="h-20 w-20" />
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
        {/* Centered Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <div className="flex flex-col items-center">
            <div className="max-w-3xl space-y-6">
              <p className="font-headline text-base font-semibold text-primary tracking-wider uppercase">Inspired by The Fork, Pokemon Go & Tinder</p>
              <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground">
                Book Pitches. Discover Rivals. Match Your Game.
              </h1>
              <p className="text-lg text-muted-foreground">
                Sportify revolutionizes amateur sports. Reserve the best pitches, find and challenge nearby teams, and find the perfect game with a simple swipe.
              </p>
            </div>
          </div>
        </section>
        
        {/* Wide Image Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative aspect-[16/6] w-full rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="https://placehold.co/1200x400.png"
                alt="Soccer players on a wide field"
                data-ai-hint="soccer field action panoramic"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent"></div>
            </div>
        </section>

        {/* Role-based Buttons */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <div className="space-y-4 max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold font-headline">Find your place in the game</h2>
                <p className="text-muted-foreground">Select your role to get started.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                    <Button asChild size="lg" className="font-semibold">
                        <Link href="/signup?role=PLAYER">Sou Jogador</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="font-semibold">
                         <Link href="/signup?role=MANAGER">Sou Treinador</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="font-semibold">
                         <Link href="/signup?role=REFEREE">Sou Árbitro</Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Owners & Promoters Section */}
         <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="hover:border-primary transition-all">
                    <Link href="/signup?role=OWNER">
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center justify-between">
                                <span>Tenho um Espaço</span>
                                <ArrowRight className="text-primary"/>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Gere as suas instalações, otimize reservas e aumente a rentabilidade dos seus campos.</p>
                        </CardContent>
                    </Link>
                </Card>
                 <Card className="hover:border-primary transition-all">
                    <Link href="/signup?role=PROMOTER">
                        <CardHeader>
                             <CardTitle className="font-headline flex items-center justify-between">
                                <span>Tenho um Torneio</span>
                                <ArrowRight className="text-primary"/>
                            </CardTitle>
                        </CardHeader>
                         <CardContent>
                            <p className="text-muted-foreground">Organize ligas e torneios, convide equipas e gira toda a competição de forma simples.</p>
                        </CardContent>
                    </Link>
                </Card>
            </div>
        </section>

      </main>

      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sportify. All rights reserved.</p>
      </footer>
    </div>
  );
}
