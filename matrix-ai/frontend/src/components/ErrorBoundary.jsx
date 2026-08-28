import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-24 w-full max-w-sm text-center">
          <div className="glass rounded-3xl p-8">
            <h2 className="text-lg font-bold text-rose-600">Une erreur est survenue</h2>
            <p className="mt-2 text-sm text-neutral-600">{this.state.error.message || 'Erreur inconnue'}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500"
            >
              Reessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
