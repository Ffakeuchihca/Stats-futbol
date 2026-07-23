"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryCheckboxList } from "@/components/roster/category-checkbox-list";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import type { Category } from "@/types/database";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [signupCategoryIds, setSignupCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, [supabase]);

  function toggleSignupCategory(categoryId: string) {
    setSignupCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  async function handleSignIn(formData: FormData) {
    setLoading(true);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("No pudimos iniciar sesión", { description: error.message });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp(formData: FormData) {
    setLoading(true);
    const firstName = String(formData.get("first_name")).trim();
    const lastName = String(formData.get("last_name")).trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, category_ids: signupCategoryIds } },
    });
    setLoading(false);

    if (error) {
      toast.error("No pudimos crear tu cuenta", { description: error.message });
      return;
    }
    toast.success("Cuenta creada", {
      description: "Si tu club requiere confirmación por correo, revisá tu email.",
    });
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-pitch p-4">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-pitch-foreground opacity-[0.08]"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
      >
        <line x1="0" y1="200" x2="400" y2="200" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="200" cy="200" r="3" fill="currentColor" />
      </svg>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="font-display text-4xl leading-none tracking-wide text-pitch-foreground">
            STATS CARTAGINÉS
          </h1>
          <p className="text-sm text-pitch-foreground/70">
            Asistencia, multas y estadísticas del plantel
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
            <CardDescription>Ingresá con tu usuario o creá una cuenta nueva</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Ingresar
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Crear cuenta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form action={handleSignIn} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Ingresando..." : "Ingresar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form action={handleSignUp} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Nombre</Label>
                      <Input
                        id="first_name"
                        name="first_name"
                        required
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Apellidos</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        required
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {categories.length > 0 && (
                    <div className="space-y-2">
                      <Label>Categorías en las que jugás</Label>
                      <CategoryCheckboxList
                        categories={categories}
                        selected={signupCategoryIds}
                        onToggle={toggleSignupCategory}
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creando cuenta..." : "Crear cuenta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
