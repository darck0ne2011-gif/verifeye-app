import { Component } from 'react'

/**
 * Last line of defence: a render error anywhere in the tree shows this
 * screen instead of a blank page, with a reload button.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-xl card border-ai/40 p-6 text-center">
          <h1 className="text-white font-semibold text-lg mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm mb-4">
            The app hit an unexpected error. Reloading usually fixes it; if it keeps happening, please report it.
          </p>
          <p className="text-red-300/80 text-xs font-mono break-words mb-4">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-accent text-bg hover:bg-accent-hover text-sm font-medium"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
