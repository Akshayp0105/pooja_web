import { Component, type ReactNode } from 'react';

/** Shows a readable message instead of a blank page when something breaks. */
export function ErrorScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6 text-center">
      <div className="max-w-md">
        <p className="font-ml text-[18px] text-saffron">പൂജവെയ്പ്</p>
        <h1 className="mt-2 font-display text-[32px] leading-tight text-maroon">{title}</h1>
        {detail && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{detail}</p>}
        <button className="btn-primary mt-7" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Pooja Veppu crashed:', error);
  }

  render() {
    if (this.state.error) {
      return <ErrorScreen title="Something went wrong" detail={`Please reload the page.\n\n${this.state.error.message}`} />;
    }
    return this.props.children;
  }
}
