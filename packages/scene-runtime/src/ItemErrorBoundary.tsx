import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  onError: (error: Error) => void
  children: ReactNode
}

interface State {
  failed: boolean
}

export class ItemErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error)
  }

  render(): ReactNode {
    if (this.state.failed) return null
    return this.props.children
  }
}
