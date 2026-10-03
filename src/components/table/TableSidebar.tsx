import React from "react";
import type { LegalActionDTO } from "@block52/poker-vm-sdk";
import styles from "./TableSidebar.module.css";

export interface TableSidebarProps {
    legalActions: LegalActionDTO[];
    isPlayerTurn: boolean;
}

export const TableSidebar: React.FC<TableSidebarProps> = ({ legalActions, isPlayerTurn }) => {
    return (
        <div className={styles.sidebar}>
            <div className={styles.panel}>
                <h4 className={styles.heading}>Legal actions</h4>
                {isPlayerTurn && legalActions.length > 0 ? (
                    legalActions.map(action => (
                        <div key={action.action} className={styles.row}>
                            <span className={styles.rowKey}>{action.action}</span>
                            <span>
                                {action.min && action.max && action.min !== action.max ? `${action.min} – ${action.max}` : (action.min ?? "available")}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className={styles.row}>
                        <span className={styles.rowKey}>Not your turn</span>
                    </div>
                )}
            </div>
            <div className={styles.panel}>
                <h4 className={styles.heading}>Hand history</h4>
                <div className={styles.row}>
                    <span className={styles.rowKey}>No hands played yet this session</span>
                </div>
            </div>
        </div>
    );
};

export default TableSidebar;
