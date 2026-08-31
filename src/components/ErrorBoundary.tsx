'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-6 mx-auto max-w-3xl rounded-2xl bg-[#15120c] border border-[#ef4444]/40 text-[#f4ede2] shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#ef4444]/20 border border-[#ef4444]/50 flex items-center justify-center text-[#ef4444] text-lg font-bold">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#f4ede2]">
                {this.props.fallbackTitle || 'Section Display Interruption'}
              </h3>
              <p className="text-sm text-[#a89f91] mt-1">
                {this.props.fallbackMessage ||
                  'An unexpected rendering issue occurred in this component. RazorRecover safe state is active.'}
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-3 rounded-lg bg-[#080705] border border-[#2e271c] font-mono text-xs text-[#ef4444] break-all">
                  {this.state.error.message}
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 rounded-lg bg-[#e5a944] text-[#080705] font-bold text-xs hover:bg-[#fcd34d] transition cursor-pointer"
                >
                  ↻ Retry / Reload Section
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-[#2e271c] text-[#f4ede2] font-semibold text-xs hover:bg-[#3d3426] transition cursor-pointer"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
