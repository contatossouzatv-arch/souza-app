import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary capturou erro:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-950/90 p-6 text-white shadow-[0_18px_48px_rgba(15,23,42,0.42)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-center text-lg font-black">Falha ao abrir esta tela</h2>
            <p className="mt-2 text-center text-sm text-slate-300">
              O app encontrou um erro nessa navegação. Você pode tentar novamente sem perder sua sessão.
            </p>
            {this.state.error?.message ? (
              <p className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
                {this.state.error.message}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={this.handleRetry} className="flex-1 bg-cyan-600 text-white hover:bg-cyan-500">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar de novo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex-1 border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
              >
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
