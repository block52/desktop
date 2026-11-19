import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import styles from "./ModalErrorBoundary.module.css";

interface ModalErrorBoundaryProps {
    children: ReactNode;
    onClose: () => void;
}

interface ModalErrorBoundaryState {
    failed: boolean;
}

/** A modal that fails to draw closes on its own instead of blanking the whole app. */
export default class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
    state: ModalErrorBoundaryState = { failed: false };

    static getDerivedStateFromError(): ModalErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("A dialog failed to draw:", error, info.componentStack);
    }

    render(): ReactNode {
        if (!this.state.failed) return this.props.children;
        return (
            <div className={styles.overlay} role="alertdialog" aria-label="Something went wrong">
                <div className={`pane-lite ${styles.card}`}>
                    <p className={styles.text}>Something went wrong showing this window.</p>
                    <button type="button" className="btn-ghost" onClick={this.props.onClose}>
                        Close
                    </button>
                </div>
            </div>
        );
    }
}
