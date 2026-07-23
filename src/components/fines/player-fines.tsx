"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface FineRow {
  id: string;
  date: string;
  paid: boolean;
  fine_type: { name: string; amount: number } | null;
}

export function PlayerFines({ fines }: { fines: FineRow[] }) {
  const totalPendiente = fines
    .filter((f) => !f.paid)
    .reduce((acc, f) => acc + Number(f.fine_type?.amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="relative overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 bg-card-red" aria-hidden="true" />
          <CardContent className="pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Total pendiente
            </p>
            <p className="font-display text-3xl leading-none text-card-red tabular-figures">
              ${totalPendiente.toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
          <CardContent className="pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Multas registradas
            </p>
            <p className="font-display text-3xl leading-none tabular-figures">{fines.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fines.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono tabular-figures">
                    {format(parseISO(f.date), "d MMM yyyy", { locale: es })}
                  </TableCell>
                  <TableCell>{f.fine_type?.name ?? "-"}</TableCell>
                  <TableCell className="font-mono tabular-figures">
                    ${Number(f.fine_type?.amount ?? 0).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.paid ? "secondary" : "destructive"}>
                      {f.paid ? "Pagada" : "Pendiente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {fines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No tenés multas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
