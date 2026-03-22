import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function DataRefresher() {
  const queryClient = useQueryClient();

  // Componente removido - dados atualizam automaticamente via refetchInterval
  // das queries individuais quando necessário
  return null;
}
